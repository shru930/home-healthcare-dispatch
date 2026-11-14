package com.homecare.dispatch;

import static org.assertj.core.api.Assertions.assertThat;

import com.homecare.dispatch.config.HomeCareProperties;
import com.homecare.dispatch.service.DistanceCalculator;
import com.homecare.dispatch.service.NurseMatcher;
import com.homecare.dispatch.service.NurseMatcher.Candidate;
import com.homecare.dispatch.service.NurseMatcher.NurseDistance;
import com.homecare.dispatch.service.RiskEvaluator;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** Pure unit tests of the business rules used by the job workers (no Spring context, no engine). */
class DomainLogicTest {

    static final HomeCareProperties PROPS = new HomeCareProperties(true, null, null,
            new HomeCareProperties.Risk(6, 8, 38.0, 39.0), new HomeCareProperties.Matching(60, 3), null, null, null);

    @Nested
    class ReadmissionRisk {
        final RiskEvaluator risk = new RiskEvaluator(PROPS);

        @Test
        void normalWhenAllIndicatorsAreLow() {
            assertThat(risk.evaluate(2, 36.9, false, false, false).riskLevel()).isEqualTo("NORMAL");
        }

        @Test
        void highPainScoreIsElevated() {
            RiskEvaluator.RiskResult r = risk.evaluate(7, 37.0, false, false, false);
            assertThat(r.riskLevel()).isEqualTo("ELEVATED");
            assertThat(r.reasons()).anyMatch(s -> s.startsWith("Pain score 7"));
        }

        @Test
        void severePainIsCritical() {
            assertThat(risk.evaluate(9, 37.0, false, false, false).riskLevel()).isEqualTo("CRITICAL");
        }

        @Test
        void woundRednessAloneIsAnInfectionIndicator() {
            assertThat(risk.evaluate(1, 36.8, true, false, false).riskLevel()).isEqualTo("ELEVATED");
        }

        @Test
        void woundDischargeWithFeverIsCritical() {
            RiskEvaluator.RiskResult r = risk.evaluate(4, 38.6, true, true, false);
            assertThat(r.riskLevel()).isEqualTo("CRITICAL");
            assertThat(r.reasons()).contains("Wound discharge with fever (infection indicator)");
        }

        @Test
        void veryHighTemperatureIsCritical() {
            assertThat(risk.evaluate(2, 39.4, false, false, false).riskLevel()).isEqualTo("CRITICAL");
        }
    }

    @Nested
    class NurseMatching {
        final List<Candidate> candidates = List.of(
                new Candidate(1L, "nurse.anita", "Anita", "1", 13.0067, 80.2206, "WOUND_CARE"),
                new Candidate(3L, "nurse.priya", "Priya", "3", 12.9815, 80.2180, "WOUND_CARE"),
                new Candidate(4L, "nurse.joseph", "Joseph", "4", 12.8230, 80.0440, "WOUND_CARE"));

        @Test
        void picksTheShortestTravelTimeFromADistanceMatrix() {
            Map<String, Object> matrix = Map.of("status", "OK", "rows", List.of(Map.of("elements", List.of(
                    element(4143, 531), element(557, 71), element(30000, 3900)))));
            NurseDistance best = NurseMatcher.nearest(NurseMatcher.fromDistanceMatrix(matrix, candidates), 60).orElseThrow();
            assertThat(best.username()).isEqualTo("nurse.priya");
        }

        @Test
        void elementsWithAnErrorStatusAreUnreachable() {
            Map<String, Object> matrix = Map.of("status", "OK", "rows", List.of(Map.of("elements", List.of(
                    Map.of("status", "ZERO_RESULTS"), element(557, 71)))));
            List<NurseDistance> d = NurseMatcher.fromDistanceMatrix(matrix, candidates);
            assertThat(d.get(0).status()).isEqualTo("ZERO_RESULTS");
            assertThat(d.get(2).status()).isEqualTo("MISSING_ELEMENT");
            assertThat(NurseMatcher.nearest(d, 60).orElseThrow().username()).isEqualTo("nurse.priya");
        }

        @Test
        void nobodyWithinTheTravelLimitGivesEmpty() {
            Map<String, Object> matrix = Map.of("status", "OK", "rows", List.of(Map.of("elements", List.of(
                    element(90000, 7200), element(80000, 6000), element(70000, 5000)))));
            assertThat(NurseMatcher.nearest(NurseMatcher.fromDistanceMatrix(matrix, candidates), 60)).isEmpty();
        }

        @Test
        void straightLineFallbackRanksByDistance() {
            List<NurseDistance> d = NurseMatcher.straightLine(candidates, 12.8231, 80.0444);
            assertThat(NurseMatcher.nearest(d, 60).orElseThrow().username()).isEqualTo("nurse.joseph");
        }

        private Map<String, Object> element(int meters, int seconds) {
            return Map.of("status", "OK", "distance", Map.of("value", meters), "duration", Map.of("value", seconds));
        }
    }

    @Test
    void haversineDistanceIsCorrectForAKnownPair() {
        // Velachery to Guindy is about 3.1 km in a straight line
        double m = DistanceCalculator.haversineMeters(12.9791, 80.2209, 13.0067, 80.2206);
        assertThat(m).isBetween(3000.0, 3200.0);
        assertThat(DistanceCalculator.travelSeconds(DistanceCalculator.roadMeters(12.9791, 80.2209, 13.0067, 80.2206))).isBetween(500, 600);
    }
}
