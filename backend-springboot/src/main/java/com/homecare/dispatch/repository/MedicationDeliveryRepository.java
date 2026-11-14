package com.homecare.dispatch.repository;

import com.homecare.dispatch.domain.MedicationDelivery;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MedicationDeliveryRepository extends JpaRepository<MedicationDelivery, Long> {

    java.util.Optional<MedicationDelivery> findByDeliveryRef(String deliveryRef);
    List<MedicationDelivery> findByPrescriptionIdOrderByIdDesc(Long prescriptionId);
    List<MedicationDelivery> findAllByOrderByIdDesc();
    long countByStatusIn(java.util.Collection<String> statuses);
}
