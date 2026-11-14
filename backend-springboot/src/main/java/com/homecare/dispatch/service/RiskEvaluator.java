package com.homecare.dispatch.service;

import com.homecare.dispatch.config.HomeCareProperties;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Workflow-support rule set that flags a nurse assessment as NORMAL, ELEVATED or CRITICAL.
 * The thresholds are configurable demonstration values (homecare.risk.*). The result only routes the
 * case to a qualified doctor; it is not a clinical diagnosis.
 */
@Component
public class RiskEvaluator {

    public record RiskResult(String riskLevel, List<String> reasons) {}

    private final HomeCareProperties.Risk cfg;

    public RiskEvaluator(HomeCareProperties props) {
        this.cfg = props.risk();
    }

    public RiskResult evaluate(int painScore, double temperature, boolean woundRedness, boolean woundDischarge, boolean swelling) {
        List<String> critical = new ArrayList<>();
        List<String> elevated = new ArrayList<>();

        if (painScore >= cfg.criticalPainScore()) {
            critical.add("Pain score " + painScore + " >= " + cfg.criticalPainScore());
        } else if (painScore >= cfg.elevatedPainScore()) {
            elevated.add("Pain score " + painScore + " >= " + cfg.elevatedPainScore());
        }
        if (temperature >= cfg.criticalTemperature()) {
            critical.add("Temperature " + temperature + " >= " + cfg.criticalTemperature());
        } else if (temperature >= cfg.feverTemperature()) {
            elevated.add("Fever " + temperature + " >= " + cfg.feverTemperature());
        }
        if (woundDischarge && temperature >= cfg.feverTemperature()) {
            critical.add("Wound discharge with fever (infection indicator)");
        } else if (woundDischarge) {
            elevated.add("Wound discharge (infection indicator)");
        }
        if (woundRedness) {
            elevated.add("Wound redness (infection indicator)");
        }
        if (swelling) {
            elevated.add("Swelling around the surgical site");
        }

        if (!critical.isEmpty()) {
            List<String> all = new ArrayList<>(critical);
            all.addAll(elevated);
            return new RiskResult("CRITICAL", all);
        }
        if (!elevated.isEmpty()) {
            return new RiskResult("ELEVATED", elevated);
        }
        return new RiskResult("NORMAL", List.of("All indicators within demonstration thresholds"));
    }
}
