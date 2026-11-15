package com.campusmatch.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "conversations", uniqueConstraints = {
        @UniqueConstraint(name = "uk_conversation_group_requester", columnNames = {"group_id", "requester_id"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Conversation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "group_id", nullable = false)
    private StudyGroup group;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "requester_id", nullable = false)
    private User requester;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "leader_id", nullable = false)
    private User leader;

    /** true nếu đây là phòng chat chung của cả nhóm; false nếu là application chat 1-1. */
    @Column(name = "group_chat", nullable = false, columnDefinition = "boolean not null default false")
    @Builder.Default
    private boolean groupChat = false;

    @Column(name = "requester_anonymous", nullable = false, columnDefinition = "boolean not null default true")
    @Builder.Default
    private boolean requesterAnonymous = false;

    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
