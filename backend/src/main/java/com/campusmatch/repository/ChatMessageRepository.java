package com.campusmatch.repository;

import com.campusmatch.entity.ChatMessage;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByConversationIdOrderByCreatedAtAsc(Long conversationId);
    Optional<ChatMessage> findFirstByConversationIdOrderByCreatedAtDesc(Long conversationId);

    @EntityGraph(attributePaths = {"conversation.group", "conversation.leader", "conversation.requester", "sender"})
    @Query("SELECT m FROM ChatMessage m WHERE m.conversation.id IN :conversationIds " +
            "AND m.createdAt = (SELECT MAX(latest.createdAt) FROM ChatMessage latest " +
            "WHERE latest.conversation.id = m.conversation.id) ORDER BY m.createdAt DESC, m.id DESC")
    List<ChatMessage> findLatestMessagesByConversationIds(@Param("conversationIds") List<Long> conversationIds);
}
