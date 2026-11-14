package com.homecare.dispatch.web;

import com.homecare.dispatch.config.DemoFaults;
import com.homecare.dispatch.config.DemoMailServer;
import com.homecare.dispatch.dto.Dtos.*;
import com.homecare.dispatch.exception.ApiException;
import com.homecare.dispatch.repository.*;
import com.homecare.dispatch.service.*;
import io.camunda.client.CamundaClient;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** All REST controllers of the application, grouped by resource. */
public final class ApiControllers {

    private ApiControllers() {}

    // ================================================================ patients + discharge
    @RestController
    @RequestMapping("/api/patients")
    @RequiredArgsConstructor
    public static class PatientController {
        private final PatientService patients;

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        public Map<String, Object> register(@Valid @RequestBody PatientRequest request) {
            return Views.patient(patients.register(request));
        }

        @GetMapping
        public List<Map<String, Object>> list() {
            return patients.list().stream().map(Views::patient).toList();
        }

        @GetMapping("/{id}")
        public Map<String, Object> get(@PathVariable Long id) {
            return Views.patient(patients.get(id));
        }

        /** Records the discharge and starts the seven-day home-care workflow in Camunda. */
        @PostMapping("/{id}/discharge")
        @ResponseStatus(HttpStatus.CREATED)
        public WorkflowStartResponse discharge(@PathVariable Long id, @Valid @RequestBody DischargeRequest request) {
            return patients.discharge(id, request);
        }
    }

    // ================================================================ workflows + live tracker
    @RestController
    @RequestMapping("/api/workflows")
    @RequiredArgsConstructor
    public static class WorkflowController {
        private final WorkflowService workflows;

        @GetMapping
        public List<Map<String, Object>> list() {
            return workflows.list();
        }

        @GetMapping("/{processInstanceKey}/status")
        public Map<String, Object> status(@PathVariable long processInstanceKey) {
            return workflows.tracker(processInstanceKey);
        }
    }

    // ================================================================ nurses
    @RestController
    @RequestMapping("/api/nurses")
    @RequiredArgsConstructor
    public static class NurseController {
        private final NurseRepository nurses;
        private final NurseAssignmentRepository assignments;

        @GetMapping
        public List<Map<String, Object>> list() {
            return nurses.findAll().stream().map(Views::nurse).toList();
        }

        @PatchMapping("/{id}/availability")
        @Transactional
        public Map<String, Object> availability(@PathVariable Long id, @Valid @RequestBody NurseAvailabilityRequest r) {
            var n = nurses.findById(id).orElseThrow(() -> ApiException.notFound("Nurse", id));
            n.setAvailable(r.available());
            return Views.nurse(n);
        }

        @GetMapping("/assignments")
        @Transactional(readOnly = true)
        public List<Map<String, Object>> assignments() {
            return assignments.findAllByOrderByAssignedAtDesc().stream().map(Views::assignment).toList();
        }
    }

    // ================================================================ visits + assessments
    @RestController
    @RequestMapping("/api")
    @RequiredArgsConstructor
    public static class VisitController {
        private final HomeCareVisitRepository visits;
        private final HealthAssessmentRepository assessments;
        private final CareService care;

        @GetMapping("/visits")
        @Transactional(readOnly = true)
        public List<Map<String, Object>> visits(@RequestParam(required = false) Long carePlanId) {
            var list = carePlanId == null ? visits.findAllByOrderByVisitDateAscDayNumberAsc() : visits.findByCarePlanIdOrderByDayNumberAsc(carePlanId);
            return list.stream().map(Views::visit).toList();
        }

        /** Coordinator correction of a visit record (the workflow sets statuses automatically). */
        @PatchMapping("/visits/{id}/status")
        @Transactional
        public Map<String, Object> updateStatus(@PathVariable Long id, @Valid @RequestBody VisitStatusRequest r) {
            return Views.visit(care.setVisitStatus(id, r.status(), r.notes()));
        }

        @GetMapping("/assessments")
        @Transactional(readOnly = true)
        public List<Map<String, Object>> assessments() {
            return assessments.findAllByOrderByAssessedAtDesc().stream().map(Views::assessment).toList();
        }
    }

    // ================================================================ physiotherapy
    @RestController
    @RequestMapping("/api/physio")
    @RequiredArgsConstructor
    public static class PhysioController {
        private final PhysiotherapyAppointmentRepository physio;

        @GetMapping
        @Transactional(readOnly = true)
        public List<Map<String, Object>> list() {
            return physio.findAllByOrderByAppointmentDateAscSessionNoAsc().stream().map(Views::physio).toList();
        }

        /** Reschedule or reassign an appointment. */
        @PatchMapping("/{id}")
        @Transactional
        public Map<String, Object> update(@PathVariable Long id, @RequestBody PhysioUpdateRequest r) {
            var a = physio.findById(id).orElseThrow(() -> ApiException.notFound("Physiotherapy appointment", id));
            if (r.appointmentDate() != null) a.setAppointmentDate(r.appointmentDate());
            if (r.physiotherapist() != null && !r.physiotherapist().isBlank()) a.setPhysiotherapist(r.physiotherapist());
            if (r.notes() != null) a.setNotes(r.notes());
            return Views.physio(a);
        }
    }

    // ================================================================ pharmacy + deliveries
    @RestController
    @RequestMapping("/api")
    @RequiredArgsConstructor
    public static class PharmacyController {
        private final PrescriptionRepository prescriptions;
        private final MedicationDeliveryRepository deliveries;
        private final PharmacyStockRepository stock;
        private final PharmacyService pharmacy;
        private final CamundaClient camunda;

        @GetMapping("/prescriptions")
        @Transactional(readOnly = true)
        public List<Map<String, Object>> prescriptions() {
            return prescriptions.findAllByOrderByIdDesc().stream().map(Views::prescription).toList();
        }

        @GetMapping("/deliveries")
        @Transactional(readOnly = true)
        public List<Map<String, Object>> deliveries() {
            return deliveries.findAllByOrderByIdDesc().stream().map(Views::delivery).toList();
        }

        @GetMapping("/pharmacy/stock")
        public List<?> stock() {
            return stock.findAllByOrderByPharmacyAscMedicationAsc();
        }

        /** Courier confirms the hand-over: publishes the MedicationDelivered message correlated by deliveryRef. */
        @PostMapping("/deliveries/{deliveryRef}/confirm")
        @Transactional(readOnly = true)
        public Map<String, Object> confirm(@PathVariable String deliveryRef) {
            var d = pharmacy.delivery(deliveryRef);
            if (!"DISPATCHED".equals(d.getStatus())) {
                throw ApiException.conflict("Delivery " + deliveryRef + " is " + d.getStatus() + ", not DISPATCHED");
            }
            camunda.newPublishMessageCommand().messageName("MedicationDelivered").correlationKey(deliveryRef)
                    .timeToLive(Duration.ofMinutes(10)).variables(Map.of("confirmedBy", "courier")).send().join();
            return Map.of("deliveryRef", deliveryRef, "message", "MedicationDelivered published");
        }
    }

    // ================================================================ alerts, notifications, interventions
    @RestController
    @RequestMapping("/api")
    @RequiredArgsConstructor
    public static class AlertController {
        private final NotificationRepository notifications;
        private final RiskInterventionRepository interventions;

        @GetMapping("/notifications")
        @Transactional(readOnly = true)
        public List<Map<String, Object>> notifications() {
            return notifications.findTop100ByOrderByCreatedAtDesc().stream().map(Views::notification).toList();
        }

        /** Staff alerts: in-app escalations and failed notifications. */
        @GetMapping("/alerts")
        @Transactional(readOnly = true)
        public List<Map<String, Object>> alerts() {
            return notifications.findTop100ByOrderByCreatedAtDesc().stream()
                    .filter(n -> "IN_APP".equals(n.getChannel()) || "FAILED".equals(n.getStatus()))
                    .map(Views::notification).toList();
        }

        @GetMapping("/interventions")
        @Transactional(readOnly = true)
        public List<Map<String, Object>> interventions() {
            return interventions.findAllByOrderByOpenedAtDesc().stream().map(Views::intervention).toList();
        }
    }

    // ================================================================ custom Tasklist
    @RestController
    @RequestMapping("/api/tasks")
    @RequiredArgsConstructor
    public static class TaskController {
        private final TaskService tasks;

        @GetMapping
        public List<Map<String, Object>> list(@RequestParam(required = false) String assignee,
                                              @RequestParam(required = false) String candidateGroup,
                                              @RequestParam(required = false) String state,
                                              @RequestParam(required = false) Long processInstanceKey) {
            return tasks.list(assignee, candidateGroup, state, processInstanceKey);
        }

        @GetMapping("/{key}")
        public Map<String, Object> details(@PathVariable long key) {
            return tasks.details(key);
        }

        @PostMapping("/{key}/claim")
        public Map<String, Object> claim(@PathVariable long key, @Valid @RequestBody TaskClaimRequest r) {
            tasks.claim(key, r.assignee());
            return Map.of("userTaskKey", String.valueOf(key), "assignee", r.assignee());
        }

        @PostMapping("/{key}/complete")
        public Map<String, Object> complete(@PathVariable long key, @Valid @RequestBody TaskCompleteRequest r) {
            tasks.complete(key, r.variables(), r.actingUser());
            return Map.of("userTaskKey", String.valueOf(key), "state", "COMPLETED");
        }
    }

    // ================================================================ dashboard
    @RestController
    @RequestMapping("/api/dashboard")
    @RequiredArgsConstructor
    public static class DashboardController {
        private final PatientRepository patients;
        private final HomeCarePlanRepository plans;
        private final NurseRepository nurses;
        private final HomeCareVisitRepository visits;
        private final MedicationDeliveryRepository deliveries;
        private final PrescriptionRepository prescriptions;
        private final RiskInterventionRepository interventions;
        private final WorkflowInstanceRepository workflows;
        private final NotificationRepository notifications;

        @GetMapping
        @Transactional(readOnly = true)
        public Map<String, Object> summary() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("activePatients", patients.countByStatus("IN_CARE"));
            m.put("activeCarePlans", plans.countByStatus("ACTIVE"));
            m.put("availableNurses", nurses.findAll().stream().filter(n -> n.hasCapacity()).count());
            m.put("scheduledVisits", visits.countByStatus("SCHEDULED"));
            m.put("pendingDeliveries", deliveries.countByStatusIn(List.of("DISPATCHED"))
                    + prescriptions.findAll().stream().filter(rx -> List.of("PRESCRIBED", "VERIFIED", "RESERVED", "DELAYED").contains(rx.getStatus())
                    && rx.getCarePlan() != null).count());
            m.put("criticalAlerts", interventions.countByRiskLevelAndClosedAtIsNull("CRITICAL"));
            m.put("openInterventions", interventions.findAll().stream().filter(i -> i.getClosedAt() == null).count());
            m.put("failedNotifications", notifications.countByStatus("FAILED"));
            Map<String, Long> wf = new TreeMap<>();
            workflows.findAll().forEach(w -> wf.merge(w.getStatus(), 1L, Long::sum));
            m.put("workflowsByStatus", wf);
            return m;
        }
    }

    // ================================================================ demo fault injection
    @RestController
    @RequestMapping("/api/demo")
    @RequiredArgsConstructor
    public static class DemoController {
        private final DemoFaults faults;
        private final DemoMailServer mail;

        @GetMapping("/faults")
        public Map<String, Object> list() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("active", faults.snapshot());
            m.put("modes", DemoFaults.MODES);
            m.put("smtpServerRunning", mail.running());
            return m;
        }

        @PostMapping("/faults")
        public Map<String, Object> set(@Valid @RequestBody FaultRequest r) {
            DemoFaults.Fault f;
            try {
                f = DemoFaults.Fault.valueOf(r.fault());
            } catch (IllegalArgumentException e) {
                throw ApiException.badRequest("Unknown fault " + r.fault() + ". Allowed: " + Arrays.toString(DemoFaults.Fault.values()));
            }
            faults.set(f, r.mode());
            if (f == DemoFaults.Fault.EMAIL_SERVER) {
                if ("DOWN".equals(r.mode())) mail.stop(); else mail.start();
            }
            return list();
        }

        @PostMapping("/faults/reset")
        public Map<String, Object> reset() {
            faults.reset();
            mail.start();
            return list();
        }
    }
}
