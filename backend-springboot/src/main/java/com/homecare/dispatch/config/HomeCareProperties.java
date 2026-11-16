package com.homecare.dispatch.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Externalised configuration (application.yml + environment variables).
 * Secrets (SMTP password, SMS key, Google key) only ever come from the environment.
 */
@ConfigurationProperties(prefix = "homecare")
public record HomeCareProperties(
        boolean demoMode,
        Processes processes,
        Timers timers,
        Risk risk,
        Matching matching,
        Mail mail,
        Sms sms,
        Google google,
        java.util.List<User> users) {

    public record Processes(String mainProcessId, String pharmacyProcessId) {}

    /** ISO-8601 durations passed to the BPMN timer events as process variables. */
    public record Timers(String visitWindow, String physioWindow, String doctorReviewReminder,
                         String interventionTimeout, String deliveryReminder, String deliveryTimeout,
                         String nurseRetryWait) {}

    /** Demonstration thresholds only. Clinical decisions stay with qualified professionals. */
    public record Risk(int elevatedPainScore, int criticalPainScore, double feverTemperature, double criticalTemperature) {}

    public record Matching(int maxTravelMinutes, int maxNurseSearchAttempts) {}

    public record Mail(boolean embeddedServerEnabled, int port, String username, String password, String from) {}

    public record Sms(String apiKey) {}

    public record Google(String apiKey) {}

    /** Login account. role = ADMIN (approves) or USER (submits requests, field work). */
    public record User(String username, String password, String displayName, String role) {}
}
