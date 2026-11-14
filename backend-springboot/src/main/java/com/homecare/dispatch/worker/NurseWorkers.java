package com.homecare.dispatch.worker;

import com.homecare.dispatch.config.DemoFaults;
import com.homecare.dispatch.dto.Payloads.AssignedNurse;
import com.homecare.dispatch.service.CareService;
import com.homecare.dispatch.service.NurseMatcher;
import com.homecare.dispatch.service.NurseMatcher.Candidate;
import com.homecare.dispatch.service.NurseMatcher.NurseDistance;
import com.homecare.dispatch.service.WorkflowService;
import io.camunda.client.annotation.JobWorker;
import io.camunda.client.annotation.Variable;
import io.camunda.client.annotation.VariablesAsType;
import io.camunda.zeebe.spring.common.exception.ZeebeBpmnError;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Nurse retrieval, nearest-nurse matching (Distance Matrix or fallback) and assignment. */
@Component
@RequiredArgsConstructor
public class NurseWorkers {

    private final CareService care;
    private final WorkflowService workflows;
    private final DemoFaults faults;

    /** Task_FetchNurses: produces candidateNurses and the pipe-separated destinations for the Distance Matrix connector. */
    @JobWorker(type = "hh.fetch-available-nurses")
    public Map<String, Object> fetchAvailableNurses(@Variable Long workflowId, @Variable String requiredSkill,
                                                    @Variable Integer nurseSearchAttempts) {
        List<Candidate> candidates = faults.is(DemoFaults.Fault.NURSE_POOL, "EMPTY") ? List.of() : care.availableCandidates(requiredSkill);
        int attempts = (nurseSearchAttempts == null ? 0 : nurseSearchAttempts) + 1;
        Map<String, Object> out = new HashMap<>();
        out.put("candidateNurses", candidates);
        out.put("nurseCount", candidates.size());
        out.put("nurseSearchAttempts", attempts);
        out.put("nurseDestinations", candidates.stream().map(c -> c.latitude() + "," + c.longitude()).collect(Collectors.joining("|")));
        workflows.stage(workflowId, candidates.isEmpty() ? "No nurse available (attempt " + attempts + ")" : "Found " + candidates.size() + " available nurses");
        return out;
    }

    /** Task_FallbackDistance: runs only when the Distance Matrix connector raised DISTANCE_API_ERROR. */
    public record FallbackInput(List<Candidate> candidateNurses, Double patientLat, Double patientLng) {}

    @JobWorker(type = "hh.rank-nurses-fallback")
    public Map<String, Object> rankNursesFallback(@VariablesAsType FallbackInput in) {
        return Map.of("nurseDistances", NurseMatcher.straightLine(in.candidateNurses(), in.patientLat(), in.patientLng()),
                "distanceSource", "FALLBACK_STRAIGHT_LINE");
    }

    /** Task_MatchNurse: nearest suitable nurse, or BPMN error NO_SUITABLE_NURSE (caught by a boundary event). */
    public record MatchInput(Long workflowId, List<Candidate> candidateNurses, Map<String, Object> distanceMatrix,
                             List<NurseDistance> nurseDistances, String distanceSource, Integer maxTravelMinutes) {}

    @JobWorker(type = "hh.match-nurse")
    public Map<String, Object> matchNurse(@VariablesAsType MatchInput in) {
        Long workflowId = in.workflowId();
        List<Candidate> candidateNurses = in.candidateNurses();
        Map<String, Object> distanceMatrix = in.distanceMatrix();
        List<NurseDistance> nurseDistances = in.nurseDistances();
        String distanceSource = in.distanceSource();
        Integer maxTravelMinutes = in.maxTravelMinutes();
        boolean fallback = "FALLBACK_STRAIGHT_LINE".equals(distanceSource) && nurseDistances != null;
        if (!fallback && (distanceMatrix == null || !"OK".equals(distanceMatrix.get("status")) || !(distanceMatrix.get("rows") instanceof List<?>))) {
            // Google returns HTTP 200 with an error status (OVER_QUERY_LIMIT, REQUEST_DENIED...) or the payload is malformed.
            String status = distanceMatrix == null ? "EMPTY" : String.valueOf(distanceMatrix.get("status"));
            throw new ZeebeBpmnError("DISTANCE_API_ERROR", "Distance Matrix response not usable (status " + status + ")", Map.of());
        }
        List<NurseDistance> distances = fallback
                ? nurseDistances
                : NurseMatcher.fromDistanceMatrix(distanceMatrix, candidateNurses);
        int limit = maxTravelMinutes == null ? 60 : maxTravelMinutes;
        NurseDistance best = NurseMatcher.nearest(distances, limit).orElseThrow(() -> new ZeebeBpmnError("NO_SUITABLE_NURSE",
                "No available nurse can reach the patient within " + limit + " minutes", Map.of("nurseDistances", distances)));
        workflows.stage(workflowId, "Nearest nurse selected: " + best.fullName());
        Map<String, Object> out = new HashMap<>();
        out.put("nurseDistances", distances);
        out.put("selectedNurseId", best.nurseId());
        out.put("selectedDistanceMeters", best.distanceMeters());
        out.put("selectedTravelSeconds", best.travelSeconds());
        out.put("assignmentMode", "AUTO");
        return out;
    }

    /** Task_AssignNurse: persists the assignment for the automatic or the manual path. */
    @JobWorker(type = "hh.assign-nurse")
    public Map<String, Object> assignNurse(@Variable Long workflowId, @Variable Long carePlanId, @Variable Long selectedNurseId,
                                           @Variable Integer selectedDistanceMeters, @Variable Integer selectedTravelSeconds,
                                           @Variable String distanceSource, @Variable String assignmentMode,
                                           @Variable String manualAssignmentNote) {
        boolean manual = "MANUAL".equals(assignmentMode);
        AssignedNurse nurse = care.assignNurse(carePlanId, selectedNurseId, manual ? null : selectedDistanceMeters,
                manual ? null : selectedTravelSeconds, manual ? "MANUAL" : distanceSource, manual ? "MANUAL" : "AUTO", manualAssignmentNote);
        String travel = manual || selectedTravelSeconds == null ? "arranged by the care coordinator"
                : Math.round(selectedTravelSeconds / 60.0) + " minutes away";
        workflows.stage(workflowId, "Nurse assigned: " + nurse.fullName());
        return Map.of("assignedNurse", nurse, "assignmentSummary", nurse.fullName() + " (" + travel + ")");
    }
}
