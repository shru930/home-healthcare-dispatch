package com.homecare.dispatch.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Picks the nearest suitable nurse. Works on either a Google Distance Matrix response
 * (rows[0].elements[i] lines up with candidate i) or on fallback straight-line estimates.
 */
public final class NurseMatcher {

    public record Candidate(Long nurseId, String username, String fullName, String phone, Double latitude, Double longitude, String skills) {}

    public record NurseDistance(Long nurseId, String username, String fullName, Integer distanceMeters, Integer travelSeconds, String status) {}

    private NurseMatcher() {}

    /** Parses a Distance Matrix body. Elements with a non-OK status, or missing elements, are marked unreachable. */
    @SuppressWarnings("unchecked")
    public static List<NurseDistance> fromDistanceMatrix(Map<String, Object> matrix, List<Candidate> candidates) {
        List<NurseDistance> out = new ArrayList<>();
        List<Map<String, Object>> elements = List.of();
        if (matrix != null && "OK".equals(matrix.get("status")) && matrix.get("rows") instanceof List<?> rows && !rows.isEmpty()) {
            Object first = ((Map<String, Object>) rows.get(0)).get("elements");
            if (first instanceof List<?> list) {
                elements = (List<Map<String, Object>>) list;
            }
        }
        for (int i = 0; i < candidates.size(); i++) {
            Candidate c = candidates.get(i);
            if (i >= elements.size() || !"OK".equals(elements.get(i).get("status"))) {
                String status = i >= elements.size() ? "MISSING_ELEMENT" : String.valueOf(elements.get(i).get("status"));
                out.add(new NurseDistance(c.nurseId(), c.username(), c.fullName(), null, null, status));
                continue;
            }
            Map<String, Object> e = elements.get(i);
            int meters = ((Number) ((Map<String, Object>) e.get("distance")).get("value")).intValue();
            int seconds = ((Number) ((Map<String, Object>) e.get("duration")).get("value")).intValue();
            out.add(new NurseDistance(c.nurseId(), c.username(), c.fullName(), meters, seconds, "OK"));
        }
        return out;
    }

    public static List<NurseDistance> straightLine(List<Candidate> candidates, double patientLat, double patientLng) {
        return candidates.stream().map(c -> {
            int meters = DistanceCalculator.roadMeters(patientLat, patientLng, c.latitude(), c.longitude());
            return new NurseDistance(c.nurseId(), c.username(), c.fullName(), meters, DistanceCalculator.travelSeconds(meters), "OK");
        }).toList();
    }

    /** Nearest reachable nurse within the travel limit, or empty when nobody qualifies. */
    public static Optional<NurseDistance> nearest(List<NurseDistance> distances, int maxTravelMinutes) {
        return distances.stream()
                .filter(d -> "OK".equals(d.status()) && d.travelSeconds() != null && d.travelSeconds() <= maxTravelMinutes * 60)
                .min(Comparator.comparing(NurseDistance::travelSeconds));
    }
}
