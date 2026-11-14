package com.homecare.dispatch.repository;

import com.homecare.dispatch.domain.HealthAssessment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HealthAssessmentRepository extends JpaRepository<HealthAssessment, Long> {

    List<HealthAssessment> findByVisitCarePlanIdOrderByAssessedAtAsc(Long carePlanId);
    List<HealthAssessment> findAllByOrderByAssessedAtDesc();
}
