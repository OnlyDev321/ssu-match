package com.campusmatch.controller;

import com.campusmatch.service.UsaintSessionStore;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

@RestController
@RequestMapping("/api/internal/usaint-sessions")
@RequiredArgsConstructor
public class InternalUsaintSessionController {
    private final UsaintSessionStore sessionStore;

    @Value("${app.internal-api-secret:}")
    private String internalApiSecret;

    @PostMapping
    public ResponseEntity<?> create(@RequestHeader(value = "X-Internal-Secret", required = false) String secret,
                                    @RequestBody CreateSessionRequest request) {
        if (!authorized(secret)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (request.sessionCookies() == null || !request.sessionCookies().contains("MYSAPSSO2")) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(Map.of("sessionId", sessionStore.create(request.sessionCookies())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@RequestHeader(value = "X-Internal-Secret", required = false) String secret,
                                 @PathVariable String id) {
        if (!authorized(secret)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String cookies = sessionStore.get(id);
        return cookies == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(Map.of("sessionCookies", cookies));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(@RequestHeader(value = "X-Internal-Secret", required = false) String secret,
                                       @PathVariable String id) {
        if (!authorized(secret)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        sessionStore.remove(id);
        return ResponseEntity.noContent().build();
    }

    private boolean authorized(String secret) {
        return internalApiSecret != null && !internalApiSecret.isBlank() && secret != null &&
                MessageDigest.isEqual(internalApiSecret.getBytes(StandardCharsets.UTF_8), secret.getBytes(StandardCharsets.UTF_8));
    }

    public record CreateSessionRequest(String sessionCookies) {}
}
