package com.homecare.dispatch.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** JPA entity mapped to table medication_delivery. */
@Entity
@Table(name = "medication_delivery")
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class MedicationDelivery {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false) @JoinColumn(name = "prescription_id")
    private Prescription prescription;
    private String deliveryRef;
    private String pharmacy;
    private String courier;
    private String status;
    private java.time.LocalDateTime dispatchedAt;
    private java.time.LocalDateTime expectedBy;
    private java.time.LocalDateTime deliveredAt;
    private String note;
}
