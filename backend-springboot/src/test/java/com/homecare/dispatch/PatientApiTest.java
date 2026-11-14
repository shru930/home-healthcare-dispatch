package com.homecare.dispatch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.homecare.dispatch.domain.Nurse;
import com.homecare.dispatch.domain.Patient;
import com.homecare.dispatch.dto.Dtos.WorkflowStartResponse;
import com.homecare.dispatch.repository.NurseRepository;
import com.homecare.dispatch.repository.PharmacyStockRepository;
import com.homecare.dispatch.service.PatientService;
import com.homecare.dispatch.web.ApiControllers;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** REST layer: request validation, status codes and the uniform error body. */
@WebMvcTest(ApiControllers.PatientController.class)
@ActiveProfiles("test")
class PatientApiTest {
    @Autowired MockMvc mvc;
    @MockitoBean PatientService patients;

    static final String VALID = """
            {"mrn":"MRN-1","firstName":"Lakshmi","lastName":"Iyer","dateOfBirth":"1958-04-12","phone":"9876500001",
             "addressLine":"12 Lake View Road","city":"Chennai","latitude":12.9791,"longitude":80.2209,
             "familyContactName":"Arun","familyContactPhone":"9876500002","familyContactEmail":"arun@example.com"}""";

    @Test
    void registersAValidPatient() throws Exception {
        Patient p = new Patient();
        p.setId(1L);
        p.setMrn("MRN-1");
        p.setFirstName("Lakshmi");
        p.setLastName("Iyer");
        p.setStatus("REGISTERED");
        p.setCreatedAt(LocalDateTime.now());
        when(patients.register(any())).thenReturn(p);
        mvc.perform(post("/api/patients").contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("Lakshmi Iyer"));
    }

    @Test
    void rejectsAnInvalidPhoneWithFieldDetails() throws Exception {
        mvc.perform(post("/api/patients").contentType(MediaType.APPLICATION_JSON).content(VALID.replace("9876500001", "12345")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.details[0]").value("phone: must be 10 digits"));
    }

    @Test
    void dischargeRequiresAtLeastOnePrescription() throws Exception {
        String body = """
                {"surgeryType":"Knee","surgeryDate":"%s","dischargeDate":"%s","hospital":"City General","doctorName":"Dr Rao",
                 "doctorEmail":"rao@example.com","prescriptions":[]}""".formatted(LocalDate.now().minusDays(3), LocalDate.now());
        mvc.perform(post("/api/patients/1/discharge").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void dischargeStartsTheWorkflow() throws Exception {
        when(patients.discharge(eq(1L), any())).thenReturn(new WorkflowStartResponse(9L, 2251799813685249L, 1L, "ACTIVE", "Validating discharge details"));
        String body = """
                {"surgeryType":"Knee","surgeryDate":"%s","dischargeDate":"%s","hospital":"City General","doctorName":"Dr Rao",
                 "doctorEmail":"rao@example.com","physioSessions":[{"dayNumber":2,"focus":"Mobility"}],
                 "prescriptions":[{"medication":"Paracetamol 500mg","dosage":"1 tab","quantity":21}]}""".formatted(LocalDate.now().minusDays(3), LocalDate.now());
        mvc.perform(post("/api/patients/1/discharge").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.processInstanceKey").value(2251799813685249L));
    }
}

