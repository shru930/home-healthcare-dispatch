package com.homecare.dispatch.service;

import com.homecare.dispatch.config.DemoFaults;
import com.homecare.dispatch.domain.MedicationDelivery;
import com.homecare.dispatch.domain.PharmacyStock;
import com.homecare.dispatch.domain.Prescription;
import com.homecare.dispatch.exception.ApiException;
import com.homecare.dispatch.repository.MedicationDeliveryRepository;
import com.homecare.dispatch.repository.PharmacyStockRepository;
import com.homecare.dispatch.repository.PrescriptionRepository;
import io.camunda.zeebe.spring.common.exception.ZeebeBpmnError;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Prescription verification, stock reservation, courier dispatch and delivery tracking. */
@Service
@RequiredArgsConstructor
public class PharmacyService {

    public static final int MAX_QUANTITY_WITHOUT_REVIEW = 90;

    private final PrescriptionRepository prescriptions;
    private final PharmacyStockRepository stock;
    private final MedicationDeliveryRepository deliveries;
    private final DemoFaults faults;

    public record Verification(boolean valid, String reason) {}

    public record StockResult(boolean available, String pharmacy) {}

    public Prescription get(Long id) {
        return prescriptions.findById(id).orElseThrow(() -> ApiException.notFound("Prescription", id));
    }

    @Transactional
    public Verification verify(Long prescriptionId) {
        Prescription rx = get(prescriptionId);
        String reason = null;
        if (Boolean.TRUE.equals(rx.getControlled()) && !Boolean.TRUE.equals(rx.getDoctorApproved())) {
            reason = "Controlled medicine requires the prescribing doctor's approval";
        } else if (rx.getQuantity() > MAX_QUANTITY_WITHOUT_REVIEW) {
            reason = "Quantity " + rx.getQuantity() + " exceeds the 7-day home-care limit of " + MAX_QUANTITY_WITHOUT_REVIEW;
        } else if (rx.getDosage() == null || rx.getDosage().isBlank()) {
            reason = "Dosage instructions are missing";
        }
        rx.setStatus(reason == null ? "VERIFIED" : "REJECTED");
        rx.setStatusReason(reason);
        return new Verification(reason == null, reason);
    }

    /** Reserves stock at the primary pharmacy (partner=false) or, when asked, at a partner pharmacy. */
    @Transactional
    public StockResult reserve(Long prescriptionId, boolean partner) {
        Prescription rx = get(prescriptionId);
        if (rx.getPharmacy() != null && ("RESERVED".equals(rx.getStatus()) || "DISPATCHED".equals(rx.getStatus()))) {
            return new StockResult(true, rx.getPharmacy()); // idempotent on job retry
        }
        Optional<PharmacyStock> s = partner
                ? stock.findFirstByMedicationIgnoreCaseAndPartnerTrueAndQuantityGreaterThanEqual(rx.getMedication(), rx.getQuantity())
                : stock.findFirstByMedicationIgnoreCaseAndPartnerFalseAndQuantityGreaterThanEqual(rx.getMedication(), rx.getQuantity());
        if (s.isEmpty()) {
            rx.setStatus(partner ? "UNAVAILABLE" : "OUT_OF_STOCK");
            rx.setStatusReason(partner ? "Not in stock at any partner pharmacy" : "Out of stock at the primary pharmacy");
            return new StockResult(false, null);
        }
        PharmacyStock found = s.get();
        found.setQuantity(found.getQuantity() - rx.getQuantity());
        rx.setStatus("RESERVED");
        rx.setPharmacy(found.getPharmacy());
        rx.setStatusReason(null);
        return new StockResult(true, found.getPharmacy());
    }

    /** Books a courier. Throws the modelled BPMN error COURIER_UNAVAILABLE when no courier can be booked. */
    @Transactional
    public MedicationDelivery dispatch(Long prescriptionId) {
        Prescription rx = get(prescriptionId);
        Optional<MedicationDelivery> existing = deliveries.findByPrescriptionIdOrderByIdDesc(prescriptionId).stream()
                .filter(d -> "DISPATCHED".equals(d.getStatus())).findFirst();
        if (existing.isPresent()) {
            return existing.get();
        }
        if (faults.is(DemoFaults.Fault.COURIER, "UNAVAILABLE")) {
            throw new ZeebeBpmnError("COURIER_UNAVAILABLE", "No courier available for " + rx.getMedication(),
                    Map.of("fulfillmentNote", "No courier available, delivery rescheduled"));
        }
        MedicationDelivery d = new MedicationDelivery();
        d.setPrescription(rx);
        d.setDeliveryRef("PENDING");
        d.setPharmacy(rx.getPharmacy());
        d.setCourier("SwiftMeds Courier");
        d.setStatus("DISPATCHED");
        d.setDispatchedAt(LocalDateTime.now());
        d.setExpectedBy(LocalDateTime.now().plusHours(3));
        d = deliveries.save(d);
        d.setDeliveryRef("DLV-" + d.getId());
        rx.setStatus("DISPATCHED");
        return d;
    }

    @Transactional
    public void setPrescriptionStatus(Long prescriptionId, String status, String reason) {
        Prescription rx = get(prescriptionId);
        rx.setStatus(status);
        rx.setStatusReason(reason);
    }

    @Transactional
    public MedicationDelivery setDeliveryStatus(String deliveryRef, String status, String note) {
        MedicationDelivery d = deliveries.findByDeliveryRef(deliveryRef).orElseThrow(() -> ApiException.notFound("Delivery", deliveryRef));
        d.setStatus(status);
        if (note != null) d.setNote(note);
        if ("DELIVERED".equals(status)) {
            d.setDeliveredAt(LocalDateTime.now());
            d.getPrescription().setStatus("DELIVERED");
        } else if ("FAILED".equals(status) || "DELAYED".equals(status)) {
            d.getPrescription().setStatus(status.equals("FAILED") ? "DELIVERY_FAILED" : "DELAYED");
        }
        return d;
    }

    public MedicationDelivery delivery(String deliveryRef) {
        return deliveries.findByDeliveryRef(deliveryRef).orElseThrow(() -> ApiException.notFound("Delivery", deliveryRef));
    }
}
