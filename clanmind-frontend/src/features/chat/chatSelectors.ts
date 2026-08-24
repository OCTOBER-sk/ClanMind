/**
 * Chat selectors — pure functions over message arrays. This is where FE
 * product rule 26 ("Private content must never appear in shared UI through
 * cache/store leakage", §56/§57) and §176 (search privacy) are enforced for
 * every surface that renders messages:
 *
 *   GROUP scope          → GROUP-visibility messages ONLY.
 *   PRIVATE_PAIR(a, b)   → only the two participants' pair messages.
 *   PRIVATE_AI           → only the requester's private AI thread.
 *
 * The realtime dispatch additionally gates what ENTERS the cache; these
 * selectors guarantee what LEAVES it toward any shared view — belt and
 * braces, because §11.2 forbids relying on a single visibility check.
 */

import type { Message, MessageVisibility } from '@/types';

export interface ChatScope {
  groupId: string;
  /** Which conversational scope is being rendered right now. */
  visibility: MessageVisibility;
  currentUserId: string;
  /** Recipient for PRIVATE_PAIR scopes (the other human participant). */
  recipientId?: string | null;
}

function isGroupVisible(message: Message): boolean {
  return message.visibility === 'GROUP';
}

/**
 * Filter messages down to exactly one conversational scope. Order and
 * duplicates are preserved — callers compose this with mergeMessages.
 */
export function filterMessagesForScope(
  messages: Message[],
  scope: ChatScope,
): Message[] {
  return messages.filter((m) => {
    if (m.group_id !== scope.groupId) return false;
    switch (scope.visibility) {
      case 'GROUP':
        // Absolute rule: nothing PRIVATE_* ever renders in a shared view,
        // even if the cache was polluted (defense-in-depth over the gate).
        return isGroupVisible(m);
      case 'PRIVATE_AI':
        // Requester + Odin only; other users' private AI threads must never
        // surface even if they somehow reached this device's cache.
        return m.visibility === 'PRIVATE_AI';
      case 'PRIVATE_PAIR': {
        if (m.visibility !== 'PRIVATE_PAIR') return false;
        const me = scope.currentUserId;
        const other = scope.recipientId ?? null;
        if (!other) return false;
        const senderId = m.sender_id;
        const recipientId =
          m.recipient_id ?? (senderId === me ? other : me);
        return (
          (senderId === me && recipientId === other) ||
          (senderId === other && recipientId === me)
        );
      }
      default:
        return isGroupVisible(m);
    }
  });
}

/**
 * Merge cursor-paged history (server truth) with the live tail (optimistic
 * inserts + realtime patches in the chat store) into ONE ascending list.
 *
 * Dedupe rules: server id is canonical identity; `client_message_id` links
 * an optimistic copy to its persisted row (FE §241/§242). When both copies
 * exist the STORE copy wins field-wise — it carries fresher realtime state
 * (reactions, pending flags) — while history-only rows pass through.
 * Stable sort by created_at with id tiebreak keeps virtualizer keys stable.
 */
export function mergeMessages(history: Message[], tail: Message[]): Message[] {
  if (history.length === 0) return [...tail];
  const byId = new Map<string, Message>();
  const byClientId = new Map<string, string>();

  for (const m of history) {
    byId.set(m.id, m);
    if (m.client_message_id) byClientId.set(m.client_message_id, m.id);
  }
  for (const m of tail) {
    const linkedId =
      (m.client_message_id ? byClientId.get(m.client_message_id) : undefined) ?? undefined;
    if (linkedId && byId.has(linkedId)) {
      byId.set(linkedId, { ...byId.get(linkedId)!, ...m, id: linkedId });
      continue;
    }
    const existing = byId.get(m.id);
    byId.set(m.id, existing ? { ...existing, ...m, id: m.id } : m);
    if (m.client_message_id) byClientId.set(m.client_message_id, m.id);
  }

  return [...byId.values()].sort((a, b) => {
    const byTime = a.created_at.localeCompare(b.created_at);
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });
}

/**
 * Annotate root messages with live reply counts (§30 thread indicator).
 * Returns new arrays/objects only where counts changed so memoization and
 * React keys stay stable.
 */
export function annotateThreadCounts(messages: Message[]): Message[] {
  const counts = new Map<string, number>();
  for (const m of messages) {
    if (m.reply_to_message_id && !m.deleted) {
      counts.set(m.reply_to_message_id, (counts.get(m.reply_to_message_id) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return messages;
  let mutated = false;
  const next = messages.map((m) => {
    const count = counts.get(m.id);
    if (count && m.thread_count !== count) {
      mutated = true;
      return { ...m, thread_count: count };
    }
    return m;
  });
  return mutated ? next : messages;
}

/** Ephemeral typing window (§37): indicators expire after this long. */
export const TYPING_TTL_MS = 6_000;

export function activeTypingUsers<T extends { started_at: string }>(
  typingUsers: T[],
  now: number,
): T[] {
  return typingUsers.filter((u) => now - new Date(u.started_at).getTime() < TYPING_TTL_MS);
}
