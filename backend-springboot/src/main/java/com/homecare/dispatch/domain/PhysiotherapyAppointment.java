package com.homecare.dispatch.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** JPA entity mapped to table physiotherapy_appointment. */
@Entity
@Table(name = "physiotherapy_appointment")
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class PhysiotherapyAppointment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false) @JoinColumn(name = "care_plan_id")
    private HomeCarePlan carePlan;
    private Integer sessionNo;
    private Integer dayNumber;
    private java.time.LocalDate appointmentDate;
    private String focus;
    private String physiotherapist;
    private String status;
    private String notes;
}
