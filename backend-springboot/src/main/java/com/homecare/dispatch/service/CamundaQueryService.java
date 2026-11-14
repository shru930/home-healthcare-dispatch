package com.homecare.dispatch.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Read side of the Camunda 8.8 Orchestration Cluster REST API (/v2 search endpoints).
 * Commands (start instance, complete task, publish message) go through the CamundaClient in WorkflowService/TaskService.
 */
@Service
public class CamundaQueryService {

    private final RestClient rest;
    private final ObjectMapper json;

    public CamundaQueryService(@Value("${homecare.camunda-rest-url}") String baseUrl, ObjectMapper json) {
        this.rest = RestClient.builder().baseUrl(baseUrl + "/v2").build();
        this.json = json;
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> search(String resource, Map<String, Object> filter, int limit) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("filter", filter);
        body.put("page", Map.of("limit", limit));
        Map<String, Object> res = rest.post().uri("/" + resource + "/search").contentType(MediaType.APPLICATION_JSON)
                .body(body).retrieve().body(Map.class);
        Object items = res == null ? null : res.get("items");
        return items == null ? List.of() : (List<Map<String, Object>>) items;
    }

    public Map<String, Object> processInstance(long key) {
        List<Map<String, Object>> r = search("process-instances", Map.of("processInstanceKey", String.valueOf(key)), 1);
        return r.isEmpty() ? null : r.get(0);
    }

    public List<Map<String, Object>> childInstances(long parentKey) {
        return search("process-instances", Map.of("parentProcessInstanceKey", String.valueOf(parentKey)), 100);
    }

    public List<Map<String, Object>> elementInstances(long processInstanceKey) {
        return search("element-instances", Map.of("processInstanceKey", String.valueOf(processInstanceKey)), 1000);
    }

    public List<Map<String, Object>> activeIncidents(long processInstanceKey) {
        return search("incidents", Map.of("processInstanceKey", String.valueOf(processInstanceKey), "state", "ACTIVE"), 100);
    }

    public List<Map<String, Object>> userTasks(Map<String, Object> filter) {
        return search("user-tasks", filter, 200);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> userTask(long key) {
        try {
            return rest.get().uri("/user-tasks/{key}", key).retrieve().body(Map.class);
        } catch (org.springframework.web.client.HttpClientErrorException.NotFound e) {
            throw com.homecare.dispatch.exception.ApiException.notFound("Task", key);
        }
    }

    /** Variables visible to the user task, decoded from their JSON string representation. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> userTaskVariables(long key) {
        Map<String, Object> res = rest.post().uri("/user-tasks/{key}/variables/search", key).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("page", Map.of("limit", 200))).retrieve().body(Map.class);
        Map<String, Object> out = new LinkedHashMap<>();
        if (res != null && res.get("items") instanceof List<?> items) {
            for (Object o : items) {
                Map<String, Object> v = (Map<String, Object>) o;
                out.put(String.valueOf(v.get("name")), decode(v.get("value")));
            }
        }
        return out;
    }

    private Object decode(Object raw) {
        if (!(raw instanceof String s)) {
            return raw;
        }
        try {
            return json.readValue(s, Object.class);
        } catch (Exception e) {
            return s;
        }
    }
}
