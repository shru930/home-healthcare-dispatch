package com.homecare.dispatch.security;

import com.homecare.dispatch.security.AuthService.AppUser;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Protects /api/**: every call needs "Authorization: Bearer <token>" from /api/auth/login.
 * Admin-only actions (system settings and demo fault injection) return 403 for USER accounts.
 * Task-level rules (who may complete which task) are enforced in TaskService.
 */
@Component
public class AuthFilter extends OncePerRequestFilter {

    public static final String USER_ATTRIBUTE = "careflow.user";
    private final AuthService auth;

    public AuthFilter(AuthService auth) {
        this.auth = auth;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        String p = req.getRequestURI();
        return !p.startsWith("/api/") || p.equals("/api/auth/login") || "OPTIONS".equals(req.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        String token = header != null && header.startsWith("Bearer ") ? header.substring(7) : null;
        Optional<AppUser> user = auth.userForToken(token);
        if (user.isEmpty()) {
            write(res, req, 401, "Unauthorized", "Please log in");
            return;
        }
        if (adminOnly(req) && !user.get().isAdmin()) {
            write(res, req, 403, "Forbidden", "Admin access required for this action");
            return;
        }
        req.setAttribute(USER_ATTRIBUTE, user.get());
        chain.doFilter(req, res);
    }

    private static boolean adminOnly(HttpServletRequest req) {
        String p = req.getRequestURI();
        String m = req.getMethod();
        return (p.startsWith("/api/demo/") && !"GET".equals(m))
                || (p.startsWith("/api/nurses/") && "PATCH".equals(m))
                || (p.startsWith("/api/visits/") && "PATCH".equals(m))
                || (p.startsWith("/api/physio/") && "PATCH".equals(m));
    }

    private static void write(HttpServletResponse res, HttpServletRequest req, int status, String error, String message) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json");
        res.getWriter().write("{\"timestamp\":\"" + Instant.now() + "\",\"status\":" + status + ",\"error\":\"" + error
                + "\",\"message\":\"" + message + "\",\"path\":\"" + req.getRequestURI() + "\",\"details\":[]}");
    }
}
