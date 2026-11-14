package com.homecare.dispatch.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** JPA entity mapped to table notification. */
@Entity
@Table(name = "notification")
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne @JoinColumn(name = "patient_id")
    private Patient patient;
    private String channel;
    private String recipient;
    private String subject;
    private String message;
    private String category;
    private String status;
    private String providerRef;
    private String error;
    private java.time.LocalDateTime createdAt;
}
