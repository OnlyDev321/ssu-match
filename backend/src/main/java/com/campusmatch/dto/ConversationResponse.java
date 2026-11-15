package com.campusmatch.dto;

import lombok.Builder;
import lombok.Value;
import java.time.LocalDateTime;

@Value @Builder
public class ConversationResponse {
    Long id;
    Long groupId;
    String groupTitle;
    String otherParticipantName;
    boolean otherParticipantAnonymous;
    boolean groupChat;
    int participantCount;
    ChatMessageResponse lastMessage;
    LocalDateTime updatedAt;
}
