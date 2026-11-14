package com.homecare.dispatch.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** JPA entity mapped to table health_assessment. */
@Entity
@Table(name = "health_assessment")
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class HealthAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false) @JoinColumn(name = "visit_id")
    private HomeCareVisit visit;
    private Integer painScore;
    private Double temperature;
    private Boolean woundRedness;
    private Boolean woundDischarge;
    private Boolean swelling;
    private String nurseNotes;
    private String riskLevel;
    private String riskReasons;
    private java.time.LocalDateTime assessedAt;
}
