package com.homecare.dispatch.repository;

import com.homecare.dispatch.domain.HomeCareVisit;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HomeCareVisitRepository extends JpaRepository<HomeCareVisit, Long> {

    List<HomeCareVisit> findByCarePlanIdOrderByDayNumberAsc(Long carePlanId);
    java.util.Optional<HomeCareVisit> findByCarePlanIdAndDayNumber(Long carePlanId, Integer dayNumber);
    long countByStatus(String status);
    List<HomeCareVisit> findAllByOrderByVisitDateAscDayNumberAsc();
}
