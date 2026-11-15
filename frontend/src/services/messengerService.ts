import { apiRequest } from "@/lib/api";
import type { ChatMessage, ConversationSummary } from "@/lib/types";

export function getConversations(): Promise<ConversationSummary[]> {
  return apiRequest<ConversationSummary[]>("/conversations");
}

export function getConversationMessages(id: number): Promise<ChatMessage[]> {
  return apiRequest<ChatMessage[]>(`/conversations/${id}/messages`);
}

export function sendConversationMessage(id: number, content: string): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(`/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}
