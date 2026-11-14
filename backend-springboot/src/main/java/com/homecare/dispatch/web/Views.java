package com.homecare.dispatch.web;

import com.homecare.dispatch.domain.*;
import java.util.LinkedHashMap;
import java.util.Map;

/** Flat JSON views of the entities (avoids leaking the whole object graph to the client). */
final class Views {

    private Views() {}

    static Map<String, Object> patient(Patient p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("mrn", p.getMrn());
        m.put("firstName", p.getFirstName());
        m.put("lastName", p.getLastName());
        m.put("name", p.fullName());
        m.put("dateOfBirth", p.getDateOfBirth());
        m.put("gender", p.getGender());
        m.put("phone", p.getPhone());
        m.put("email", p.getEmail());
        m.put("addressLine", p.getAddressLine());
        m.put("city", p.getCity());
        m.put("postalCode", p.getPostalCode());
        m.put("latitude", p.getLatitude());
        m.put("longitude", p.getLongitude());
        m.put("familyContactName", p.getFamilyContactName());
        m.put("familyContactPhone", p.getFamilyContactPhone());
        m.put("familyContactEmail", p.getFamilyContactEmail());
        m.put("surgeryType", p.getSurgeryType());
        m.put("surgeryDate", p.getSurgeryDate());
        m.put("dischargeDate", p.getDischargeDate());
        m.put("hospital", p.getHospital());
        m.put("doctorName", p.getDoctorName());
        m.put("doctorEmail", p.getDoctorEmail());
        m.put("status", p.getStatus());
        m.put("createdAt", p.getCreatedAt());
        return m;
    }

    static Map<String, Object> nurse(Nurse n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", n.getId());
        m.put("username", n.getUsername());
        m.put("fullName", n.getFullName());
        m.put("phone", n.getPhone());
        m.put("skills", n.getSkills());
        m.put("baseArea", n.getBaseArea());
        m.put("latitude", n.getLatitude());
        m.put("longitude", n.getLongitude());
        m.put("available", n.getAvailable());
        m.put("currentPatients", n.getCurrentPatients());
        m.put("maxPatients", n.getMaxPatients());
        return m;
    }

    static Map<String, Object> assignment(NurseAssignment a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("carePlanId", a.getCarePlan().getId());
        m.put("patientName", a.getCarePlan().getPatient().fullName());
        m.put("nurseId", a.getNurse().getId());
        m.put("nurseName", a.getNurse().getFullName());
        m.put("distanceMeters", a.getDistanceMeters());
        m.put("travelSeconds", a.getTravelSeconds());
        m.put("distanceSource", a.getDistanceSource());
        m.put("assignmentMode", a.getAssignmentMode());
        m.put("note", a.getNote());
        m.put("assignedAt", a.getAssignedAt());
        return m;
    }

    static Map<String, Object> visit(HomeCareVisit v) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", v.getId());
        m.put("carePlanId", v.getCarePlan().getId());
        m.put("patientName", v.getCarePlan().getPatient().fullName());
        m.put("dayNumber", v.getDayNumber());
        m.put("visitDate", v.getVisitDate());
        m.put("visitType", v.getVisitType());
        m.put("nurseName", v.getNurse() == null ? null : v.getNurse().getFullName());
        m.put("status", v.getStatus());
        m.put("notes", v.getNotes());
        m.put("completedAt", v.getCompletedAt());
        return m;
    }

    static Map<String, Object> assessment(HealthAssessment a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("visitId", a.getVisit().getId());
        m.put("dayNumber", a.getVisit().getDayNumber());
        m.put("patientName", a.getVisit().getCarePlan().getPatient().fullName());
        m.put("painScore", a.getPainScore());
        m.put("temperature", a.getTemperature());
        m.put("woundRedness", a.getWoundRedness());
        m.put("woundDischarge", a.getWoundDischarge());
        m.put("swelling", a.getSwelling());
        m.put("riskLevel", a.getRiskLevel());
        m.put("riskReasons", a.getRiskReasons());
        m.put("assessedAt", a.getAssessedAt());
        return m;
    }

    static Map<String, Object> intervention(RiskIntervention i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", i.getId());
        m.put("patientId", i.getPatient().getId());
        m.put("patientName", i.getPatient().fullName());
        m.put("dayNumber", i.getAssessment().getVisit().getDayNumber());
        m.put("riskLevel", i.getRiskLevel());
        m.put("riskReasons", i.getAssessment().getRiskReasons());
        m.put("status", i.getStatus());
        m.put("escalationLevel", i.getEscalationLevel());
        m.put("doctorDecision", i.getDoctorDecision());
        m.put("notes", i.getNotes());
        m.put("openedAt", i.getOpenedAt());
        m.put("closedAt", i.getClosedAt());
        return m;
    }

    static Map<String, Object> physio(PhysiotherapyAppointment a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("carePlanId", a.getCarePlan().getId());
        m.put("patientName", a.getCarePlan().getPatient().fullName());
        m.put("sessionNo", a.getSessionNo());
        m.put("dayNumber", a.getDayNumber());
        m.put("appointmentDate", a.getAppointmentDate());
        m.put("focus", a.getFocus());
        m.put("physiotherapist", a.getPhysiotherapist());
        m.put("status", a.getStatus());
        m.put("notes", a.getNotes());
        return m;
    }

    static Map<String, Object> prescription(Prescription rx) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", rx.getId());
        m.put("patientId", rx.getPatient().getId());
        m.put("patientName", rx.getPatient().fullName());
        m.put("medication", rx.getMedication());
        m.put("dosage", rx.getDosage());
        m.put("quantity", rx.getQuantity());
        m.put("controlled", rx.getControlled());
        m.put("doctorApproved", rx.getDoctorApproved());
        m.put("status", rx.getStatus());
        m.put("pharmacy", rx.getPharmacy());
        m.put("statusReason", rx.getStatusReason());
        return m;
    }

    static Map<String, Object> delivery(MedicationDelivery d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", d.getId());
        m.put("deliveryRef", d.getDeliveryRef());
        m.put("prescriptionId", d.getPrescription().getId());
        m.put("medication", d.getPrescription().getMedication());
        m.put("patientName", d.getPrescription().getPatient().fullName());
        m.put("pharmacy", d.getPharmacy());
        m.put("courier", d.getCourier());
        m.put("status", d.getStatus());
        m.put("dispatchedAt", d.getDispatchedAt());
        m.put("expectedBy", d.getExpectedBy());
        m.put("deliveredAt", d.getDeliveredAt());
        m.put("note", d.getNote());
        return m;
    }

    static Map<String, Object> notification(Notification n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", n.getId());
        m.put("patientName", n.getPatient() == null ? null : n.getPatient().fullName());
        m.put("channel", n.getChannel());
        m.put("recipient", n.getRecipient());
        m.put("subject", n.getSubject());
        m.put("message", n.getMessage());
        m.put("category", n.getCategory());
        m.put("status", n.getStatus());
        m.put("error", n.getError());
        m.put("createdAt", n.getCreatedAt());
        return m;
    }
}
