package com.homecare.dispatch.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** JPA entity mapped to table home_care_visit. */
@Entity
@Table(name = "home_care_visit")
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class HomeCareVisit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false) @JoinColumn(name = "care_plan_id")
    private HomeCarePlan carePlan;
    private Integer dayNumber;
    private java.time.LocalDate visitDate;
    private String visitType;
    @ManyToOne @JoinColumn(name = "nurse_id")
    private Nurse nurse;
    private String status;
    private String notes;
    private java.time.LocalDateTime completedAt;
}
