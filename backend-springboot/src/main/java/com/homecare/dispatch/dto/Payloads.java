package com.homecare.dispatch.dto;

/**
 * Typed shapes of the structured process variables. The same field names are used in the BPMN
 * FEEL expressions, the job workers and the React client.
 */
public final class Payloads {

    private Payloads() {}

    /** One element of carePlanDays (sequential multi-instance collection). */
    public record CareDay(Integer day, String date, String visitType) {}

    /** One element of physioSessions (parallel multi-instance collection). */
    public record PhysioSession(Integer sessionNo, Integer dayNumber, String date, String focus) {}

    /** One element of prescriptions (parallel multi-instance call activity collection). */
    public record PrescriptionItem(Long prescriptionId, String medication, String dosage, Integer quantity,
                                   Boolean controlled, Boolean doctorApproved) {}

    public record AssignedNurse(Long nurseId, String username, String fullName, String phone) {}
}
