package com.campusmatch.repository;

import com.campusmatch.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByConversationIdOrderByCreatedAtAsc(Long conversationId);
    Optional<ChatMessage> findFirstByConversationIdOrderByCreatedAtDesc(Long conversationId);
}
