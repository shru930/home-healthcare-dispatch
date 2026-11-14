package com.homecare.dispatch.repository;

import com.homecare.dispatch.domain.WorkflowInstance;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowInstanceRepository extends JpaRepository<WorkflowInstance, Long> {

    java.util.Optional<WorkflowInstance> findByProcessInstanceKey(Long key);
    List<WorkflowInstance> findByPatientIdOrderByStartedAtDesc(Long patientId);
    List<WorkflowInstance> findAllByOrderByStartedAtDesc();
    long countByStatus(String status);
}
