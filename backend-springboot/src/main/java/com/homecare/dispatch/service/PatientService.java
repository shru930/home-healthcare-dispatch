package com.homecare.dispatch.service;

import com.homecare.dispatch.domain.Patient;
import com.homecare.dispatch.domain.Prescription;
import com.homecare.dispatch.dto.Dtos.DischargeRequest;
import com.homecare.dispatch.dto.Dtos.PatientRequest;
import com.homecare.dispatch.dto.Dtos.WorkflowStartResponse;
import com.homecare.dispatch.exception.ApiException;
import com.homecare.dispatch.repository.PatientRepository;
import com.homecare.dispatch.repository.PrescriptionRepository;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class PatientService {

    private final PatientRepository patients;
    private final PrescriptionRepository prescriptions;
    private final WorkflowService workflows;
    private final TransactionTemplate tx;

    @Transactional
    public Patient register(PatientRequest r) {
        if (patients.findByMrn(r.mrn()).isPresent()) {
            throw ApiException.conflict("A patient with MRN " + r.mrn() + " is already registered");
        }
        Patient p = new Patient();
        p.setMrn(r.mrn());
        p.setFirstName(r.firstName());
        p.setLastName(r.lastName());
        p.setDateOfBirth(r.dateOfBirth());
        p.setGender(r.gender());
        p.setPhone(r.phone());
        p.setEmail(r.email());
        p.setAddressLine(r.addressLine());
        p.setCity(r.city());
        p.setPostalCode(r.postalCode());
        p.setLatitude(r.latitude());
        p.setLongitude(r.longitude());
        p.setFamilyContactName(r.familyContactName());
        p.setFamilyContactPhone(r.familyContactPhone());
        p.setFamilyContactEmail(r.familyContactEmail());
        p.setStatus("REGISTERED");
        p.setCreatedAt(LocalDateTime.now());
        p.setUpdatedAt(LocalDateTime.now());
        return patients.save(p);
    }

    public List<Patient> list() {
        return patients.findAllByOrderByIdDesc();
    }

    public Patient get(Long id) {
        return patients.findById(id).orElseThrow(() -> ApiException.notFound("Patient", id));
    }

    /**
     * Records the discharge, stores the prescriptions and starts the seven-day home-care workflow.
     * The DB transaction commits before the process starts so the workers can read the records.
     */
    public WorkflowStartResponse discharge(Long id, DischargeRequest d) {
        Patient p = tx.execute(status -> saveDischarge(id, d)); // committed before the process starts
        List<Prescription> rx = prescriptions.findByPatientIdOrderByIdAsc(p.getId()).stream()
                .filter(x -> x.getCarePlan() == null && "PRESCRIBED".equals(x.getStatus())).toList();
        try {
            return workflows.start(p, d, rx);
        } catch (ApiException e) {
            // Engine unavailable: undo the discharge so the coordinator can simply retry later.
            tx.executeWithoutResult(status -> {
                Patient back = get(id);
                back.setStatus("REGISTERED");
                back.setUpdatedAt(LocalDateTime.now());
                rx.forEach(x -> prescriptions.findById(x.getId()).ifPresent(r -> {
                    r.setStatus("CANCELLED");
                    r.setStatusReason("Workflow could not be started");
                }));
            });
            throw e;
        }
    }

    private Patient saveDischarge(Long id, DischargeRequest d) {
        Patient p = get(id);
        if ("IN_CARE".equals(p.getStatus())) {
            throw ApiException.conflict("Patient " + p.getMrn() + " already has an active home-care plan");
        }
        if (d.dischargeDate().isBefore(d.surgeryDate())) {
            throw ApiException.badRequest("dischargeDate: must not be before surgeryDate");
        }
        p.setSurgeryType(d.surgeryType());
        p.setSurgeryDate(d.surgeryDate());
        p.setDischargeDate(d.dischargeDate());
        p.setHospital(d.hospital());
        p.setDoctorName(d.doctorName());
        p.setDoctorEmail(d.doctorEmail());
        p.setStatus("IN_CARE");
        p.setUpdatedAt(LocalDateTime.now());
        for (var in : d.prescriptions()) {
            Prescription rx = new Prescription();
            rx.setPatient(p);
            rx.setMedication(in.medication());
            rx.setDosage(in.dosage());
            rx.setQuantity(in.quantity());
            rx.setControlled(in.controlled());
            rx.setDoctorApproved(in.doctorApproved());
            rx.setStatus("PRESCRIBED");
            rx.setCreatedAt(LocalDateTime.now());
            prescriptions.save(rx);
        }
        return patients.save(p);
    }
}
