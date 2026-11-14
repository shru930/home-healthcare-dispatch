package com.homecare.dispatch.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** JPA entity mapped to table pharmacy_stock. */
@Entity
@Table(name = "pharmacy_stock")
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class PharmacyStock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String pharmacy;
    private Boolean partner;
    private String medication;
    private Integer quantity;
}
