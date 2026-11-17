package com.campusmatch.realtime;

import com.campusmatch.security.JwtTokenProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class RealtimeWebSocketHandler extends TextWebSocketHandler {
    private static final long AUTH_TIMEOUT_SECONDS = 8;
    private final JwtTokenProvider jwtTokenProvider;
    private final ObjectMapper objectMapper;
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, String> authenticatedUsers = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        // Không cho phép kết nối nặc danh giữ socket mở vô thời hạn.
        java.util.concurrent.CompletableFuture.delayedExecutor(AUTH_TIMEOUT_SECONDS, java.util.concurrent.TimeUnit.SECONDS).execute(() -> {
            if (session.isOpen() && !authenticatedUsers.containsKey(session.getId())) {
                try { session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Authentication timeout")); }
                catch (IOException ignored) { }
            }
        });
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        JsonNode frame;
        try {
            frame = objectMapper.readTree(message.getPayload());
        } catch (Exception exception) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        if (!authenticatedUsers.containsKey(session.getId())) {
            authenticate(session, frame);
            return;
        }

        if ("ping".equals(frame.path("type").asText())) {
            send(session, Map.of("type", "pong"));
        }
        // Client không được gửi lệnh chat hay chọn người nhận qua socket.
    }

    private void authenticate(WebSocketSession session, JsonNode frame) throws IOException {
        if (!"auth".equals(frame.path("type").asText())) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Authentication required"));
            return;
        }
        String token = frame.path("token").asText("");
        if (token.isBlank() || !jwtTokenProvider.validateToken(token)) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid token"));
            return;
        }

        String studentId = jwtTokenProvider.getStudentIdFromToken(token);
        WebSocketSession safeSession = new ConcurrentWebSocketSessionDecorator(session, 10_000, 512 * 1024);
        authenticatedUsers.put(session.getId(), studentId);
        sessions.put(session.getId(), safeSession);
        send(safeSession, Map.of("type", "ready"));
    }

    public void sendToUser(String studentId, Object event) {
        sessions.values().stream()
                .filter(session -> session.isOpen() && studentId.equals(authenticatedUsers.get(session.getId())))
                .forEach(session -> send(session, event));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
        authenticatedUsers.remove(session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        sessions.remove(session.getId());
        authenticatedUsers.remove(session.getId());
        if (session.isOpen()) session.close(CloseStatus.SERVER_ERROR);
        log.debug("Realtime socket transport closed: {}", exception.getMessage());
    }

    private void send(WebSocketSession session, Object value) {
        if (!session.isOpen()) return;
        try {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(value)));
        } catch (IOException exception) {
            log.debug("Cannot send realtime event to session {}: {}", session.getId(), exception.getMessage());
            try { session.close(CloseStatus.SERVER_ERROR); } catch (IOException ignored) { }
        }
    }
}
