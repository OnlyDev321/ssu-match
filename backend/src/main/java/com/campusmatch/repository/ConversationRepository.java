package com.campusmatch.repository;

import com.campusmatch.entity.Conversation;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    Optional<Conversation> findByGroupIdAndRequesterId(Long groupId, Long requesterId);
    @EntityGraph(attributePaths = {"group", "group.leader", "requester", "leader"})
    Optional<Conversation> findByGroupIdAndGroupChatTrue(Long groupId);
    @EntityGraph(attributePaths = {"group", "group.leader", "requester", "leader"})
    List<Conversation> findByGroupIdInAndGroupChatTrue(List<Long> groupIds);
    @EntityGraph(attributePaths = {"group", "group.leader", "requester", "leader"})
    List<Conversation> findByRequesterIdOrLeaderIdOrderByUpdatedAtDesc(Long requesterId, Long leaderId);
}
