package com.homecare.dispatch.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** JPA entity mapped to table patient. */
@Entity
@Table(name = "patient")
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Patient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String mrn;
    private String firstName;
    private String lastName;
    private java.time.LocalDate dateOfBirth;
    private String gender;
    private String phone;
    private String email;
    private String addressLine;
    private String city;
    private String postalCode;
    private Double latitude;
    private Double longitude;
    private String familyContactName;
    private String familyContactPhone;
    private String familyContactEmail;
    private String surgeryType;
    private java.time.LocalDate surgeryDate;
    private java.time.LocalDate dischargeDate;
    private String hospital;
    private String doctorName;
    private String doctorEmail;
    private String status;
    private java.time.LocalDateTime createdAt;
    private java.time.LocalDateTime updatedAt;

    public String fullName() { return firstName + " " + lastName; }
}
