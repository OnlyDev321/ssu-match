"use client";

import { useEffect } from "react";
import { API_BASE_URL } from "@/lib/api";
import type { AppNotification, ChatMessage, RealtimeConnectionProps, RealtimeServerEvent } from "@/lib/types";
import { publishRealtimeMessage } from "@/lib/realtimeEvents";
import { useNotificationStore } from "@/stores/notificationStore";

function getWebSocketUrl() {
  const url = new URL(API_BASE_URL, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/api\/?$/, "")}/ws`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export default function RealtimeConnection({ token }: RealtimeConnectionProps) {
  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let heartbeatTimer: number | undefined;
    let retryDelay = 1_000;
    let hasConnectedOnce = false;

    const clearHeartbeat = () => {
      if (heartbeatTimer !== undefined) window.clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    };

    const connect = () => {
      if (stopped) return;
      const currentSocket = new WebSocket(getWebSocketUrl());
      socket = currentSocket;

      currentSocket.addEventListener("open", () => {
        currentSocket.send(JSON.stringify({ type: "auth", token }));
      });

      currentSocket.addEventListener("message", (event) => {
        let frame: RealtimeServerEvent;
        try {
          frame = JSON.parse(String(event.data)) as RealtimeServerEvent;
        } catch {
          return;
        }

        if (frame.type === "ready") {
          const reconnected = hasConnectedOnce;
          hasConnectedOnce = true;
          retryDelay = 1_000;
          clearHeartbeat();
          heartbeatTimer = window.setInterval(() => {
            if (currentSocket.readyState === WebSocket.OPEN) {
              currentSocket.send(JSON.stringify({ type: "ping" }));
            }
          }, 25_000);
          if (reconnected) {
            void useNotificationStore.getState().fetchNotifications();
            publishRealtimeMessage(null);
          }
          return;
        }

        if (frame.type === "notification.created" && frame.payload) {
          useNotificationStore.getState().receiveRealtimeNotification(frame.payload as AppNotification);
        } else if (frame.type === "message.created" && frame.payload) {
          publishRealtimeMessage(frame.payload as ChatMessage);
        }
      });

      currentSocket.addEventListener("close", (event) => {
        clearHeartbeat();
        if (stopped || event.code === 1003 || event.code === 1008) return;
        retryTimer = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      });

      currentSocket.addEventListener("error", () => currentSocket.close());
    };

    connect();
    return () => {
      stopped = true;
      clearHeartbeat();
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      socket?.close(1000, "User disconnected");
    };
  }, [token]);

  return null;
}
