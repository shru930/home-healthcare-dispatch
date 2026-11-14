package com.homecare.dispatch.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** JPA entity mapped to table risk_intervention. */
@Entity
@Table(name = "risk_intervention")
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class RiskIntervention {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false) @JoinColumn(name = "assessment_id")
    private HealthAssessment assessment;
    @ManyToOne(optional = false) @JoinColumn(name = "patient_id")
    private Patient patient;
    private String riskLevel;
    private String status;
    private String escalationLevel;
    private String doctorDecision;
    private String notes;
    private java.time.LocalDateTime openedAt;
    private java.time.LocalDateTime closedAt;
}
