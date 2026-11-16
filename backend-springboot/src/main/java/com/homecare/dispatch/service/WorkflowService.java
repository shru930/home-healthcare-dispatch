package com.homecare.dispatch.service;

import com.homecare.dispatch.config.HomeCareProperties;
import com.homecare.dispatch.domain.*;
import com.homecare.dispatch.dto.Dtos.DischargeRequest;
import com.homecare.dispatch.dto.Dtos.WorkflowStartResponse;
import com.homecare.dispatch.exception.ApiException;
import com.homecare.dispatch.repository.*;
import io.camunda.client.CamundaClient;
import io.camunda.client.api.response.ProcessInstanceEvent;
import java.time.LocalDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Starts the Camunda process for a discharged patient and builds the live status tracker view. */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowService {

    private final CamundaClient camunda;
    private final CamundaQueryService query;
    private final HomeCareProperties props;
    private final WorkflowInstanceRepository workflows;
    private final HomeCarePlanRepository plans;
    private final HomeCareVisitRepository visits;
    private final PhysiotherapyAppointmentRepository physio;
    private final PrescriptionRepository prescriptions;
    private final MedicationDeliveryRepository deliveries;
    private final RiskInterventionRepository interventions;
    private final NurseAssignmentRepository assignments;
    private final NotificationRepository notifications;
    private final HealthAssessmentRepository assessments;

    public static final List<String> TIMER_VARIABLES = List.of("visitWindow", "physioWindow", "doctorReviewReminder",
            "interventionTimeout", "deliveryReminder", "deliveryTimeout", "nurseRetryWait");

    /** Builds the documented start payload (see README "Initial process start payload") and creates the instance. */
    public WorkflowStartResponse start(Patient p, DischargeRequest d, List<Prescription> rxList) {
        WorkflowInstance wf = new WorkflowInstance();
        wf.setPatient(p);
        wf.setProcessDefinitionId(props.processes().mainProcessId());
        wf.setStatus("STARTING");
        wf.setCurrentStage("Discharge received");
        wf.setStartedAt(LocalDateTime.now());
        wf = workflows.save(wf);

        Map<String, Object> v = new LinkedHashMap<>();
        v.put("workflowId", wf.getId());
        v.put("patientId", p.getId());
        v.put("patientMrn", p.getMrn());
        v.put("patientName", p.fullName());
        v.put("patientPhone", p.getPhone());
        v.put("patientAddress", p.getAddressLine() + ", " + p.getCity());
        v.put("patientLat", p.getLatitude());
        v.put("patientLng", p.getLongitude());
        v.put("patientLocation", p.getLatitude() + "," + p.getLongitude());
        v.put("familyContactName", p.getFamilyContactName());
        v.put("familyEmail", p.getFamilyContactEmail());
        v.put("familyPhone", p.getFamilyContactPhone());
        v.put("surgeryType", d.surgeryType());
        v.put("dischargeDate", d.dischargeDate().toString());
        v.put("hospital", d.hospital());
        v.put("doctorName", d.doctorName());
        v.put("doctorEmail", d.doctorEmail());
        v.put("requiredSkill", d.requiredSkill() == null ? "WOUND_CARE" : d.requiredSkill());
        v.put("physioSessions", d.physioSessions() == null ? List.of() : d.physioSessions().stream()
                .map(s -> m("dayNumber", s.dayNumber(), "focus", s.focus())).toList());
        v.put("prescriptions", rxList.stream().map(rx -> m(
                "prescriptionId", rx.getId(), "medication", rx.getMedication(), "dosage", rx.getDosage(),
                "quantity", rx.getQuantity(), "controlled", rx.getControlled(), "doctorApproved", rx.getDoctorApproved())).toList());
        HomeCareProperties.Timers t = props.timers();
        v.put("visitWindow", t.visitWindow());
        v.put("physioWindow", t.physioWindow());
        v.put("doctorReviewReminder", t.doctorReviewReminder());
        v.put("interventionTimeout", t.interventionTimeout());
        v.put("deliveryReminder", t.deliveryReminder());
        v.put("deliveryTimeout", t.deliveryTimeout());
        v.put("nurseRetryWait", t.nurseRetryWait());
        if (d.timerOverrides() != null && !d.timerOverrides().isEmpty()) {
            if (!props.demoMode()) {
                throw ApiException.badRequest("timerOverrides are only accepted in demo mode");
            }
            d.timerOverrides().forEach((name, value) -> {
                if (!TIMER_VARIABLES.contains(name)) throw ApiException.badRequest("Unknown timer " + name + ". Allowed: " + TIMER_VARIABLES);
                try {
                    java.time.Duration.parse(value);
                } catch (Exception e) {
                    throw ApiException.badRequest("Timer " + name + " must be an ISO-8601 duration such as PT30S");
                }
                v.put(name, value);
            });
        }
        v.put("maxTravelMinutes", props.matching().maxTravelMinutes());
        v.put("maxNurseSearchAttempts", props.matching().maxNurseSearchAttempts());

        try {
            ProcessInstanceEvent ev = camunda.newCreateInstanceCommand()
                    .bpmnProcessId(props.processes().mainProcessId()).latestVersion()
                    .variables(v).send().join();
            wf.setProcessInstanceKey(ev.getProcessInstanceKey());
            wf.setStatus("ACTIVE");
            wf.setCurrentStage("Validating discharge details");
            workflows.save(wf);
            log.info("Started {} instance {} for patient {}", props.processes().mainProcessId(), ev.getProcessInstanceKey(), p.getMrn());
            return new WorkflowStartResponse(wf.getId(), ev.getProcessInstanceKey(), p.getId(), wf.getStatus(), wf.getCurrentStage());
        } catch (Exception e) {
            wf.setStatus("FAILED_TO_START");
            wf.setLastError(e.getMessage() == null ? e.toString() : e.getMessage().substring(0, Math.min(480, e.getMessage().length())));
            workflows.save(wf);
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Camunda could not start the workflow: " + e.getMessage());
        }
    }

    /** Called by the job workers so the tracker shows a business-friendly stage. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void stage(Long workflowId, String stage) {
        if (workflowId == null) return;
        workflows.findById(workflowId).ifPresent(w -> w.setCurrentStage(stage));
    }

    @Transactional
    public void finish(Long workflowId, String outcome) {
        workflows.findById(workflowId).ifPresent(w -> {
            w.setStatus("COMPLETED");
            w.setPlanOutcome(outcome);
            w.setCurrentStage("Seven-day plan closed");
            w.setEndedAt(LocalDateTime.now());
        });
    }

    private final org.springframework.beans.factory.ObjectProvider<CareService> care;

    /**
     * Keeps the database in step with the engine: an instance cancelled in Operate releases its nurse
     * and is marked CANCELLED, so cancelled cases never block nurse capacity.
     */
    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 30000, initialDelay = 20000)
    public void syncWithEngine() {
        for (WorkflowInstance w : workflows.findAll()) {
            if (!"ACTIVE".equals(w.getStatus()) || w.getProcessInstanceKey() == null) continue;
            try {
                Map<String, Object> pi = query.processInstance(w.getProcessInstanceKey());
                if (pi != null && ("TERMINATED".equals(pi.get("state")) || "CANCELED".equals(pi.get("state")))) {
                    care.getObject().cancelPlan(w.getId());
                    markCancelled(w.getId());
                    log.info("Workflow {} was cancelled in Camunda; plan closed and nurse released", w.getId());
                }
            } catch (Exception e) {
                log.debug("Engine sync skipped: {}", e.getMessage());
                return; // engine unreachable: try again next round
            }
        }
    }

    @Transactional
    public void markCancelled(Long workflowId) {
        workflows.findById(workflowId).ifPresent(w -> {
            w.setStatus("CANCELLED");
            w.setCurrentStage("Cancelled in Camunda");
            w.setEndedAt(LocalDateTime.now());
            workflows.save(w); // called from the scheduler inside this bean, so save explicitly
        });
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list() {
        return workflows.findAllByOrderByStartedAtDesc().stream().map(w -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("workflowId", w.getId());
            m.put("processInstanceKey", w.getProcessInstanceKey() == null ? null : String.valueOf(w.getProcessInstanceKey()));
            m.put("patientId", w.getPatient().getId());
            m.put("patientName", w.getPatient().fullName());
            m.put("status", w.getStatus());
            m.put("currentStage", w.getCurrentStage());
            m.put("planOutcome", w.getPlanOutcome());
            m.put("startedAt", w.getStartedAt());
            m.put("endedAt", w.getEndedAt());
            return m;
        }).toList();
    }

    /** Live process status tracker: Camunda runtime state + persisted business records. */
    @Transactional(readOnly = true)
    public Map<String, Object> tracker(long processInstanceKey) {
        WorkflowInstance w = workflows.findByProcessInstanceKey(processInstanceKey)
                .orElseThrow(() -> ApiException.notFound("Workflow with process instance", processInstanceKey));
        Patient p = w.getPatient();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("workflowId", w.getId());
        out.put("processInstanceKey", String.valueOf(processInstanceKey));
        out.put("status", w.getStatus());
        out.put("currentStage", w.getCurrentStage());
        out.put("planOutcome", w.getPlanOutcome());
        out.put("startedAt", w.getStartedAt());
        out.put("endedAt", w.getEndedAt());
        out.put("patient", m("id", p.getId(), "mrn", p.getMrn(), "name", p.fullName(), "status", p.getStatus(),
                "surgeryType", p.getSurgeryType(), "familyContact", p.getFamilyContactName() + " (" + p.getFamilyContactPhone() + ")"));

        // ---- Camunda runtime view (may be unavailable if the engine is down)
        try {
            Map<String, Object> pi = query.processInstance(processInstanceKey);
            out.put("engineState", pi == null ? "UNKNOWN" : pi.get("state"));
            List<Map<String, Object>> elements = query.elementInstances(processInstanceKey);
            out.put("activeSteps", elements.stream().filter(e -> "ACTIVE".equals(e.get("state")))
                    .filter(e -> !"MULTI_INSTANCE_BODY".equals(e.get("type")))
                    .map(e -> m("elementId", e.get("elementId"), "name", e.get("elementName"), "type", e.get("type")))
                    .toList());
            out.put("completedStepCount", elements.stream().filter(e -> "COMPLETED".equals(e.get("state"))).count());
            out.put("incidents", query.activeIncidents(processInstanceKey).stream()
                    .map(i -> m("elementId", i.get("elementId"), "errorType", i.get("errorType"),
                            "errorMessage", i.get("errorMessage"))).toList());
            out.put("pharmacyInstances", query.childInstances(processInstanceKey).stream()
                    .map(c -> m("processInstanceKey", c.get("processInstanceKey"), "state", c.get("state"),
                            "hasIncident", c.get("hasIncident"))).toList());
        } catch (Exception e) {
            out.put("engineState", "UNREACHABLE");
            out.put("engineError", e.getMessage());
        }

        // ---- Business records
        Optional<HomeCarePlan> plan = plans.findByWorkflowInstanceId(w.getId());
        if (plan.isPresent()) {
            Long planId = plan.get().getId();
            out.put("carePlan", m("id", planId, "startDate", plan.get().getStartDate(), "endDate", plan.get().getEndDate(),
                    "status", plan.get().getStatus(), "summary", plan.get().getSummary()));
            out.put("assignment", assignments.findByCarePlanIdOrderByAssignedAtDesc(planId).stream().findFirst().map(a -> m(
                    "nurse", a.getNurse().getFullName(), "username", a.getNurse().getUsername(),
                    "distanceKm", a.getDistanceMeters() == null ? "-" : String.format("%.1f", a.getDistanceMeters() / 1000.0),
                    "travelMinutes", a.getTravelSeconds() == null ? "-" : String.valueOf(Math.round(a.getTravelSeconds() / 60.0)),
                    "source", a.getDistanceSource(), "mode", a.getAssignmentMode())).orElse(null));
            List<HomeCareVisit> vs = visits.findByCarePlanIdOrderByDayNumberAsc(planId);
            Map<Long, HealthAssessment> byVisit = new HashMap<>();
            assessments.findByVisitCarePlanIdOrderByAssessedAtAsc(planId).forEach(a -> byVisit.put(a.getVisit().getId(), a));
            out.put("visits", vs.stream().map(v -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", v.getId());
                m.put("day", v.getDayNumber());
                m.put("date", v.getVisitDate());
                m.put("type", v.getVisitType());
                m.put("nurse", v.getNurse() == null ? null : v.getNurse().getFullName());
                m.put("status", v.getStatus());
                HealthAssessment a = byVisit.get(v.getId());
                m.put("riskLevel", a == null ? null : a.getRiskLevel());
                m.put("painScore", a == null ? null : a.getPainScore());
                return m;
            }).toList());
            out.put("visitsCompleted", vs.stream().filter(v -> "COMPLETED".equals(v.getStatus())).count());
            out.put("visitsPending", 7 - vs.stream().filter(v -> !"SCHEDULED".equals(v.getStatus())).count());
            out.put("physio", physio.findByCarePlanIdOrderBySessionNoAsc(planId).stream().map(a -> m(
                    "id", a.getId(), "sessionNo", a.getSessionNo(), "date", a.getAppointmentDate(), "focus", a.getFocus(),
                    "physiotherapist", a.getPhysiotherapist(), "status", a.getStatus())).toList());
            out.put("prescriptions", prescriptions.findByCarePlanIdOrderByIdAsc(planId).stream().map(rx -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", rx.getId());
                m.put("medication", rx.getMedication());
                m.put("status", rx.getStatus());
                m.put("pharmacy", rx.getPharmacy());
                m.put("reason", rx.getStatusReason());
                deliveries.findByPrescriptionIdOrderByIdDesc(rx.getId()).stream().findFirst().ifPresent(d -> {
                    m.put("deliveryRef", d.getDeliveryRef());
                    m.put("deliveryStatus", d.getStatus());
                });
                return m;
            }).toList());
        }
        out.put("interventions", interventions.findByPatientIdOrderByOpenedAtDesc(p.getId()).stream().map(i -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", i.getId());
            m.put("riskLevel", i.getRiskLevel());
            m.put("status", i.getStatus());
            m.put("escalationLevel", i.getEscalationLevel());
            m.put("doctorDecision", i.getDoctorDecision());
            m.put("openedAt", i.getOpenedAt());
            m.put("closedAt", i.getClosedAt());
            return m;
        }).toList());
        out.put("notifications", notifications.findByPatientIdOrderByCreatedAtDesc(p.getId()).stream().limit(20).map(n -> m(
                "channel", n.getChannel(), "category", n.getCategory(), "status", n.getStatus(),
                "recipient", n.getRecipient(), "subject", n.getSubject(), "createdAt", n.getCreatedAt())).toList());
        return out;
    }

    /** Null-tolerant replacement for Map.of (keeps key order, allows null values). */
    private static Map<String, Object> m(Object... kv) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            out.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return out;
    }
}
