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

/** Runs the real Flyway migrations (V1 schema + V2 seed) on H2 in PostgreSQL mode and validates the JPA mapping. */
@DataJpaTest
@ActiveProfiles("test")
class PersistenceTest {
    @Autowired NurseRepository nurses;
    @Autowired PharmacyStockRepository stock;

    @Test
    void seedDataIsLoadedAndQueryable() {
        assertThat(nurses.findAll()).hasSize(5);
        assertThat(nurses.findByAvailableTrueOrderByIdAsc()).extracting(Nurse::getUsername).doesNotContain("nurse.kavya");
        assertThat(nurses.findByUsername("nurse.priya")).get().matches(n -> n.hasSkill("WOUND_CARE") && n.hasCapacity());
    }

    @Test
    void stockLookupDistinguishesPrimaryAndPartnerPharmacies() {
        assertThat(stock.findFirstByMedicationIgnoreCaseAndPartnerFalseAndQuantityGreaterThanEqual("enoxaparin 40mg", 1)).isEmpty();
        assertThat(stock.findFirstByMedicationIgnoreCaseAndPartnerTrueAndQuantityGreaterThanEqual("Enoxaparin 40mg", 7)).isPresent();
    }
}


