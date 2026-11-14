package com.homecare.dispatch.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.homecare.dispatch.exception.ApiException;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Server-side validation of the custom Tasklist forms (same rules the React forms apply). */
class TaskValidationTest {

    final TaskService tasks = new TaskService(null, null, null, null);

    @Test
    void completedAssessmentKeepsOnlyExpectedVariables() {
        Map<String, Object> in = new HashMap<>(Map.of("visitStatus", "COMPLETED", "painScore", "7", "temperature", 37.4,
                "woundRedness", true, "woundDischarge", false, "swelling", "false", "nurseNotes", "ok", "hacker", "x"));
        Map<String, Object> out = tasks.validate("Task_HealthAssessment", in);
        assertThat(out).containsEntry("painScore", 7).containsEntry("woundRedness", true).doesNotContainKey("hacker");
    }

    @Test
    void painScoreOutsideZeroToTenIsRejected() {
        assertThatThrownBy(() -> tasks.validate("Task_HealthAssessment",
                Map.of("visitStatus", "COMPLETED", "painScore", 11, "temperature", 37)))
                .isInstanceOf(ApiException.class).hasMessageContaining("painScore");
    }

    @Test
    void incompleteVisitNeedsNotes() {
        assertThatThrownBy(() -> tasks.validate("Task_HealthAssessment", Map.of("visitStatus", "INCOMPLETE")))
                .isInstanceOf(ApiException.class).hasMessageContaining("nurseNotes");
    }

    @Test
    void doctorDecisionMustBeAKnownValue() {
        assertThatThrownBy(() -> tasks.validate("Task_DoctorReview", Map.of("doctorDecision", "MAYBE", "doctorNotes", "x")))
                .isInstanceOf(ApiException.class).hasMessageContaining("doctorDecision");
        assertThat(tasks.validate("Task_DoctorReview", Map.of("doctorDecision", "READMIT", "doctorNotes", "IV antibiotics")))
                .containsEntry("doctorDecision", "READMIT");
    }

    @Test
    void correctedPhoneMustHaveTenDigits() {
        assertThatThrownBy(() -> tasks.validate("Task_CorrectDischarge", Map.of("patientPhone", "123", "familyPhone", "9876500002",
                "familyEmail", "a@b.co", "dischargeDate", "2026-11-14"))).isInstanceOf(ApiException.class).hasMessageContaining("patientPhone");
    }

    @Test
    void unknownTaskTypeIsRejected() {
        assertThatThrownBy(() -> tasks.validate("Task_Unknown", Map.of())).isInstanceOf(ApiException.class);
    }
}
