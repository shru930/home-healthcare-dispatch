package com.homecare.dispatch.repository;

import com.homecare.dispatch.domain.RiskIntervention;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RiskInterventionRepository extends JpaRepository<RiskIntervention, Long> {

    List<RiskIntervention> findByPatientIdOrderByOpenedAtDesc(Long patientId);
    List<RiskIntervention> findAllByOrderByOpenedAtDesc();
    long countByRiskLevelAndClosedAtIsNull(String riskLevel);
}
