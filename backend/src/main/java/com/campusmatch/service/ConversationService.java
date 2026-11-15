package com.campusmatch.service;

import com.campusmatch.dto.*;
import com.campusmatch.entity.*;
import com.campusmatch.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.time.LocalDateTime;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConversationService {
    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;

    @Transactional
    public Conversation getOrCreateForApplication(Long groupId, Long requesterId, boolean requesterAnonymous) {
        var existing = conversationRepository.findByGroupIdAndRequesterId(groupId, requesterId);
        if (existing.isPresent()) {
            Conversation conversation = existing.get();
            conversation.setRequesterAnonymous(requesterAnonymous);
            return conversationRepository.save(conversation);
        }
        StudyGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhóm"));
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng"));
        return conversationRepository.save(Conversation.builder()
                .group(group)
                .requester(requester)
                .leader(group.getLeader())
                .requesterAnonymous(requesterAnonymous)
                .build());
    }

    @Transactional
    public Conversation getOrCreateGroupChat(Long groupId) {
        return conversationRepository.findByGroupIdAndGroupChatTrue(groupId).orElseGet(() -> {
            StudyGroup group = groupRepository.findById(groupId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhóm"));
            return conversationRepository.save(Conversation.builder()
                    .group(group)
                    .requester(group.getLeader())
                    .leader(group.getLeader())
                    .groupChat(true)
                    .build());
        });
    }

    @Transactional
    public void addSystemMessage(Long groupId, String content) {
        Conversation conversation = getOrCreateGroupChat(groupId);
        createMessage(conversation, conversation.getLeader(), content, true);
    }

    @Transactional
    public ChatMessage createMessage(Conversation conversation, User sender, String content) {
        return createMessage(conversation, sender, content, false);
    }

    @Transactional
    public ChatMessage createMessage(Conversation conversation, User sender, String content, boolean systemMessage) {
        if (!StringUtils.hasText(content)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tin nhắn không được để trống");
        conversation.setUpdatedAt(LocalDateTime.now());
        conversationRepository.save(conversation);
        return messageRepository.save(ChatMessage.builder().conversation(conversation).sender(sender).content(content.trim()).systemMessage(systemMessage).build());
    }

    @Transactional(readOnly = true)
    public List<ConversationResponse> getConversations(String studentId) {
        User user = userRepository.findByStudentId(studentId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        List<Conversation> conversations = conversationRepository.findByRequesterIdOrLeaderIdOrderByUpdatedAtDesc(user.getId(), user.getId());
        groupMemberRepository.findByUserId(user.getId()).stream()
                .map(member -> conversationRepository.findByGroupIdAndGroupChatTrue(member.getGroup().getId()).orElse(null))
                .filter(java.util.Objects::nonNull)
                .forEach(conversation -> {
                    if (!conversations.contains(conversation)) conversations.add(conversation);
                });
        return conversations.stream()
                .sorted((first, second) -> java.util.Comparator.nullsLast(java.util.Comparator.<LocalDateTime>reverseOrder())
                        .compare(first.getUpdatedAt(), second.getUpdatedAt()))
                .map(c -> mapConversation(c, user)).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getMessages(Long conversationId, String studentId) {
        User user = userRepository.findByStudentId(studentId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Conversation c = getAuthorized(conversationId, user);
        return messageRepository.findByConversationIdOrderByCreatedAtAsc(c.getId()).stream().map(message -> mapMessage(message, user)).collect(Collectors.toList());
    }

    @Transactional
    public ChatMessageResponse sendMessage(Long conversationId, SendMessageRequest request, String studentId) {
        User user = userRepository.findByStudentId(studentId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Conversation c = getAuthorized(conversationId, user);
        return mapMessage(createMessage(c, user, request.getContent()), user);
    }

    private Conversation getAuthorized(Long id, User user) {
        Conversation c = conversationRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        boolean isGroupMember = c.isGroupChat() && groupMemberRepository.existsByGroupIdAndUserId(c.getGroup().getId(), user.getId());
        if (!isGroupMember && !c.getLeader().getId().equals(user.getId()) && !c.getRequester().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền truy cập cuộc trò chuyện này");
        }
        return c;
    }

    private ConversationResponse mapConversation(Conversation c, User viewer) {
        if (c.isGroupChat()) {
            ChatMessage last = getLastMessage(c);
            return ConversationResponse.builder().id(c.getId()).groupId(c.getGroup().getId()).groupTitle(c.getGroup().getTitle())
                    .otherParticipantName(c.getGroup().getTitle()).otherParticipantAnonymous(false).groupChat(true)
                    .participantCount((int) groupMemberRepository.countByGroupId(c.getGroup().getId()))
                    .lastMessage(last == null ? null : mapMessage(last, viewer)).updatedAt(c.getUpdatedAt()).build();
        }
        boolean viewerIsLeader = c.getLeader().getId().equals(viewer.getId());
        User other = viewerIsLeader ? c.getRequester() : c.getLeader();
        boolean anonymous = viewerIsLeader ? c.isRequesterAnonymous() : c.getGroup().isLeaderAnonymous();
        ChatMessage last = getLastMessage(c);
        return ConversationResponse.builder().id(c.getId()).groupId(c.getGroup().getId()).groupTitle(c.getGroup().getTitle())
                .otherParticipantName(anonymous ? "Người tạo nhóm ẩn danh" : other.getName())
                .otherParticipantAnonymous(anonymous).groupChat(false).participantCount(2)
                .lastMessage(last == null ? null : mapMessage(last, viewer)).updatedAt(c.getUpdatedAt()).build();
    }

    private ChatMessage getLastMessage(Conversation conversation) {
        return messageRepository.findFirstByConversationIdOrderByCreatedAtDesc(conversation.getId()).orElse(null);
    }

    private ChatMessageResponse mapMessage(ChatMessage m, User viewer) {
        boolean maskSender = (m.getConversation().getLeader().getId().equals(m.getSender().getId())
                && m.getConversation().getGroup().isLeaderAnonymous()
                && !m.getConversation().getLeader().getId().equals(viewer.getId()))
                || (m.getConversation().getRequester().getId().equals(m.getSender().getId())
                && m.getConversation().isRequesterAnonymous()
                && !m.getConversation().getRequester().getId().equals(viewer.getId()));
        return ChatMessageResponse.builder().id(m.getId()).conversationId(m.getConversation().getId()).senderId(m.getSender().getId())
                .senderName(maskSender ? "Người tạo nhóm ẩn danh" : m.getSender().getName()).content(m.getContent())
                .systemMessage(m.isSystemMessage()).createdAt(m.getCreatedAt()).build();
    }
}
