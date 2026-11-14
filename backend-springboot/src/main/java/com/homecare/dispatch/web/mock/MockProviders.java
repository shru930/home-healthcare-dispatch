package com.homecare.dispatch.web.mock;

import com.homecare.dispatch.config.DemoFaults;
import com.homecare.dispatch.config.HomeCareProperties;
import com.homecare.dispatch.domain.Patient;
import com.homecare.dispatch.repository.PatientRepository;
import com.homecare.dispatch.service.DistanceCalculator;
import com.homecare.dispatch.service.NotificationService;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * DEMO / MOCK MODE providers. They stand in for Google Distance Matrix and a commercial SMS gateway when no
 * real credentials are configured. The Camunda REST connector calls them through {{secrets.*}} URLs, so
 * switching to the real providers is a configuration change only (see .env.example).
 */
public final class MockProviders {

    private MockProviders() {}

    /** Same request and response format as https://maps.googleapis.com/maps/api/distancematrix/json */
    @lombok.extern.slf4j.Slf4j
    @RestController
    @RequestMapping("/mock/google/maps/api/distancematrix")
    @RequiredArgsConstructor
    public static class MockDistanceMatrixController {
        private final DemoFaults faults;
        private final HomeCareProperties props;

        @GetMapping("/json")
        public ResponseEntity<Map<String, Object>> distanceMatrix(@RequestParam String origins, @RequestParam String destinations,
                                                                  @RequestParam(required = false) String key,
                                                                  @RequestParam(required = false, defaultValue = "driving") String mode) {
            String expected = props.google().apiKey();
            if (key == null || key.isBlank() || (expected != null && !expected.isBlank() && !expected.equals(key))
                    || faults.is(DemoFaults.Fault.DISTANCE_API, "REQUEST_DENIED")) {
                log.warn("MOCK Distance Matrix: REQUEST_DENIED (key {} characters, starts with '{}')",
                        key == null ? 0 : key.length(), key == null ? "" : key.substring(0, Math.min(4, key.length())));
                return ResponseEntity.ok(Map.of("status", "REQUEST_DENIED", "error_message", "The provided API key is invalid.",
                        "rows", List.of()));
            }
            switch (faults.mode(DemoFaults.Fault.DISTANCE_API)) {
                case "HTTP_500" -> { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "backend error")); }
                case "OVER_QUERY_LIMIT" -> { return ResponseEntity.ok(Map.of("status", "OVER_QUERY_LIMIT",
                        "error_message", "You have exceeded your daily request quota for this API.", "rows", List.of())); }
                case "INVALID_RESPONSE" -> { return ResponseEntity.ok(Map.of("unexpected", "payload")); }
                default -> { }
            }
            log.info("MOCK Distance Matrix: origins={} destinations={} mode={} fault={}", origins, destinations, mode, faults.mode(DemoFaults.Fault.DISTANCE_API));
            double[] o = latLng(origins);
            List<Map<String, Object>> elements = new ArrayList<>();
            List<String> destAddresses = new ArrayList<>();
            double factor = faults.is(DemoFaults.Fault.NURSE_POOL, "FAR_AWAY") ? 200 : 1;
            for (String d : destinations.split("\\|")) {
                double[] dl = latLng(d);
                int meters = (int) (DistanceCalculator.roadMeters(o[0], o[1], dl[0], dl[1]) * factor);
                int seconds = DistanceCalculator.travelSeconds(meters);
                destAddresses.add(d);
                elements.add(Map.of(
                        "distance", Map.of("text", String.format("%.1f km", meters / 1000.0), "value", meters),
                        "duration", Map.of("text", Math.round(seconds / 60.0) + " mins", "value", seconds),
                        "status", "OK"));
            }
            return ResponseEntity.ok(Map.of("status", "OK", "origin_addresses", List.of(origins),
                    "destination_addresses", destAddresses, "rows", List.of(Map.of("elements", elements))));
        }

        private static double[] latLng(String s) {
            String[] p = s.trim().split(",");
            return new double[]{Double.parseDouble(p[0]), Double.parseDouble(p[1])};
        }
    }

    /** Twilio-style SMS gateway: Bearer API key, JSON {to, message}, returns a message SID. */
    @RestController
    @RequestMapping("/mock/sms")
    @RequiredArgsConstructor
    public static class MockSmsGatewayController {
        private final DemoFaults faults;
        private final HomeCareProperties props;
        private final NotificationService notifications;
        private final PatientRepository patients;

        @PostMapping("/messages")
        public ResponseEntity<Map<String, Object>> send(@RequestHeader(value = "Authorization", required = false) String auth,
                                                        @RequestBody Map<String, Object> body) {
            String expected = props.sms().apiKey();
            if (auth == null || (expected != null && !expected.isBlank() && !auth.equals("Bearer " + expected))) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "invalid api key"));
            }
            String to = String.valueOf(body.get("to"));
            String message = String.valueOf(body.get("message"));
            String category = String.valueOf(body.getOrDefault("category", "SMS"));
            Long patientId = patients.findFirstByFamilyContactPhoneOrderByIdDesc(to).map(Patient::getId).orElse(null);
            if (faults.is(DemoFaults.Fault.SMS_GATEWAY, "DOWN")) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", "gateway unavailable"));
            }
            if (faults.is(DemoFaults.Fault.SMS_GATEWAY, "REJECT") || !to.matches("\\d{10}")) {
                return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of("error", "invalid destination number " + to));
            }
            String sid = "SM" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
            notifications.record(patientId, "SMS", to, null, message, category, "SENT", sid, null);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("sid", sid, "status", "queued", "to", to));
        }
    }
}
