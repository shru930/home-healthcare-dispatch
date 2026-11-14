package com.homecare.dispatch.worker;

import com.homecare.dispatch.domain.MedicationDelivery;
import com.homecare.dispatch.dto.Payloads.PrescriptionItem;
import com.homecare.dispatch.service.NotificationService;
import com.homecare.dispatch.service.PharmacyService;
import io.camunda.client.annotation.JobWorker;
import io.camunda.client.annotation.Variable;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Workers of the reusable child process pharmacy-prescription-fulfillment (called once per prescription). */
@Component
@RequiredArgsConstructor
public class PharmacyWorkers {

    private final PharmacyService pharmacy;
    private final NotificationService notifications;

    @JobWorker(type = "rx.verify-prescription")
    public Map<String, Object> verifyPrescription(@Variable PrescriptionItem prescription) {
        PharmacyService.Verification v = pharmacy.verify(prescription.prescriptionId());
        Map<String, Object> out = new HashMap<>();
        out.put("rxValid", v.valid());
        out.put("rxRejectionReason", v.reason());
        return out;
    }

    @JobWorker(type = "rx.notify-rejection")
    public Map<String, Object> notifyRejection(@Variable Long patientId, @Variable PrescriptionItem prescription,
                                               @Variable String rxRejectionReason) {
        notifications.alert(patientId, "prescribing doctor", "Prescription rejected: " + prescription.medication(),
                rxRejectionReason + ". Please review and re-issue.", "PRESCRIPTION_REJECTED");
        return Map.of("fulfillmentStatus", "REJECTED", "fulfillmentNote", rxRejectionReason);
    }

    @JobWorker(type = "rx.check-stock")
    public Map<String, Object> checkStock(@Variable PrescriptionItem prescription) {
        PharmacyService.StockResult s = pharmacy.reserve(prescription.prescriptionId(), false);
        Map<String, Object> out = new HashMap<>();
        out.put("stockStatus", s.available() ? "IN_STOCK" : "OUT_OF_STOCK");
        out.put("pharmacyName", s.pharmacy());
        return out;
    }

    @JobWorker(type = "rx.source-partner")
    public Map<String, Object> sourcePartner(@Variable PrescriptionItem prescription) {
        PharmacyService.StockResult s = pharmacy.reserve(prescription.prescriptionId(), true);
        Map<String, Object> out = new HashMap<>();
        out.put("partnerFound", s.available());
        out.put("pharmacyName", s.pharmacy());
        return out;
    }

    @JobWorker(type = "rx.mark-unavailable")
    public Map<String, Object> markUnavailable(@Variable Long patientId, @Variable PrescriptionItem prescription) {
        pharmacy.setPrescriptionStatus(prescription.prescriptionId(), "UNAVAILABLE", "Not available at primary or partner pharmacies");
        notifications.alert(patientId, "coordinator", "Medication unavailable: " + prescription.medication(),
                "Ask the doctor for a substitute medicine.", "PRESCRIPTION_UNAVAILABLE");
        return Map.of("fulfillmentStatus", "UNAVAILABLE", "fulfillmentNote", "Not in stock at any pharmacy");
    }

    /** Throws COURIER_UNAVAILABLE (modelled error) through PharmacyService when no courier can be booked. */
    @JobWorker(type = "rx.dispatch-delivery")
    public Map<String, Object> dispatchDelivery(@Variable PrescriptionItem prescription) {
        MedicationDelivery d = pharmacy.dispatch(prescription.prescriptionId());
        return Map.of("deliveryRef", d.getDeliveryRef(), "courier", d.getCourier(), "expectedBy", d.getExpectedBy().toString());
    }

    @JobWorker(type = "rx.reschedule-delivery")
    public Map<String, Object> rescheduleDelivery(@Variable Long patientId, @Variable PrescriptionItem prescription) {
        pharmacy.setPrescriptionStatus(prescription.prescriptionId(), "DELAYED", "No courier available; delivery rescheduled");
        notifications.alert(patientId, "coordinator", "Delivery delayed: " + prescription.medication(),
                "No courier was available. The pharmacy will retry on the next delivery round.", "DELIVERY_DELAYED");
        return Map.of("fulfillmentStatus", "DELAYED", "fulfillmentNote", "No courier available; rescheduled");
    }

    @JobWorker(type = "rx.mark-delivery-failed")
    public Map<String, Object> markDeliveryFailed(@Variable Long patientId, @Variable String deliveryRef, @Variable PrescriptionItem prescription) {
        pharmacy.setDeliveryStatus(deliveryRef, "FAILED", "Not confirmed within the delivery deadline");
        notifications.alert(patientId, "coordinator", "Delivery failed: " + prescription.medication(),
                "Delivery " + deliveryRef + " was not confirmed in time.", "DELIVERY_FAILED");
        return Map.of("fulfillmentStatus", "FAILED", "fulfillmentNote", "Delivery not confirmed in time");
    }

    @JobWorker(type = "rx.record-delivery")
    public Map<String, Object> recordDelivery(@Variable String deliveryRef) {
        MedicationDelivery d = pharmacy.setDeliveryStatus(deliveryRef, "DELIVERED", "Confirmed by courier");
        return Map.of("fulfillmentStatus", "DELIVERED", "deliveredAt", d.getDeliveredAt().toString(), "fulfillmentNote", "Delivered");
    }
}
