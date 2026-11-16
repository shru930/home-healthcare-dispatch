package com.homecare.dispatch.security;

import com.homecare.dispatch.exception.ApiException;
import com.homecare.dispatch.security.AuthService.AppUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest r) {
        String token = auth.login(r.username(), r.password())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid username or password"));
        AppUser u = auth.userForToken(token).orElseThrow();
        return Map.of("token", token, "username", u.username(), "displayName", u.displayName(), "role", u.role());
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        AppUser u = CurrentUser.get().orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Please log in"));
        return Map.of("username", u.username(), "displayName", u.displayName(), "role", u.role());
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletRequest req) {
        String h = req.getHeader("Authorization");
        auth.logout(h != null && h.startsWith("Bearer ") ? h.substring(7) : null);
        return Map.of("loggedOut", true);
    }
}
