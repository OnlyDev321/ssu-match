import type { ChatMessage, RealtimeMessageListener } from "@/lib/types";

const listeners = new Set<RealtimeMessageListener>();

export function subscribeRealtimeMessages(listener: RealtimeMessageListener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publishRealtimeMessage(message: ChatMessage | null) {
  listeners.forEach((listener) => listener(message));
}
