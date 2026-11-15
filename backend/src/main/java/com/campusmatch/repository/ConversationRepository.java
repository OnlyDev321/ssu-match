package com.campusmatch.repository;

import com.campusmatch.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    Optional<Conversation> findByGroupIdAndRequesterId(Long groupId, Long requesterId);
    Optional<Conversation> findByGroupIdAndGroupChatTrue(Long groupId);
    List<Conversation> findByRequesterIdOrLeaderIdOrderByUpdatedAtDesc(Long requesterId, Long leaderId);
}
