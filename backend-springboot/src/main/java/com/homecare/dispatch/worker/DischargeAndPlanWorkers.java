package com.homecare.dispatch.worker;

import com.homecare.dispatch.dto.Payloads.PhysioSession;
import com.homecare.dispatch.dto.Payloads.PrescriptionItem;
import com.homecare.dispatch.service.CareService;
import com.homecare.dispatch.service.NotificationService;
import com.homecare.dispatch.service.WorkflowService;
import io.camunda.client.annotation.JobWorker;
import io.camunda.client.annotation.Variable;
import io.camunda.client.annotation.VariablesAsType;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/** Workers for discharge validation, care-plan generation, plan verification and closure. */
@Slf4j
@Component
@RequiredArgsConstructor
public class DischargeAndPlanWorkers {

    private final CareService care;
    private final WorkflowService workflows;
    private final NotificationService notifications;

    public record ValidationResult(boolean dischargeValid, List<String> validationErrors) {}

    /** Task_ValidateDischarge. Also applies corrections submitted through Task_CorrectDischarge. */
    @JobWorker(type = "hh.validate-discharge")
    public ValidationResult validateDischarge(@Variable Long workflowId, @Variable Long patientId, @Variable String patientPhone,
                                              @Variable String familyPhone, @Variable String familyEmail, @Variable String dischargeDate,
                                              @Variable Double patientLat, @Variable Double patientLng,
                                              @Variable List<PrescriptionItem> prescriptions) {
        List<String> errors = new ArrayList<>();
        if (patientPhone == null || !patientPhone.matches("\\d{10}")) errors.add("Patient phone must have 10 digits");
        if (familyPhone == null || !familyPhone.matches("\\d{10}")) errors.add("Family phone must have 10 digits");
        if (familyEmail == null || !familyEmail.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) errors.add("Family e-mail is not valid");
        if (patientLat == null || patientLng == null || Math.abs(patientLat) > 90 || Math.abs(patientLng) > 180) errors.add("Patient location is missing");
        if (prescriptions == null || prescriptions.isEmpty()) errors.add("At least one discharge prescription is required");
        try {
            LocalDate d = LocalDate.parse(dischargeDate);
            if (d.isAfter(LocalDate.now().plusDays(1)) || d.isBefore(LocalDate.now().minusDays(14))) {
                errors.add("Discharge date must be within the last 14 days");
            }
        } catch (DateTimeParseException | NullPointerException e) {
            errors.add("Discharge date must use YYYY-MM-DD");
        }
        boolean valid = errors.isEmpty();
        if (valid) {
            care.applyDischargeCorrections(patientId, patientPhone, familyPhone, familyEmail, LocalDate.parse(dischargeDate));
        }
        workflows.stage(workflowId, valid ? "Discharge details validated" : "Discharge details need correction");
        return new ValidationResult(valid, errors);
    }

    /** Task_RejectPlan: the admin rejected the request in the Tasklist; ends the case cleanly. */
    @JobWorker(type = "hh.reject-plan")
    public Map<String, Object> rejectPlan(@Variable Long workflowId, @Variable Long patientId, @Variable String approvalNotes,
                                          @Variable String requestedBy, @Variable String patientName) {
        care.rejectRequest(workflowId, approvalNotes);
        notifications.alert(patientId, requestedBy == null ? "ward staff" : requestedBy, "Home-care plan rejected: " + patientName,
                "The care coordinator rejected the request. Reason: " + approvalNotes, "PLAN_REJECTED");
        return Map.of("workflowStatus", "REJECTED");
    }

    /** Task_GenerateCarePlan: builds the carePlanDays (sequential MI) and physioSessions (parallel MI) collections. */
    /** Typed job input: Jackson keeps the generic element type of the list (unlike a bare List parameter). */
    public record CarePlanInput(Long workflowId, String dischargeDate, String requiredSkill, List<PhysioSession> physioSessions) {}

    @JobWorker(type = "hh.generate-care-plan")
    public CareService.GeneratedPlan generateCarePlan(@VariablesAsType CarePlanInput in) {
        CareService.GeneratedPlan plan = care.generatePlan(in.workflowId(), LocalDate.parse(in.dischargeDate()), in.requiredSkill(), in.physioSessions());
        workflows.stage(in.workflowId(), "Seven-day care plan generated");
        return plan;
    }

    /** Task_RecordNotifyFailure / Task_RecordFinalNotifyFailure: notification failures never stop patient care. */
    @JobWorker(type = "hh.record-notification-failure")
    public Map<String, Object> recordNotificationFailure(@Variable Long patientId, @Variable String familyEmail, @Variable String familyPhone,
                                                         @Variable String notificationCategory, @Variable String notificationError) {
        notifications.record(patientId, "EMAIL", familyEmail, "Family notification failed",
                "E-mail delivery failed for " + notificationCategory + ". The coordinator must call the family on " + familyPhone + ".",
                notificationCategory, "FAILED", null, notificationError);
        notifications.alert(patientId, "coordinator", "Call the family: notification failed",
                "Automatic " + notificationCategory + " notification could not be delivered: " + notificationError, "NOTIFICATION_FAILURE");
        Map<String, Object> out = new HashMap<>();
        out.put("familyNotified", false);
        return out;
    }

    /** Task_VerifyPlan: checks visits, physiotherapy and deliveries against the seven-day plan. */
    @JobWorker(type = "hh.verify-plan")
    public CareService.PlanCheck verifyPlan(@Variable Long workflowId, @Variable Long carePlanId,
                                            @Variable List<Map<String, Object>> visitResults,
                                            @Variable List<Map<String, Object>> physioResults,
                                            @Variable List<Map<String, Object>> pharmacyResults) {
        log.info("Verifying plan {}: {} visit results, {} physio results, {} pharmacy results", carePlanId,
                size(visitResults), size(physioResults), size(pharmacyResults));
        CareService.PlanCheck check = care.verifyPlan(carePlanId);
        workflows.stage(workflowId, "Plan verification: " + check.planOutcome());
        return check;
    }

    /** Task_ClosePlan: closes the plan, releases the nurse and marks the workflow complete. */
    @JobWorker(type = "hh.complete-workflow")
    public Map<String, Object> completeWorkflow(@Variable Long workflowId, @Variable Long carePlanId, @Variable String planOutcome) {
        care.closePlan(carePlanId);
        workflows.finish(workflowId, planOutcome);
        return Map.of("workflowStatus", "COMPLETED");
    }

    private static int size(List<?> l) {
        return l == null ? 0 : l.size();
    }
}
