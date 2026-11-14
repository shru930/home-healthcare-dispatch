package com.homecare.dispatch.repository;

import com.homecare.dispatch.domain.Prescription;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PrescriptionRepository extends JpaRepository<Prescription, Long> {

    List<Prescription> findByPatientIdOrderByIdAsc(Long patientId);
    List<Prescription> findByCarePlanIdOrderByIdAsc(Long carePlanId);
    List<Prescription> findAllByOrderByIdDesc();
}
