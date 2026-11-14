package com.homecare.dispatch.repository;

import com.homecare.dispatch.domain.Notification;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByPatientIdOrderByCreatedAtDesc(Long patientId);
    List<Notification> findTop100ByOrderByCreatedAtDesc();
    boolean existsByProviderRef(String providerRef);
    long countByStatus(String status);
}
