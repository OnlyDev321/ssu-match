package com.campusmatch.realtime;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class RealtimeEventListener {
    private final RealtimeWebSocketHandler webSocketHandler;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onNotificationCreated(NotificationCreatedEvent event) {
        webSocketHandler.sendToUser(event.recipientStudentId(), Map.of(
                "type", "notification.created",
                "payload", event.notification()
        ));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onChatMessageCreated(ChatMessageCreatedEvent event) {
        event.messagesByRecipient().forEach((studentId, message) -> webSocketHandler.sendToUser(studentId, Map.of(
                "type", "message.created",
                "payload", message
        )));
    }
}
