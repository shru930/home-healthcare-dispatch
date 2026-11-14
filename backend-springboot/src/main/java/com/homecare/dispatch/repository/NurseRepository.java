package com.homecare.dispatch.repository;

import com.homecare.dispatch.domain.Nurse;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NurseRepository extends JpaRepository<Nurse, Long> {

    java.util.Optional<Nurse> findByUsername(String username);
    List<Nurse> findByAvailableTrueOrderByIdAsc();
    long countByAvailableTrue();
}
