package com.homecare.dispatch.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Request / response contracts of the REST API (one file keeps the data dictionary in one place). */
public final class Dtos {

    private Dtos() {}

    public record PatientRequest(
            @NotBlank @Size(max = 30) String mrn,
            @NotBlank @Size(max = 80) String firstName,
            @NotBlank @Size(max = 80) String lastName,
            @NotNull @Past LocalDate dateOfBirth,
            String gender,
            @NotBlank @Pattern(regexp = "[0-9]{10}", message = "must be 10 digits") String phone,
            @Email String email,
            @NotBlank String addressLine,
            @NotBlank String city,
            String postalCode,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
            @NotBlank String familyContactName,
            @NotBlank @Pattern(regexp = "[0-9]{10}", message = "must be 10 digits") String familyContactPhone,
            @NotBlank @Email String familyContactEmail) {}

    public record PhysioSessionInput(@NotNull @Min(1) @Max(7) Integer dayNumber, @NotBlank String focus) {}

    public record PrescriptionInput(
            @NotBlank String medication,
            @NotBlank String dosage,
            @NotNull @Min(1) @Max(500) Integer quantity,
            boolean controlled,
            boolean doctorApproved) {}

    public record DischargeRequest(
            @NotBlank String surgeryType,
            @NotNull LocalDate surgeryDate,
            @NotNull LocalDate dischargeDate,
            @NotBlank String hospital,
            @NotBlank String doctorName,
            @NotBlank @Email String doctorEmail,
            @Pattern(regexp = "WOUND_CARE|POST_OP|CARDIAC|ORTHO|IV_THERAPY|PAEDIATRIC") String requiredSkill,
            @Valid List<PhysioSessionInput> physioSessions,
            @NotEmpty @Valid List<PrescriptionInput> prescriptions,
            /** Demo mode only: shorter ISO-8601 timer durations, e.g. {"visitWindow": "PT10S"}. */
            Map<String, String> timerOverrides) {}

    public record WorkflowStartResponse(Long workflowId, Long processInstanceKey, Long patientId, String status, String currentStage) {}

    public record NurseAvailabilityRequest(@NotNull Boolean available) {}

    public record VisitStatusRequest(@NotBlank @Pattern(regexp = "SCHEDULED|COMPLETED|INCOMPLETE|MISSED|CANCELLED") String status, String notes) {}

    public record PhysioUpdateRequest(LocalDate appointmentDate, String physiotherapist, String notes) {}

    public record TaskCompleteRequest(@NotNull Map<String, Object> variables, String actingUser) {}

    public record TaskClaimRequest(@NotBlank String assignee) {}

    public record FaultRequest(@NotBlank String fault, @NotBlank String mode) {}
}
