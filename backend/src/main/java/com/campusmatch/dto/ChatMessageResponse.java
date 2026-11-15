package com.campusmatch.dto;

import lombok.Builder;
import lombok.Value;
import java.time.LocalDateTime;

@Value @Builder
public class ChatMessageResponse {
    Long id;
    Long conversationId;
    Long senderId;
    String senderName;
    String content;
    boolean systemMessage;
    LocalDateTime createdAt;
}
