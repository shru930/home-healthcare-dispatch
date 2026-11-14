package com.homecare.dispatch.repository;

import com.homecare.dispatch.domain.PharmacyStock;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PharmacyStockRepository extends JpaRepository<PharmacyStock, Long> {

    java.util.Optional<PharmacyStock> findFirstByMedicationIgnoreCaseAndPartnerFalseAndQuantityGreaterThanEqual(String medication, Integer quantity);
    java.util.Optional<PharmacyStock> findFirstByMedicationIgnoreCaseAndPartnerTrueAndQuantityGreaterThanEqual(String medication, Integer quantity);
    List<PharmacyStock> findAllByOrderByPharmacyAscMedicationAsc();
}
