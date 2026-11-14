package com.homecare.dispatch.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** JPA entity mapped to table nurse_assignment. */
@Entity
@Table(name = "nurse_assignment")
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class NurseAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false) @JoinColumn(name = "care_plan_id")
    private HomeCarePlan carePlan;
    @ManyToOne(optional = false) @JoinColumn(name = "nurse_id")
    private Nurse nurse;
    private Integer distanceMeters;
    private Integer travelSeconds;
    private String distanceSource;
    private String assignmentMode;
    private String note;
    private java.time.LocalDateTime assignedAt;
}
