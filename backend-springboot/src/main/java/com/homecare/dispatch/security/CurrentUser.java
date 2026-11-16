package com.homecare.dispatch.security;

import com.homecare.dispatch.security.AuthService.AppUser;
import java.util.Optional;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

/** The user of the current HTTP request (set by AuthFilter). Empty outside web requests, e.g. in job workers. */
public final class CurrentUser {

    private CurrentUser() {}

    public static Optional<AppUser> get() {
        RequestAttributes a = RequestContextHolder.getRequestAttributes();
        if (a == null) return Optional.empty();
        return Optional.ofNullable((AppUser) a.getAttribute(AuthFilter.USER_ATTRIBUTE, RequestAttributes.SCOPE_REQUEST));
    }
}
