package com.homecare.dispatch.service;

import com.homecare.dispatch.domain.*;
import com.homecare.dispatch.dto.Payloads.AssignedNurse;
import com.homecare.dispatch.dto.Payloads.CareDay;
import com.homecare.dispatch.dto.Payloads.PhysioSession;
import com.homecare.dispatch.exception.ApiException;
import com.homecare.dispatch.repository.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Care plan, nurse assignment, visits, assessments, risk interventions and physiotherapy. */
@Service
@RequiredArgsConstructor
public class CareService {

    public static final String[] PHYSIOTHERAPISTS = {"physio.rahul", "physio.meena"};

    private final HomeCarePlanRepository plans;
    private final WorkflowInstanceRepository workflows;
    private final NurseRepository nurses;
    private final NurseAssignmentRepository assignments;
    private final HomeCareVisitRepository visits;
    private final HealthAssessmentRepository assessments;
    private final RiskInterventionRepository interventions;
    private final PhysiotherapyAppointmentRepository physio;
    private final PrescriptionRepository prescriptions;
    private final PatientRepository patients;

    // ------------------------------------------------------------------ care plan
    public record GeneratedPlan(Long carePlanId, List<CareDay> carePlanDays, List<PhysioSession> physioSessions,
                                String careStartDate, String careEndDate) {}

    /** Creates the 7-day plan once per workflow (idempotent, so a retried job does not duplicate it). */
    @Transactional
    public GeneratedPlan generatePlan(Long workflowId, LocalDate dischargeDate, String requiredSkill, List<PhysioSession> requested) {
        WorkflowInstance wf = workflows.findById(workflowId).orElseThrow(() -> ApiException.notFound("Workflow", workflowId));
        HomeCarePlan plan = plans.findByWorkflowInstanceId(workflowId).orElseGet(() -> {
            HomeCarePlan p = new HomeCarePlan();
            p.setPatient(wf.getPatient());
            p.setWorkflowInstance(wf);
            p.setStartDate(dischargeDate.plusDays(1));
            p.setEndDate(dischargeDate.plusDays(7));
            p.setRequiredSkill(requiredSkill == null ? "WOUND_CARE" : requiredSkill);
            p.setStatus("ACTIVE");
            p.setCreatedAt(LocalDateTime.now());
            return plans.save(p);
        });
        prescriptions.findByPatientIdOrderByIdAsc(wf.getPatient().getId()).stream()
                .filter(rx -> rx.getCarePlan() == null)
                .forEach(rx -> rx.setCarePlan(plan));

        List<CareDay> days = new ArrayList<>();
        for (int d = 1; d <= 7; d++) {
            String type = d == 1 ? "ADMISSION_ASSESSMENT" : d == 7 ? "FINAL_REVIEW" : "WOUND_AND_VITALS_CHECK";
            days.add(new CareDay(d, dischargeDate.plusDays(d).toString(), type));
        }
        List<PhysioSession> source = requested == null || requested.isEmpty()
                ? List.of(new PhysioSession(null, 2, null, "Mobility and gait"),
                          new PhysioSession(null, 4, null, "Strength exercises"),
                          new PhysioSession(null, 6, null, "Stairs and independence"))
                : requested;
        List<PhysioSession> sessions = new ArrayList<>();
        int n = 1;
        for (PhysioSession s : source) {
            sessions.add(new PhysioSession(n++, s.dayNumber(), dischargeDate.plusDays(s.dayNumber()).toString(), s.focus()));
        }
        return new GeneratedPlan(plan.getId(), days, sessions, plan.getStartDate().toString(), plan.getEndDate().toString());
    }

    /** Persists corrections made through the "Correct discharge details" user task. */
    @Transactional
    public void applyDischargeCorrections(Long patientId, String phone, String familyPhone, String familyEmail, LocalDate dischargeDate) {
        patients.findById(patientId).ifPresent(p -> {
            p.setPhone(phone);
            p.setFamilyContactPhone(familyPhone);
            p.setFamilyContactEmail(familyEmail);
            p.setDischargeDate(dischargeDate);
            p.setUpdatedAt(LocalDateTime.now());
        });
    }

    // ------------------------------------------------------------------ nurses
    public List<NurseMatcher.Candidate> availableCandidates(String requiredSkill) {
        return nurses.findByAvailableTrueOrderByIdAsc().stream()
                .filter(Nurse::hasCapacity)
                .filter(n -> n.hasSkill(requiredSkill))
                .map(n -> new NurseMatcher.Candidate(n.getId(), n.getUsername(), n.getFullName(), n.getPhone(),
                        n.getLatitude(), n.getLongitude(), n.getSkills()))
                .toList();
    }

    @Transactional
    public AssignedNurse assignNurse(Long carePlanId, Long nurseId, Integer distanceMeters, Integer travelSeconds,
                                     String distanceSource, String mode, String note) {
        HomeCarePlan plan = plans.findById(carePlanId).orElseThrow(() -> ApiException.notFound("Care plan", carePlanId));
        Nurse nurse = nurses.findById(nurseId).orElseThrow(() -> ApiException.notFound("Nurse", nurseId));
        boolean already = assignments.findByCarePlanIdOrderByAssignedAtDesc(carePlanId).stream()
                .anyMatch(a -> a.getNurse().getId().equals(nurseId));
        if (!already) {
            NurseAssignment a = new NurseAssignment();
            a.setCarePlan(plan);
            a.setNurse(nurse);
            a.setDistanceMeters(distanceMeters);
            a.setTravelSeconds(travelSeconds);
            a.setDistanceSource(distanceSource == null ? "UNKNOWN" : distanceSource);
            a.setAssignmentMode(mode);
            a.setNote(note);
            a.setAssignedAt(LocalDateTime.now());
            assignments.save(a);
            nurse.setCurrentPatients(nurse.getCurrentPatients() + 1);
            if (nurse.getCurrentPatients() >= nurse.getMaxPatients()) {
                nurse.setAvailable(false);
            }
        }
        return new AssignedNurse(nurse.getId(), nurse.getUsername(), nurse.getFullName(), nurse.getPhone());
    }

    @Transactional
    public void releaseNurses(Long carePlanId) {
        assignments.findByCarePlanIdOrderByAssignedAtDesc(carePlanId).stream().map(NurseAssignment::getNurse).distinct().forEach(n -> {
            n.setCurrentPatients(Math.max(0, n.getCurrentPatients() - 1));
            if (n.getCurrentPatients() < n.getMaxPatients()) {
                n.setAvailable(true);
            }
        });
    }

    // ------------------------------------------------------------------ visits + assessments
    @Transactional
    public HomeCareVisit scheduleVisit(Long carePlanId, CareDay day, Long nurseId) {
        HomeCarePlan plan = plans.findById(carePlanId).orElseThrow(() -> ApiException.notFound("Care plan", carePlanId));
        return visits.findByCarePlanIdAndDayNumber(carePlanId, day.day()).orElseGet(() -> {
            HomeCareVisit v = new HomeCareVisit();
            v.setCarePlan(plan);
            v.setDayNumber(day.day());
            v.setVisitDate(LocalDate.parse(day.date()));
            v.setVisitType(day.visitType());
            v.setNurse(nurseId == null ? null : nurses.findById(nurseId).orElse(null));
            v.setStatus("SCHEDULED");
            return visits.save(v);
        });
    }

    @Transactional
    public HomeCareVisit setVisitStatus(Long visitId, String status, String notes) {
        HomeCareVisit v = visits.findById(visitId).orElseThrow(() -> ApiException.notFound("Visit", visitId));
        v.setStatus(status);
        if (notes != null && !notes.isBlank()) {
            v.setNotes(notes);
        }
        if ("COMPLETED".equals(status) || "INCOMPLETE".equals(status)) {
            v.setCompletedAt(LocalDateTime.now());
        }
        return v;
    }

    @Transactional
    public HealthAssessment recordAssessment(Long visitId, int pain, double temperature, boolean redness, boolean discharge,
                                             boolean swelling, String notes, RiskEvaluator.RiskResult risk) {
        HomeCareVisit v = setVisitStatus(visitId, "COMPLETED", notes);
        HealthAssessment a = new HealthAssessment();
        a.setVisit(v);
        a.setPainScore(pain);
        a.setTemperature(temperature);
        a.setWoundRedness(redness);
        a.setWoundDischarge(discharge);
        a.setSwelling(swelling);
        a.setNurseNotes(notes);
        a.setRiskLevel(risk.riskLevel());
        a.setRiskReasons(String.join("; ", risk.reasons()));
        a.setAssessedAt(LocalDateTime.now());
        return assessments.save(a);
    }

    // ------------------------------------------------------------------ readmission risk interventions
    @Transactional
    public RiskIntervention openIntervention(Long assessmentId, String riskLevel) {
        HealthAssessment a = assessments.findById(assessmentId).orElseThrow(() -> ApiException.notFound("Assessment", assessmentId));
        RiskIntervention i = new RiskIntervention();
        i.setAssessment(a);
        i.setPatient(a.getVisit().getCarePlan().getPatient());
        i.setRiskLevel(riskLevel);
        i.setStatus("CRITICAL".equals(riskLevel) ? "URGENT_RESPONSE" : "AWAITING_DOCTOR_REVIEW");
        i.setEscalationLevel("DOCTOR");
        i.setOpenedAt(LocalDateTime.now());
        return interventions.save(i);
    }

    @Transactional
    public RiskIntervention updateIntervention(Long id, String status, String escalationLevel, String decision, String notes, boolean close) {
        RiskIntervention i = interventions.findById(id).orElseThrow(() -> ApiException.notFound("Intervention", id));
        if (status != null) i.setStatus(status);
        if (escalationLevel != null) i.setEscalationLevel(escalationLevel);
        if (decision != null) i.setDoctorDecision(decision);
        if (notes != null && !notes.isBlank()) i.setNotes(notes);
        if (close) i.setClosedAt(LocalDateTime.now());
        return i;
    }

    @Transactional
    public void markReadmission(Long patientId) {
        patients.findById(patientId).ifPresent(p -> {
            p.setStatus("READMISSION_ARRANGED");
            p.setUpdatedAt(LocalDateTime.now());
        });
    }

    // ------------------------------------------------------------------ physiotherapy
    @Transactional
    public PhysiotherapyAppointment schedulePhysio(Long carePlanId, PhysioSession s) {
        HomeCarePlan plan = plans.findById(carePlanId).orElseThrow(() -> ApiException.notFound("Care plan", carePlanId));
        return physio.findByCarePlanIdOrderBySessionNoAsc(carePlanId).stream()
                .filter(a -> a.getSessionNo().equals(s.sessionNo())).findFirst().orElseGet(() -> {
                    PhysiotherapyAppointment a = new PhysiotherapyAppointment();
                    a.setCarePlan(plan);
                    a.setSessionNo(s.sessionNo());
                    a.setDayNumber(s.dayNumber());
                    a.setAppointmentDate(LocalDate.parse(s.date()));
                    a.setFocus(s.focus());
                    a.setPhysiotherapist(PHYSIOTHERAPISTS[(s.sessionNo() - 1) % PHYSIOTHERAPISTS.length]);
                    a.setStatus("BOOKED");
                    return physio.save(a);
                });
    }

    @Transactional
    public PhysiotherapyAppointment setPhysioStatus(Long id, String status, String notes) {
        PhysiotherapyAppointment a = physio.findById(id).orElseThrow(() -> ApiException.notFound("Physiotherapy appointment", id));
        a.setStatus(status);
        if (notes != null && !notes.isBlank()) a.setNotes(notes);
        return a;
    }

    // ------------------------------------------------------------------ completion
    public record PlanCheck(String planOutcome, int gapCount, String planSummary) {}

    @Transactional
    public PlanCheck verifyPlan(Long carePlanId) {
        HomeCarePlan plan = plans.findById(carePlanId).orElseThrow(() -> ApiException.notFound("Care plan", carePlanId));
        List<HomeCareVisit> v = visits.findByCarePlanIdOrderByDayNumberAsc(carePlanId);
        List<PhysiotherapyAppointment> p = physio.findByCarePlanIdOrderBySessionNoAsc(carePlanId);
        List<Prescription> rx = prescriptions.findByCarePlanIdOrderByIdAsc(carePlanId);
        long visitsDone = v.stream().filter(x -> "COMPLETED".equals(x.getStatus())).count();
        long physioDone = p.stream().filter(x -> "COMPLETED".equals(x.getStatus())).count();
        long delivered = rx.stream().filter(x -> "DELIVERED".equals(x.getStatus())).count();
        int gaps = (int) ((7 - visitsDone) + (p.size() - physioDone) + (rx.size() - delivered));
        String outcome = gaps == 0 ? "COMPLETED" : "COMPLETED_WITH_GAPS";
        String summary = String.format("Visits completed %d/7, physiotherapy %d/%d, medications delivered %d/%d",
                visitsDone, physioDone, p.size(), delivered, rx.size());
        plan.setPlanOutcome(outcome);
        plan.setSummary(summary);
        return new PlanCheck(outcome, gaps, summary);
    }

    @Transactional
    public void closePlan(Long carePlanId) {
        plans.findById(carePlanId).ifPresent(plan -> {
            plan.setStatus("CLOSED");
            Patient patient = plan.getPatient();
            if (!"READMISSION_ARRANGED".equals(patient.getStatus())) {
                patient.setStatus("CARE_COMPLETED");
            }
            patient.setUpdatedAt(LocalDateTime.now());
            releaseNurses(carePlanId);
        });
    }
}
