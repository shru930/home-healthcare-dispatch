package com.homecare.dispatch.repository;

import com.homecare.dispatch.domain.NurseAssignment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NurseAssignmentRepository extends JpaRepository<NurseAssignment, Long> {

    List<NurseAssignment> findByCarePlanIdOrderByAssignedAtDesc(Long carePlanId);
    List<NurseAssignment> findAllByOrderByAssignedAtDesc();
}
