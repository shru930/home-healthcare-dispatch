package com.homecare.dispatch.worker;

import com.homecare.dispatch.config.DemoFaults;
import com.homecare.dispatch.domain.HealthAssessment;
import com.homecare.dispatch.domain.HomeCareVisit;
import com.homecare.dispatch.domain.PhysiotherapyAppointment;
import com.homecare.dispatch.domain.RiskIntervention;
import com.homecare.dispatch.dto.Payloads.AssignedNurse;
import com.homecare.dispatch.dto.Payloads.CareDay;
import com.homecare.dispatch.dto.Payloads.PhysioSession;
import com.homecare.dispatch.service.CareService;
import com.homecare.dispatch.service.NotificationService;
import com.homecare.dispatch.service.RiskEvaluator;
import com.homecare.dispatch.service.WorkflowService;
import io.camunda.client.annotation.JobWorker;
import io.camunda.client.annotation.Variable;
import io.camunda.zeebe.spring.common.exception.ZeebeBpmnError;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Workers inside the daily-visit multi-instance sub-process, the Readmission Risk Intervention
 * sub-process and the physiotherapy multi-instance sub-process.
 */
@Component
@RequiredArgsConstructor
public class VisitAndRiskWorkers {

    private final CareService care;
    private final RiskEvaluator risk;
    private final NotificationService notifications;
    private final WorkflowService workflows;
    private final DemoFaults faults;

    // ================================================================ daily visits (sequential MI)
    @JobWorker(type = "hh.schedule-visit")
    public Map<String, Object> scheduleVisit(@Variable Long workflowId, @Variable Long carePlanId, @Variable CareDay careDay,
                                             @Variable AssignedNurse assignedNurse) {
        HomeCareVisit v = care.scheduleVisit(carePlanId, careDay, assignedNurse == null ? null : assignedNurse.nurseId());
        workflows.stage(workflowId, "Day " + careDay.day() + " visit scheduled");
        return Map.of("visitId", v.getId());
    }

    public record RiskOutput(String riskLevel, List<String> riskReasons, Long assessmentId) {}

    /** Task_EvaluateRisk: stores the nurse's assessment and classifies readmission risk (workflow support only). */
    @JobWorker(type = "hh.evaluate-risk")
    public RiskOutput evaluateRisk(@Variable Long workflowId, @Variable Long visitId, @Variable CareDay careDay,
                                   @Variable Integer painScore, @Variable Double temperature, @Variable Boolean woundRedness,
                                   @Variable Boolean woundDischarge, @Variable Boolean swelling, @Variable String nurseNotes) {
        RiskEvaluator.RiskResult r = risk.evaluate(painScore, temperature, bool(woundRedness), bool(woundDischarge), bool(swelling));
        HealthAssessment a = care.recordAssessment(visitId, painScore, temperature, bool(woundRedness), bool(woundDischarge),
                bool(swelling), nurseNotes, r);
        workflows.stage(workflowId, "Day " + careDay.day() + " assessment: " + r.riskLevel() + " risk");
        return new RiskOutput(r.riskLevel(), r.reasons(), a.getId());
    }

    @JobWorker(type = "hh.record-incomplete-visit")
    public Map<String, Object> recordIncompleteVisit(@Variable Long patientId, @Variable Long visitId, @Variable CareDay careDay,
                                                     @Variable String nurseNotes) {
        care.setVisitStatus(visitId, "INCOMPLETE", nurseNotes);
        notifications.alert(patientId, "coordinator", "Day " + careDay.day() + " visit incomplete",
                "Nurse reported an incomplete visit: " + nurseNotes + ". Arrange a follow-up call.", "VISIT_INCOMPLETE");
        return Map.of("visitStatus", "INCOMPLETE");
    }

    /** Runs when the visit-window timer fires before the nurse submitted the assessment. */
    @JobWorker(type = "hh.record-missed-visit")
    public Map<String, Object> recordMissedVisit(@Variable Long patientId, @Variable Long visitId, @Variable CareDay careDay) {
        care.setVisitStatus(visitId, "MISSED", "No assessment submitted within the visit window");
        notifications.alert(patientId, "coordinator", "Day " + careDay.day() + " visit missed",
                "No assessment was submitted within the visit window. Contact the nurse and the family.", "VISIT_MISSED");
        return Map.of("visitStatus", "MISSED");
    }

    // ================================================================ Readmission Risk Intervention sub-process
    @JobWorker(type = "hh.open-intervention")
    public Map<String, Object> openIntervention(@Variable Long workflowId, @Variable Long patientId, @Variable Long assessmentId,
                                                @Variable String riskLevel, @Variable List<String> riskReasons, @Variable String patientName) {
        RiskIntervention i = care.openIntervention(assessmentId, riskLevel);
        notifications.alert(patientId, "doctor", riskLevel + " readmission risk: " + patientName,
                "Escalated for doctor review. Indicators: " + String.join("; ", riskReasons)
                        + ". Workflow-support flag only, not a diagnosis.", "RISK_ESCALATION");
        workflows.stage(workflowId, "Readmission risk intervention opened (" + riskLevel + ")");
        return Map.of("interventionId", i.getId(), "interventionStatus", i.getStatus());
    }

    /** CRITICAL path. Throws EMERGENCY_DISPATCH_FAILED, caught by the error boundary on the sub-process. */
    @JobWorker(type = "hh.dispatch-emergency")
    public Map<String, Object> dispatchEmergency(@Variable Long interventionId, @Variable String patientAddress) {
        if (faults.is(DemoFaults.Fault.EMERGENCY_DISPATCH, "FAIL")) {
            care.updateIntervention(interventionId, "DISPATCH_FAILED", null, null, "Urgent response service did not accept the request", false);
            throw new ZeebeBpmnError("EMERGENCY_DISPATCH_FAILED", "Urgent response service unavailable", Map.of());
        }
        care.updateIntervention(interventionId, "URGENT_RESPONSE_DISPATCHED", "URGENT_RESPONSE_TEAM", null,
                "Urgent home visit dispatched to " + patientAddress, false);
        return Map.of("interventionStatus", "URGENT_RESPONSE_DISPATCHED");
    }

    /** Non-interrupting timer on Doctor review: reminds the on-call doctor while the review stays open. */
    @JobWorker(type = "hh.remind-doctor")
    public Map<String, Object> remindDoctor(@Variable Long patientId, @Variable Long interventionId, @Variable String patientName) {
        care.updateIntervention(interventionId, null, "ON_CALL_DOCTOR", null, null, false);
        notifications.alert(patientId, "on-call doctor", "Reminder: review pending for " + patientName,
                "The doctor review has not been completed within the reminder window.", "RISK_REMINDER");
        return Map.of("doctorReminded", true);
    }

    @JobWorker(type = "hh.arrange-readmission")
    public Map<String, Object> arrangeReadmission(@Variable Long workflowId, @Variable Long patientId, @Variable Long interventionId) {
        care.markReadmission(patientId);
        care.updateIntervention(interventionId, "READMISSION_ARRANGED", null, "READMIT", null, false);
        workflows.stage(workflowId, "Hospital readmission arranged");
        return Map.of("interventionStatus", "READMISSION_ARRANGED");
    }

    @JobWorker(type = "hh.close-intervention")
    public Map<String, Object> closeIntervention(@Variable Long interventionId, @Variable String riskLevel,
                                                 @Variable String doctorDecision, @Variable String doctorNotes) {
        String status = "CRITICAL".equals(riskLevel) ? "RESOLVED_URGENT_RESPONSE"
                : "READMIT".equals(doctorDecision) ? "RESOLVED_READMITTED" : "RESOLVED_" + doctorDecision;
        care.updateIntervention(interventionId, status, null, doctorDecision, doctorNotes, true);
        return Map.of("interventionStatus", status);
    }

    /** After the error boundary: a coordinator handled the emergency manually. */
    @JobWorker(type = "hh.record-escalation")
    public Map<String, Object> recordEscalation(@Variable Long interventionId, @Variable String emergencyOutcome, @Variable String emergencyNotes) {
        care.updateIntervention(interventionId, "RESOLVED_MANUAL_" + emergencyOutcome, "CARE_COORDINATOR", null, emergencyNotes, true);
        return Map.of("interventionStatus", "RESOLVED_MANUAL_" + emergencyOutcome);
    }

    /** Interrupting timer on the sub-process: the intervention took too long, escalate to the clinical lead. */
    @JobWorker(type = "hh.escalate-clinical-lead")
    public Map<String, Object> escalateClinicalLead(@Variable Long patientId, @Variable Long interventionId, @Variable String patientName) {
        care.updateIntervention(interventionId, "ESCALATED_CLINICAL_LEAD", "CLINICAL_LEAD", null, "Intervention timed out", true);
        notifications.alert(patientId, "clinical lead", "Intervention timed out: " + patientName,
                "The readmission-risk intervention was not resolved in time and has been escalated.", "RISK_ESCALATION");
        return Map.of("interventionStatus", "ESCALATED_CLINICAL_LEAD");
    }

    // ================================================================ physiotherapy (parallel MI)
    @JobWorker(type = "hh.schedule-physio")
    public Map<String, Object> schedulePhysio(@Variable Long carePlanId, @Variable PhysioSession session) {
        PhysiotherapyAppointment a = care.schedulePhysio(carePlanId, session);
        return Map.of("appointmentId", a.getId(), "physiotherapist", a.getPhysiotherapist());
    }

    @JobWorker(type = "hh.complete-physio")
    public Map<String, Object> completePhysio(@Variable Long appointmentId, @Variable String physioStatus, @Variable String physioNotes) {
        care.setPhysioStatus(appointmentId, physioStatus, physioNotes);
        return Map.of("physioStatus", physioStatus);
    }

    @JobWorker(type = "hh.record-missed-physio")
    public Map<String, Object> recordMissedPhysio(@Variable Long patientId, @Variable Long appointmentId, @Variable PhysioSession session) {
        care.setPhysioStatus(appointmentId, "MISSED", "Session not recorded within the appointment window");
        notifications.alert(patientId, "coordinator", "Physiotherapy session " + session.sessionNo() + " missed",
                "Re-book the session with the physiotherapist.", "PHYSIO_MISSED");
        return Map.of("physioStatus", "MISSED");
    }

    private static boolean bool(Boolean b) {
        return Boolean.TRUE.equals(b);
    }
}
