package com.homecare.dispatch.service;

import com.homecare.dispatch.exception.ApiException;
import com.homecare.dispatch.repository.NurseRepository;
import io.camunda.client.CamundaClient;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Custom Tasklist backend: lists Camunda user tasks, returns their context, validates the submitted
 * form data per task type and completes the task in Zeebe.
 */
@Service
@RequiredArgsConstructor
public class TaskService {

    /** Variables shown to the user as task context (others stay hidden). */
    private static final List<String> CONTEXT_VARS = List.of(
            "patientName", "patientMrn", "patientAddress", "patientPhone", "surgeryType", "dischargeDate", "familyContactName",
            "familyPhone", "familyEmail", "doctorName", "careDay", "session", "visitId", "appointmentId", "riskLevel", "riskReasons",
            "interventionId", "validationErrors", "assignedNurse", "candidateNurses", "nurseDistances", "planSummary", "gapCount",
            "painScore", "temperature", "nurseNotes", "physiotherapist", "requiredSkill");

    private final CamundaClient camunda;
    private final CamundaQueryService query;
    private final NurseRepository nurses;
    private final com.homecare.dispatch.config.HomeCareProperties props;

    public List<Map<String, Object>> list(String assignee, String candidateGroup, String state, Long processInstanceKey) {
        Map<String, Object> filter = new LinkedHashMap<>();
        filter.put("state", state == null || state.isBlank() ? "CREATED" : state);
        filter.put("processDefinitionId", props.processes().mainProcessId()); // only this application's tasks
        if (assignee != null && !assignee.isBlank()) filter.put("assignee", assignee);
        if (candidateGroup != null && !candidateGroup.isBlank()) filter.put("candidateGroup", candidateGroup);
        if (processInstanceKey != null) filter.put("processInstanceKey", String.valueOf(processInstanceKey));
        return query.userTasks(filter).stream().map(TaskService::view)
                .sorted(Comparator.comparing(m -> String.valueOf(m.get("creationDate")))).toList();
    }

    public Map<String, Object> details(long key) {
        Map<String, Object> view = view(query.userTask(key));
        Map<String, Object> vars;
        try {
            vars = query.userTaskVariables(key);
            view.put("contextLoading", false);
        } catch (Exception e) {
            // A brand-new task can be visible before its variables are indexed by Camunda (eventual consistency).
            vars = Map.of();
            view.put("contextLoading", true);
        }
        Map<String, Object> ctx = new LinkedHashMap<>();
        for (String n : CONTEXT_VARS) {
            if (vars.get(n) != null) ctx.put(n, vars.get(n));
        }
        view.put("context", ctx);
        return view;
    }

    public void claim(long key, String assignee) {
        camunda.newAssignUserTaskCommand(key).assignee(assignee).allowOverride(true).send().join();
    }

    public void complete(long key, Map<String, Object> variables, String actingUser) {
        Map<String, Object> task = query.userTask(key);
        if (task == null || !"CREATED".equals(task.get("state"))) {
            throw ApiException.conflict("Task " + key + " is not open any more");
        }
        Map<String, Object> clean = validate(String.valueOf(task.get("elementId")), variables);
        if (task.get("assignee") == null && actingUser != null && !actingUser.isBlank()) {
            claim(key, actingUser);
        }
        try {
            camunda.newCompleteUserTaskCommand(key).variables(clean).send().join();
        } catch (io.camunda.client.api.command.ProblemException e) {
            if (e.code() == 404) { // completed by someone else a moment ago; the search index was not updated yet
                throw ApiException.conflict("Task " + key + " was already completed");
            }
            throw e;
        }
    }

    /** Server-side validation per task form; returns only the variables the process expects. */
    Map<String, Object> validate(String elementId, Map<String, Object> in) {
        Map<String, Object> out = new LinkedHashMap<>();
        switch (elementId) {
            case "Task_HealthAssessment" -> {
                String status = oneOf(in, "visitStatus", "COMPLETED", "INCOMPLETE");
                out.put("visitStatus", status);
                out.put("nurseNotes", str(in, "nurseNotes", false));
                if ("COMPLETED".equals(status)) {
                    out.put("painScore", intIn(in, "painScore", 0, 10));
                    out.put("temperature", dblIn(in, "temperature", 34.0, 43.0));
                    out.put("woundRedness", bool(in, "woundRedness"));
                    out.put("woundDischarge", bool(in, "woundDischarge"));
                    out.put("swelling", bool(in, "swelling"));
                } else if (out.get("nurseNotes") == null) {
                    throw ApiException.badRequest("nurseNotes: explain why the visit is incomplete");
                }
            }
            case "Task_DoctorReview" -> {
                out.put("doctorDecision", oneOf(in, "doctorDecision", "HOME_CARE", "URGENT_VISIT", "READMIT"));
                out.put("doctorNotes", str(in, "doctorNotes", true));
            }
            case "Task_PhysioSession" -> {
                out.put("physioStatus", oneOf(in, "physioStatus", "COMPLETED", "PATIENT_DECLINED"));
                out.put("physioNotes", str(in, "physioNotes", false));
            }
            case "Task_ManualNurse" -> {
                long nurseId = ((Number) intIn(in, "selectedNurseId", 1, Integer.MAX_VALUE)).longValue();
                var nurse = nurses.findById(nurseId).orElseThrow(() -> ApiException.badRequest("selectedNurseId: nurse " + nurseId + " does not exist"));
                out.put("selectedNurseId", nurse.getId());
                out.put("manualAssignmentNote", str(in, "manualAssignmentNote", true));
            }
            case "Task_CorrectDischarge" -> {
                out.put("patientPhone", pattern(in, "patientPhone", "\\d{10}"));
                out.put("familyPhone", pattern(in, "familyPhone", "\\d{10}"));
                out.put("familyEmail", pattern(in, "familyEmail", "[^@\\s]+@[^@\\s]+\\.[^@\\s]+"));
                out.put("dischargeDate", pattern(in, "dischargeDate", "\\d{4}-\\d{2}-\\d{2}"));
            }
            case "Task_ManualEmergency" -> {
                out.put("emergencyOutcome", oneOf(in, "emergencyOutcome", "AMBULANCE_ARRANGED", "HOSPITAL_CONTACTED", "DOCTOR_ATTENDED"));
                out.put("emergencyNotes", str(in, "emergencyNotes", true));
            }
            case "Task_GapReview" -> {
                out.put("gapReviewDecision", oneOf(in, "gapReviewDecision", "ACCEPT_AND_CLOSE", "FOLLOW_UP_BOOKED"));
                out.put("reviewNotes", str(in, "reviewNotes", true));
            }
            default -> throw ApiException.badRequest("Unknown task type " + elementId);
        }
        return out;
    }

    // ------------------------------------------------------------------ helpers
    static Map<String, Object> view(Map<String, Object> t) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (String k : List.of("userTaskKey", "name", "elementId", "assignee", "candidateGroups", "state", "processInstanceKey",
                "processDefinitionId", "processName", "creationDate", "completionDate", "formKey", "elementInstanceKey", "priority")) {
            m.put(k, t.get(k));
        }
        return m;
    }

    private static String oneOf(Map<String, Object> in, String name, String... allowed) {
        Object v = in.get(name);
        if (v == null || !Arrays.asList(allowed).contains(v.toString())) {
            throw ApiException.badRequest(name + ": must be one of " + String.join(", ", allowed));
        }
        return v.toString();
    }

    private static String str(Map<String, Object> in, String name, boolean required) {
        Object v = in.get(name);
        if (v == null || v.toString().isBlank()) {
            if (required) throw ApiException.badRequest(name + ": is required");
            return null;
        }
        return v.toString().trim();
    }

    private static String pattern(Map<String, Object> in, String name, String regex) {
        String v = str(in, name, true);
        if (!v.matches(regex)) throw ApiException.badRequest(name + ": invalid format");
        return v;
    }

    private static Number intIn(Map<String, Object> in, String name, int min, int max) {
        try {
            int v = (int) Double.parseDouble(String.valueOf(in.get(name)));
            if (v < min || v > max) throw new NumberFormatException();
            return v;
        } catch (NumberFormatException | NullPointerException e) {
            throw ApiException.badRequest(name + ": must be a number between " + min + " and " + max);
        }
    }

    private static double dblIn(Map<String, Object> in, String name, double min, double max) {
        try {
            double v = Double.parseDouble(String.valueOf(in.get(name)));
            if (v < min || v > max) throw new NumberFormatException();
            return v;
        } catch (NumberFormatException e) {
            throw ApiException.badRequest(name + ": must be a number between " + min + " and " + max);
        }
    }

    private static boolean bool(Map<String, Object> in, String name) {
        return Boolean.parseBoolean(String.valueOf(in.getOrDefault(name, "false")));
    }
}
