package com.homecare.dispatch.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** JPA entity mapped to table workflow_instance. */
@Entity
@Table(name = "workflow_instance")
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class WorkflowInstance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false) @JoinColumn(name = "patient_id")
    private Patient patient;
    private Long processInstanceKey;
    private String processDefinitionId;
    private String status;
    private String currentStage;
    private String planOutcome;
    private String lastError;
    private java.time.LocalDateTime startedAt;
    private java.time.LocalDateTime endedAt;
}
