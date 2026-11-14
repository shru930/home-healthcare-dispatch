package com.homecare.dispatch.config;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Fault-injection switches used to demonstrate the exception paths live
 * (API errors, quota failures, courier unavailable, ...). Everything defaults to OK.
 */
@Component
public class DemoFaults {

    public enum Fault { DISTANCE_API, SMS_GATEWAY, EMAIL_SERVER, COURIER, EMERGENCY_DISPATCH, NURSE_POOL }

    /** Allowed modes per fault. The first value is the healthy default. */
    public static final Map<Fault, java.util.List<String>> MODES = Map.of(
            Fault.DISTANCE_API, java.util.List.of("OK", "HTTP_500", "OVER_QUERY_LIMIT", "REQUEST_DENIED", "INVALID_RESPONSE"),
            Fault.SMS_GATEWAY, java.util.List.of("OK", "DOWN", "REJECT"),
            Fault.EMAIL_SERVER, java.util.List.of("OK", "DOWN"),
            Fault.COURIER, java.util.List.of("OK", "UNAVAILABLE"),
            Fault.EMERGENCY_DISPATCH, java.util.List.of("OK", "FAIL"),
            Fault.NURSE_POOL, java.util.List.of("OK", "EMPTY", "FAR_AWAY"));

    private final Map<Fault, String> active = new ConcurrentHashMap<>();

    public String mode(Fault fault) {
        return active.getOrDefault(fault, "OK");
    }

    public boolean is(Fault fault, String mode) {
        return mode(fault).equals(mode);
    }

    public void set(Fault fault, String mode) {
        if (!MODES.get(fault).contains(mode)) {
            throw new IllegalArgumentException("Unknown mode " + mode + " for " + fault + ". Allowed: " + MODES.get(fault));
        }
        active.put(fault, mode);
    }

    public Map<Fault, String> snapshot() {
        Map<Fault, String> all = new java.util.EnumMap<>(Fault.class);
        for (Fault f : Fault.values()) {
            all.put(f, mode(f));
        }
        return all;
    }

    public void reset() {
        active.clear();
    }
}
