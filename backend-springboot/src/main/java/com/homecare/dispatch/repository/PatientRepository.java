package com.homecare.dispatch.repository;

import com.homecare.dispatch.domain.Patient;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientRepository extends JpaRepository<Patient, Long> {

    java.util.Optional<Patient> findByMrn(String mrn);
    long countByStatus(String status);
    java.util.Optional<Patient> findFirstByFamilyContactEmailIgnoreCaseOrderByIdDesc(String email);
    java.util.Optional<Patient> findFirstByFamilyContactPhoneOrderByIdDesc(String phone);
    List<Patient> findAllByOrderByIdDesc();
}
