package com.campusmatch.realtime;

import com.campusmatch.dto.NotificationResponse;

public record NotificationCreatedEvent(String recipientStudentId, NotificationResponse notification) { }
