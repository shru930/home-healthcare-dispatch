package com.homecare.dispatch.repository;

import com.homecare.dispatch.domain.PhysiotherapyAppointment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PhysiotherapyAppointmentRepository extends JpaRepository<PhysiotherapyAppointment, Long> {

    List<PhysiotherapyAppointment> findByCarePlanIdOrderBySessionNoAsc(Long carePlanId);
    List<PhysiotherapyAppointment> findAllByOrderByAppointmentDateAscSessionNoAsc();
}
