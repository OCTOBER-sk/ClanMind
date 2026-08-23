import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Message,
  MessageVisibility,
  MessageAttachment,
  TypingIndicator,
} from '@/types';

/** Pending message: queued locally, not yet confirmed by server */
export interface PendingMessage {
  clientMessageId: string;
  body: string;
  attachmentIds: string[];
  createdAt: string;
}

export interface ChatState {
  messages: Message[];
  replyTarget: { messageId: string; senderName: string; preview: string } | null;
  composerText: string;
  composerAttachments: MessageAttachment[];
  visibility: MessageVisibility;
  privateRecipientId?: string;
  privateRecipientName?: string;
  typingUsers: TypingIndicator[];
  /** Draft text keyed by `group:{id}` or `group:{id}:project:{id}` */
  draftsByScope: Record<string, string>;
  /** Last-read message ID per scope key — for unread badge tracking */
  lastReadMessageIdByScope: Record<string, string>;
  /** Optimistic messages awaiting server round-trip, keyed by clientMessageId */
  pendingMessages: PendingMessage[];
  projectFilterId?: string;

  setComposerText: (text: string) => void;
  setReplyTarget: (
    target: { messageId: string; senderName: string; preview: string } | null
  ) => void;
  setVisibility: (
    visibility: MessageVisibility,
    recipientId?: string,
    recipientName?: string
  ) => void;
  addComposerAttachment: (attachment: MessageAttachment) => void;
  removeComposerAttachment: (attachmentId: string) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  deleteMessage: (id: string) => void;
  addReaction: (messageId: string, emoji: string, userId: string) => void;
  setTypingUsers: (users: TypingIndicator[]) => void;
  /** Persist draft for a given scope key */
  saveDraft: (scopeKey: string, text: string) => void;
  /** Load draft into composer for the given scope */
  loadDraft: (scopeKey: string) => void;
  setProjectFilterId: (projectId?: string) => void;
  /** Record the last message the user has read for a scope */
  markScopeRead: (scopeKey: string, messageId: string) => void;
  /** Add an optimistic pending message */
  addPendingMessage: (pending: PendingMessage) => void;
  /** Confirm a pending message was received by server (removes from pending) */
  confirmPendingMessage: (clientMessageId: string) => void;
  /** Mark a pending message as failed */
  failPendingMessage: (clientMessageId: string) => void;
}

// §190 drafts persist per Group × Project scope; §39 last-read markers persist too.
// §283 local cache namespaced — drafts are never public until sent.
export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
  // §11 — runtime starts empty; demo hydration or live queries fill messages.
  messages: [],

  replyTarget: null,
  composerText: '',
  composerAttachments: [],
  visibility: 'GROUP',
  typingUsers: [],
  draftsByScope: {},
  lastReadMessageIdByScope: {},
  pendingMessages: [],
  projectFilterId: undefined,

  setComposerText: (text) => set({ composerText: text }),
  setReplyTarget: (target) => set({ replyTarget: target }),
  setVisibility: (visibility, recipientId, recipientName) =>
    set({
      visibility,
      privateRecipientId: recipientId,
      privateRecipientName: recipientName,
    }),
  addComposerAttachment: (attachment) =>
    set((state) => ({
      composerAttachments: [...state.composerAttachments, attachment],
    })),
  removeComposerAttachment: (attachmentId) =>
    set((state) => ({
      composerAttachments: state.composerAttachments.filter(
        (a) => a.id !== attachmentId
      ),
    })),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates, updated_at: new Date().toISOString() } : m
      ),
    })),
  deleteMessage: (id) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, deleted: true, body: 'This message was deleted.' } : m
      ),
    })),
  addReaction: (messageId, emoji, userId) =>
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg;
        const existing = msg.reactions.find((r) => r.emoji === emoji);
        let updatedReactions;
        if (existing) {
          if (existing.user_ids.includes(userId)) {
            updatedReactions = msg.reactions
              .map((r) =>
                r.emoji === emoji
                  ? {
                      ...r,
                      count: r.count - 1,
                      user_ids: r.user_ids.filter((u) => u !== userId),
                    }
                  : r
              )
              .filter((r) => r.count > 0);
          } else {
            updatedReactions = msg.reactions.map((r) =>
              r.emoji === emoji
                ? { ...r, count: r.count + 1, user_ids: [...r.user_ids, userId] }
                : r
            );
          }
        } else {
          updatedReactions = [
            ...msg.reactions,
            { emoji, count: 1, user_ids: [userId] },
          ];
        }
        return { ...msg, reactions: updatedReactions };
      }),
    })),
  setTypingUsers: (users) => set({ typingUsers: users }),
  saveDraft: (scopeKey, text) =>
    set((state) => ({
      draftsByScope: { ...state.draftsByScope, [scopeKey]: text },
    })),
  loadDraft: (scopeKey) => {
    const draft = get().draftsByScope[scopeKey] ?? '';
    set({ composerText: draft });
  },
  setProjectFilterId: (projectId) => set({ projectFilterId: projectId }),
  markScopeRead: (scopeKey, messageId) =>
    set((state) => ({
      lastReadMessageIdByScope: {
        ...state.lastReadMessageIdByScope,
        [scopeKey]: messageId,
      },
    })),
  addPendingMessage: (pending) =>
    set((state) => ({
      pendingMessages: [...state.pendingMessages, pending],
    })),
  confirmPendingMessage: (clientMessageId) =>
    set((state) => ({
      pendingMessages: state.pendingMessages.filter(
        (p) => p.clientMessageId !== clientMessageId
      ),
    })),
  failPendingMessage: (clientMessageId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.client_message_id === clientMessageId
          ? { ...m, is_failed: true, is_pending: false }
          : m
      ),
      pendingMessages: state.pendingMessages.filter(
        (p) => p.clientMessageId !== clientMessageId
      ),
    })),
    }),
    {
      name: 'cm_chat',
      // §190/§39/§283: only draft + read-marker local state persists —
      // never message content duplication across scopes.
      partialize: (state) => ({
        draftsByScope: state.draftsByScope,
        lastReadMessageIdByScope: state.lastReadMessageIdByScope,
      }),
    },
  ),
);