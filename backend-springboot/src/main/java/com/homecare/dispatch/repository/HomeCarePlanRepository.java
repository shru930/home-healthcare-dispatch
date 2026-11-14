package com.homecare.dispatch.repository;

import com.homecare.dispatch.domain.HomeCarePlan;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HomeCarePlanRepository extends JpaRepository<HomeCarePlan, Long> {

    java.util.Optional<HomeCarePlan> findByWorkflowInstanceId(Long workflowInstanceId);
    long countByStatus(String status);
    List<HomeCarePlan> findAllByOrderByCreatedAtDesc();
}
