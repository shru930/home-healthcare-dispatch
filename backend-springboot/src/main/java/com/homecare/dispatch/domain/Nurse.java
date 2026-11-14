package com.homecare.dispatch.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** JPA entity mapped to table nurse. */
@Entity
@Table(name = "nurse")
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Nurse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String username;
    private String fullName;
    private String phone;
    private String email;
    private String skills;
    private String baseArea;
    private Double latitude;
    private Double longitude;
    private Boolean available;
    private Integer maxPatients;
    private Integer currentPatients;
    private java.time.LocalDateTime createdAt;

    public boolean hasSkill(String skill) { return skill == null || java.util.Arrays.asList(skills.split(",")).contains(skill); }
    public boolean hasCapacity() { return Boolean.TRUE.equals(available) && currentPatients < maxPatients; }
}
