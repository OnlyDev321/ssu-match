"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Send, ShieldCheck, X } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useLanguageStore } from "@/stores/languageStore";
import { getConversationMessages, getConversations, sendConversationMessage } from "@/services/messengerService";
import { useCachedServiceData } from "@/lib/hooks";
import { getQuerySnapshot, invalidateCachedQueries, updateCachedQuery } from "@/lib/queryCache";
import { subscribeRealtimeMessages } from "@/lib/realtimeEvents";
import type { ChatMessage, ConversationSummary } from "@/lib/types";

const timeLabel = (value?: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

function appendMessageOnce(current: Record<number, ChatMessage[]>, message: ChatMessage) {
  const messages = current[message.conversationId] || [];
  if (messages.some((item) => item.id === message.id)) return current;
  return { ...current, [message.conversationId]: [...messages, message] };
}

export default function MessengerDropdown() {
  const { t } = useLanguageStore();
  const copy = t.messenger;
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.userId);
  const [isOpen, setIsOpen] = useState(false);
  const conversationsQuery = useCachedServiceData<ConversationSummary[]>(
    `private:messenger:conversations:${userId ?? "anonymous"}`,
    getConversations,
    isOpen && !!token && !!userId,
    15_000,
  );
  const conversations = conversationsQuery.data ?? [];
  const [openConversations, setOpenConversations] = useState<ConversationSummary[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<number, ChatMessage[]>>({});
  const [draftByConversation, setDraftByConversation] = useState<Record<number, string>>({});
  const [loadingByConversation, setLoadingByConversation] = useState<Record<number, boolean>>({});
  const [sendingConversation, setSendingConversation] = useState<number | null>(null);
  const [maxVisibleChats, setMaxVisibleChats] = useState(1);
  const portalRoot = typeof document === "undefined" ? null : document.body;
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const messageScrollRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    const updateVisibleChatLimit = () => {
      const width = window.innerWidth;
      setMaxVisibleChats(width >= 1440 ? 3 : width >= 768 ? 2 : 1);
    };
    updateVisibleChatLimit();
    window.addEventListener("resize", updateVisibleChatLimit);
    return () => window.removeEventListener("resize", updateVisibleChatLimit);
  }, []);

  const loadMessages = useCallback(async (conversation: ConversationSummary) => {
    setLoadingByConversation((current) => ({ ...current, [conversation.id]: true }));
    try {
      const messages = await getConversationMessages(conversation.id);
      setMessagesByConversation((current) => ({ ...current, [conversation.id]: messages }));
    } catch {
      setMessagesByConversation((current) => ({ ...current, [conversation.id]: [] }));
    } finally {
      setLoadingByConversation((current) => ({ ...current, [conversation.id]: false }));
    }
  }, []);

  useEffect(() => subscribeRealtimeMessages((message) => {
    const cacheKey = `private:messenger:conversations:${userId ?? "anonymous"}`;
    if (message === null) {
      invalidateCachedQueries(cacheKey);
      openConversations.forEach((conversation) => void loadMessages(conversation));
      return;
    }

    setMessagesByConversation((current) => {
      const messages = current[message.conversationId];
      if (!messages) return current;
      return appendMessageOnce(current, message);
    });

    const cached = getQuerySnapshot<ConversationSummary[]>(cacheKey).data;
    if (!cached?.some((item) => item.id === message.conversationId)) return;
    updateCachedQuery<ConversationSummary[]>(cacheKey, (current) => (current ?? [])
      .map((item) => item.id === message.conversationId
        ? { ...item, lastMessage: message, updatedAt: message.createdAt }
        : item)
      .sort((first, second) => new Date(second.updatedAt || 0).getTime() - new Date(first.updatedAt || 0).getTime()));
  }), [loadMessages, openConversations, userId]);

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    Object.values(messageScrollRefs.current).forEach((element) => element?.scrollTo({ top: element.scrollHeight, behavior: "smooth" }));
  }, [messagesByConversation, openConversations]);

  const openConversation = (conversation: ConversationSummary) => {
    setOpenConversations((current) => {
      const next = [...current.filter((item) => item.id !== conversation.id), conversation];
      return next.slice(-maxVisibleChats);
    });
    setIsOpen(false);
    if (!messagesByConversation[conversation.id]) void loadMessages(conversation);
  };

  const closeConversation = (conversationId: number) => {
    setOpenConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
  };

  const send = async (conversation: ConversationSummary) => {
    const content = (draftByConversation[conversation.id] || "").trim();
    if (!content || sendingConversation === conversation.id) return;
    try {
      setSendingConversation(conversation.id);
      const message = await sendConversationMessage(conversation.id, content);
      setMessagesByConversation((current) => appendMessageOnce(current, message));
      setDraftByConversation((current) => ({ ...current, [conversation.id]: "" }));
      conversationsQuery.setData((current) => (current ?? []).map((item) => item.id === conversation.id
        ? { ...item, lastMessage: message, updatedAt: message.createdAt }
        : item));
    } finally { setSendingConversation(null); }
  };

  const renderChatWindow = (conversation: ConversationSummary, index: number) => {
    const messages = messagesByConversation[conversation.id] || [];
    const draft = draftByConversation[conversation.id] || "";
    const title = conversation.groupChat ? conversation.groupTitle : conversation.otherParticipantName;
    return (
      <section key={conversation.id} role="dialog" aria-label={title}
        className="fixed bottom-0 right-0 z-40 flex h-[min(70vh,620px)] w-full flex-col overflow-hidden rounded-t-2xl border border-b-0 border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-level-3)] sm:right-[calc(var(--chat-offset)*min(382px,30vw))] sm:h-[min(560px,calc(100vh-96px))] sm:w-[min(370px,calc(100vw-24px))]"
        style={{ "--chat-offset": index } as CSSProperties}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-muted)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">{conversation.groupChat ? <MessageCircle className="h-4 w-4" aria-hidden="true" /> : title.slice(0, 1)}</div>
            <div className="min-w-0"><h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">{title}</h2><p className="truncate text-[11px] text-[var(--text-muted)]">{conversation.groupChat ? `${copy.groupChat} · ${conversation.participantCount}` : `${copy.groupLabel}: ${conversation.groupTitle}`}</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-1"><ShieldCheck className="h-4 w-4 text-[var(--success)]" aria-hidden="true" /><button type="button" onClick={() => closeConversation(conversation.id)} aria-label={copy.closeChat} className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-container-low)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"><X className="h-4 w-4" /></button></div>
        </header>
        <div ref={(element) => { messageScrollRefs.current[conversation.id] = element; }} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[var(--surface-container-low)]/30 p-4">
          <div className="px-3 py-2 text-center text-[11px] text-[var(--text-muted)]">{copy.privacyNote}</div>
          {loadingByConversation[conversation.id] && messages.length === 0 ? <p className="text-center text-xs text-[var(--text-muted)]">{copy.loading}</p> : messages.length === 0 ? <p className="text-center text-xs text-[var(--text-muted)]">{copy.emptyDescription}</p> : messages.map((message) => {
            if (message.systemMessage) return <div key={message.id} className="py-2 text-center text-[11px] text-[var(--text-muted)]">{message.content}</div>;
            const mine = message.senderId === userId;
            return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-3 py-2 ${mine ? "rounded-br-md bg-[var(--primary)] text-white" : "rounded-bl-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"}`}>{conversation.groupChat && !mine && <p className="mb-1 text-[10px] font-semibold text-[var(--primary)]">{message.senderName}</p>}<p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{message.content}</p><span className={`mt-1 block text-[10px] ${mine ? "text-white/70" : "text-[var(--text-faint)]"}`}>{timeLabel(message.createdAt)}</span></div></div>;
          })}
        </div>
        <div className="flex shrink-0 items-end gap-2 border-t border-[var(--border-muted)] p-3">
          <textarea value={draft} onChange={(event) => setDraftByConversation((current) => ({ ...current, [conversation.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(conversation); } }} placeholder={copy.placeholder} rows={1} className="min-w-0 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--primary)] focus:outline-none" />
          <button type="button" onClick={() => void send(conversation)} disabled={!draft.trim() || sendingConversation === conversation.id} aria-label={copy.send} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white transition-opacity hover:opacity-90 disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </div>
      </section>
    );
  };

  return (
    <>
      <div className="relative" ref={containerRef}>
        <button type="button" onClick={() => setIsOpen((current) => !current)} aria-label={copy.title} aria-haspopup="dialog" aria-expanded={isOpen} className="relative rounded-[var(--radius-button)] border border-transparent p-1.5 text-[var(--text-secondary)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-container-low)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:p-2"><MessageCircle className="h-4 w-4" />{conversations.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--primary)] ring-2 ring-[var(--surface)]" aria-hidden="true" />}</button>
        {isOpen && portalRoot && createPortal(<div className="pointer-events-none fixed inset-0 z-[200]"><div ref={panelRef} role="dialog" aria-label={copy.title} className="motion-popover pointer-events-auto fixed left-3 right-3 top-[4.25rem] z-[200] flex h-[min(52dvh,420px)] max-h-[calc(100dvh-5rem)] w-auto max-w-none flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-level-3)] sm:left-auto sm:right-6 sm:top-16 sm:h-[min(560px,calc(100vh-88px))] sm:max-h-none sm:w-[min(390px,calc(100vw-24px))] sm:max-w-[390px]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-muted)] px-4 py-3"><div className="flex min-w-0 items-center gap-2"><MessageCircle className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" /><h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">{copy.title}</h2></div><ShieldCheck className="h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden="true" /></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">{conversations.length === 0 ? <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center"><MessageCircle className="h-8 w-8 text-[var(--text-faint)]" aria-hidden="true" /><h3 className="text-sm font-semibold text-[var(--text-primary)]">{copy.emptyTitle}</h3><p className="text-xs leading-relaxed text-[var(--text-muted)]">{copy.emptyDescription}</p></div> : conversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => openConversation(conversation)} className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-[var(--surface-container-low)]"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-semibold text-[var(--primary)]">{conversation.groupChat ? <MessageCircle className="h-4 w-4" aria-hidden="true" /> : conversation.otherParticipantName.slice(0, 1)}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-[var(--text-primary)]">{conversation.groupChat ? conversation.groupTitle : conversation.otherParticipantName}</span><span className="text-[10px] text-[var(--text-faint)]">{timeLabel(conversation.updatedAt)}</span></div><p className="mt-0.5 truncate text-[11px] text-[var(--primary)]">{conversation.groupChat ? `${copy.groupChat} · ${conversation.participantCount}` : conversation.groupTitle}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{conversation.lastMessage?.content || copy.emptyDescription}</p></div></button>)}</div>
        </div></div>, portalRoot)}
      </div>
      {portalRoot && openConversations.length > 0 && createPortal(
        <div className="pointer-events-none fixed inset-0 z-[100]">
          {openConversations.map((conversation, index) => (
            <div key={conversation.id} className="pointer-events-auto contents">{renderChatWindow(conversation, index)}</div>
          ))}
        </div>,
        portalRoot,
      )}
    </>
  );
}
