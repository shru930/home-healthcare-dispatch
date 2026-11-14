package com.homecare.dispatch.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** JPA entity mapped to table home_care_plan. */
@Entity
@Table(name = "home_care_plan")
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class HomeCarePlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false) @JoinColumn(name = "patient_id")
    private Patient patient;
    @ManyToOne(optional = false) @JoinColumn(name = "workflow_instance_id")
    private WorkflowInstance workflowInstance;
    private java.time.LocalDate startDate;
    private java.time.LocalDate endDate;
    private String requiredSkill;
    private String status;
    private String planOutcome;
    private String summary;
    private java.time.LocalDateTime createdAt;
}
