package com.homecare.dispatch.exception;

import io.camunda.client.api.command.ClientException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Every error leaves the API in the same JSON shape. */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    public record ApiError(Instant timestamp, int status, String error, String message, String path, List<String> details) {}

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> api(ApiException ex, HttpServletRequest req) {
        return build(ex.status(), ex.getMessage(), req, List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        List<String> details = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage()).toList();
        return build(HttpStatus.BAD_REQUEST, "Validation failed", req, details);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> unreadable(HttpMessageNotReadableException ex, HttpServletRequest req) {
        return build(HttpStatus.BAD_REQUEST, "Malformed JSON request", req, List.of());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> illegal(IllegalArgumentException ex, HttpServletRequest req) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), req, List.of());
    }

    @ExceptionHandler(ClientException.class)
    ResponseEntity<ApiError> camunda(ClientException ex, HttpServletRequest req) {
        log.warn("Camunda call failed: {}", ex.getMessage());
        return build(HttpStatus.SERVICE_UNAVAILABLE, "Workflow engine rejected or could not process the request: " + ex.getMessage(), req, List.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> other(Exception ex, HttpServletRequest req) {
        log.error("Unhandled error on {}", req.getRequestURI(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, ex.getMessage(), req, List.of());
    }

    private ResponseEntity<ApiError> build(HttpStatus status, String message, HttpServletRequest req, List<String> details) {
        return ResponseEntity.status(status)
                .body(new ApiError(Instant.now(), status.value(), status.getReasonPhrase(), message, req.getRequestURI(), details));
    }

    public static Map<String, Object> none() {
        return Map.of();
    }
}
