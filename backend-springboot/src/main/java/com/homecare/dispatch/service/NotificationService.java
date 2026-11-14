package com.homecare.dispatch.service;

import com.homecare.dispatch.config.DemoMailServer;
import com.homecare.dispatch.domain.Notification;
import com.homecare.dispatch.domain.Patient;
import com.homecare.dispatch.repository.NotificationRepository;
import com.homecare.dispatch.repository.PatientRepository;
import jakarta.mail.Address;
import jakarta.mail.Message;
import jakarta.mail.internet.MimeMessage;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Notification log. E-mail and SMS are SENT by Camunda Outbound Connectors (Email connector and REST
 * connector); this service records what was delivered, what failed, and in-app alerts for staff.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notifications;
    private final PatientRepository patients;
    private final DemoMailServer mailServer;

    @Transactional
    public Notification record(Long patientId, String channel, String recipient, String subject, String message,
                               String category, String status, String providerRef, String error) {
        Notification n = new Notification();
        if (patientId != null) {
            n.setPatient(patients.findById(patientId).orElse(null));
        }
        n.setChannel(channel);
        n.setRecipient(recipient == null ? "unknown" : recipient);
        n.setSubject(subject);
        n.setMessage(truncate(message, 2000));
        n.setCategory(category);
        n.setStatus(status);
        n.setProviderRef(providerRef);
        n.setError(truncate(error, 500));
        n.setCreatedAt(LocalDateTime.now());
        return notifications.save(n);
    }

    /** In-app alert for doctors / coordinators, shown on the React Alerts page. */
    public Notification alert(Long patientId, String recipientRole, String subject, String message, String category) {
        return record(patientId, "IN_APP", recipientRole, subject, message, category, "SENT", null, null);
    }

    /** DEMO MODE: copies e-mails received by the embedded SMTP server into the notification log. */
    @Scheduled(fixedDelay = 3000)
    @Transactional
    public void ingestDemoMailbox() {
        for (MimeMessage m : mailServer.receivedMessages()) {
            try {
                String ref = m.getMessageID();
                if (ref == null || notifications.existsByProviderRef(ref)) {
                    continue;
                }
                Address[] to = m.getRecipients(Message.RecipientType.TO);
                String recipient = to == null || to.length == 0 ? "unknown" : to[0].toString();
                Long patientId = patients.findFirstByFamilyContactEmailIgnoreCaseOrderByIdDesc(recipient).map(Patient::getId).orElse(null);
                String subject = m.getSubject();
                String category = subject != null && subject.toLowerCase().contains("care plan complete") ? "FINAL_STATUS" : "NURSE_ASSIGNMENT";
                record(patientId, "EMAIL", recipient, subject, String.valueOf(m.getContent()).trim(), category, "SENT", ref, null);
            } catch (Exception e) {
                log.warn("Could not ingest demo e-mail: {}", e.getMessage());
            }
        }
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
