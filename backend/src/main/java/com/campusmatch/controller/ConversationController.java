package com.campusmatch.controller;

import com.campusmatch.dto.*;
import com.campusmatch.service.ConversationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.List;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {
    private final ConversationService conversationService;

    @GetMapping
    public List<ConversationResponse> list(Authentication authentication) {
        return conversationService.getConversations(studentId(authentication));
    }

    @GetMapping("/{id}/messages")
    public List<ChatMessageResponse> messages(@PathVariable Long id, Authentication authentication) {
        return conversationService.getMessages(id, studentId(authentication));
    }

    @PostMapping("/{id}/messages")
    public ResponseEntity<ChatMessageResponse> send(@PathVariable Long id, @Valid @RequestBody SendMessageRequest request, Authentication authentication) {
        return ResponseEntity.ok(conversationService.sendMessage(id, request, studentId(authentication)));
    }

    private String studentId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return authentication.getName();
    }
}
