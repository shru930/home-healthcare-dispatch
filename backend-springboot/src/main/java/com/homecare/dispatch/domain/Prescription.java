package com.homecare.dispatch.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** JPA entity mapped to table prescription. */
@Entity
@Table(name = "prescription")
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Prescription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false) @JoinColumn(name = "patient_id")
    private Patient patient;
    @ManyToOne @JoinColumn(name = "care_plan_id")
    private HomeCarePlan carePlan;
    private String medication;
    private String dosage;
    private Integer quantity;
    private Boolean controlled;
    private Boolean doctorApproved;
    private String status;
    private String pharmacy;
    private String statusReason;
    private java.time.LocalDateTime createdAt;
}
