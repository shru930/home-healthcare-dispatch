package com.homecare.dispatch.security;

import com.homecare.dispatch.config.HomeCareProperties;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * Simple token login with two roles.
 *  USER  = ward staff: submits discharge requests, does nurse and physiotherapy tasks.
 *  ADMIN = care coordinator: approves home-care plans and takes the coordinator/doctor decisions.
 * Accounts come from configuration (homecare.users); passwords come from environment variables.
 */
@Service
public class AuthService {

    public record AppUser(String username, String displayName, String role) {
        public boolean isAdmin() {
            return "ADMIN".equals(role);
        }
    }

    private final Map<String, HomeCareProperties.User> accounts = new ConcurrentHashMap<>();
    private final Map<String, AppUser> sessions = new ConcurrentHashMap<>();

    public AuthService(HomeCareProperties props) {
        if (props.users() != null) {
            props.users().forEach(u -> accounts.put(u.username().toLowerCase(), u));
        }
    }

    public Optional<String> login(String username, String password) {
        if (username == null || password == null) return Optional.empty();
        HomeCareProperties.User u = accounts.get(username.trim().toLowerCase());
        if (u == null || u.password() == null || u.password().isBlank() || !u.password().equals(password)) {
            return Optional.empty();
        }
        String token = UUID.randomUUID().toString();
        sessions.put(token, new AppUser(u.username(), u.displayName(), u.role()));
        return Optional.of(token);
    }

    public Optional<AppUser> userForToken(String token) {
        return token == null ? Optional.empty() : Optional.ofNullable(sessions.get(token));
    }

    public void logout(String token) {
        if (token != null) sessions.remove(token);
    }
}
