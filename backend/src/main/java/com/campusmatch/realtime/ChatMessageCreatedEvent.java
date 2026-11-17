package com.campusmatch.realtime;

import com.campusmatch.dto.ChatMessageResponse;

import java.util.Map;

public record ChatMessageCreatedEvent(Map<String, ChatMessageResponse> messagesByRecipient) { }
