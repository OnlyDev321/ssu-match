package com.campusmatch.service;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Holds short-lived u-SAINT cookies in backend memory; cookies are never persisted to the database. */
@Component
public class UsaintSessionStore {
    private static final long TTL_SECONDS = 30 * 60;
    private final Map<String, Entry> sessions = new ConcurrentHashMap<>();

    public String create(String sessionCookies) {
        purgeExpired();
        String id = UUID.randomUUID().toString();
        sessions.put(id, new Entry(sessionCookies, Instant.now().plusSeconds(TTL_SECONDS)));
        return id;
    }

    public String get(String id) {
        purgeExpired();
        Entry entry = sessions.get(id);
        return entry == null ? null : entry.cookies();
    }

    public void remove(String id) {
        sessions.remove(id);
    }

    private void purgeExpired() {
        Instant now = Instant.now();
        sessions.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
    }

    private record Entry(String cookies, Instant expiresAt) {}
}
