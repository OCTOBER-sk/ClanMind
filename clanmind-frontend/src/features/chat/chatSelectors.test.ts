import { describe, it, expect } from 'vitest';
import {
  filterMessagesForScope,
  mergeMessages,
  annotateThreadCounts,
  activeTypingUsers,
} from '@/features/chat/chatSelectors';
import type { Message, TypingIndicator } from '@/types';

function message(overrides: Partial<Message>): Message {
  return {
    id: `m_${Math.random().toString(36).slice(2)}`,
    group_id: 'g1',
    sender_type: 'USER',
    sender_id: 'u1',
    sender_name: 'Arun',
    body: 'body',
    visibility: 'GROUP',
    pinned: false,
    edited: false,
    deleted: false,
    attachments: [],
    reactions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('filterMessagesForScope — FE rule 26 private isolation', () => {
  const publicMsg = message({ id: 'pub', body: 'public plan', visibility: 'GROUP' });
  const myPairOut = message({
    id: 'pair_out',
    visibility: 'PRIVATE_PAIR',
    sender_id: 'me',
    recipient_id: 'priya',
    body: 'secret to priya',
  });
  const myPairIn = message({
    id: 'pair_in',
    visibility: 'PRIVATE_PAIR',
    sender_id: 'priya',
    recipient_id: 'me',
    body: 'secret from priya',
  });
  const foreignPair = message({
    id: 'pair_foreign',
    visibility: 'PRIVATE_PAIR',
    sender_id: 'carol',
    recipient_id: 'dave',
    body: 'carol-and-dave secret',
  });
  const myAi = message({
    id: 'ai_mine',
    visibility: 'PRIVATE_AI',
    sender_id: 'odin_ai',
    recipient_id: 'me',
    body: 'private ai answer',
  });

  const corpus = [publicMsg, myPairOut, myPairIn, foreignPair, myAi];

  it('GROUP scope exposes ONLY GROUP-visibility messages (rule 26)', () => {
    const visible = filterMessagesForScope(corpus, {
      groupId: 'g1',
      visibility: 'GROUP',
      currentUserId: 'me',
    });
    expect(visible.map((m) => m.id)).toEqual(['pub']);
  });

  it('PRIVATE_PAIR scope shows exactly the two participants’ messages', () => {
    const visible = filterMessagesForScope(corpus, {
      groupId: 'g1',
      visibility: 'PRIVATE_PAIR',
      currentUserId: 'me',
      recipientId: 'priya',
    });
    expect(visible.map((m) => m.id)).toEqual(['pair_out', 'pair_in']);
  });

  it('a non-participant pair scope renders nothing of that conversation', () => {
    const visible = filterMessagesForScope([foreignPair], {
      groupId: 'g1',
      visibility: 'PRIVATE_PAIR',
      currentUserId: 'me',
      recipientId: 'priya',
    });
    expect(visible).toHaveLength(0);
  });

  it('PRIVATE_PAIR scope without a recipient renders nothing (no accidental exposure)', () => {
    const visible = filterMessagesForScope(corpus, {
      groupId: 'g1',
      visibility: 'PRIVATE_PAIR',
      currentUserId: 'me',
      recipientId: null,
    });
    expect(visible).toHaveLength(0);
  });

  it('PRIVATE_AI scope isolates the requester’s AI thread', () => {
    const visible = filterMessagesForScope(corpus, {
      groupId: 'g1',
      visibility: 'PRIVATE_AI',
      currentUserId: 'me',
    });
    expect(visible.map((m) => m.id)).toEqual(['ai_mine']);
  });

  it('PRIVATE_AI scope drops a foreign requester’s thread (audit 0.12 structural check)', () => {
    const foreignAi = message({
      id: 'ai_foreign',
      visibility: 'PRIVATE_AI',
      sender_id: 'carol',
      recipient_id: 'ai',
      body: 'carol’s private AI thread',
    });
    const visible = filterMessagesForScope([foreignAi, myAi], {
      groupId: 'g1',
      visibility: 'PRIVATE_AI',
      currentUserId: 'me',
    });
    expect(visible.map((m) => m.id)).toEqual(['ai_mine']);
  });

  it('messages of other groups never leak into any scope', () => {
    const otherGroup = message({ id: 'other_g', group_id: 'g2' });
    for (const visibility of ['GROUP', 'PRIVATE_PAIR', 'PRIVATE_AI'] as const) {
      const visible = filterMessagesForScope([otherGroup], {
        groupId: 'g1',
        visibility,
        currentUserId: 'me',
        recipientId: 'priya',
      });
      expect(visible).toHaveLength(0);
    }
  });
});

describe('mergeMessages — history ⊕ realtime tail (FE §202/§241/§242)', () => {
  it('dedupes server echo against optimistic copy via client_message_id', () => {
    const history = [
      message({ id: 'srv_1', client_message_id: 'op_1', body: 'persisted text' }),
      message({ id: 'srv_2' }),
    ];
    const tail = [
      // Optimistic insert awaiting reconciliation — same §241 identity.
      message({ id: 'local_tmp', client_message_id: 'op_1', body: 'persisted text', is_pending: true }),
    ];
    const merged = mergeMessages(history, tail);
    expect(merged.map((m) => m.id)).toEqual(['srv_1', 'srv_2']);
    expect(merged[0]?.is_pending).toBe(true); // store copy wins field-wise
  });

  it('keeps one ascending order regardless of input order; ids stable', () => {
    const a = message({ id: 'a', created_at: '2026-08-23T10:00:00Z' });
    const b = message({ id: 'b', created_at: '2026-08-23T11:00:00Z' });
    const c = message({ id: 'c', created_at: '2026-08-23T12:00:00Z' });
    expect(mergeMessages([c, a], [b]).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns tail untouched when no history is loaded yet', () => {
    const tail = [message({ id: 't1' })];
    expect(mergeMessages([], tail)).toHaveLength(1);
  });
});

describe('annotateThreadCounts — §30 live thread indicators', () => {
  it('counts replies onto their root and preserves identity otherwise', () => {
    const root = message({ id: 'root' });
    const r1 = message({ id: 'r1', reply_to_message_id: 'root' });
    const r2 = message({ id: 'r2', reply_to_message_id: 'root' });
    const annotated = annotateThreadCounts([root, r1, r2]);
    expect(annotated.find((m) => m.id === 'root')?.thread_count).toBe(2);
    expect(annotated.find((m) => m.id === 'r1')?.thread_count).toBeUndefined();
  });

  it('deleted replies do not count', () => {
    const root = message({ id: 'root' });
    const gone = message({ id: 'gone', reply_to_message_id: 'root', deleted: true });
    const annotated = annotateThreadCounts([root, gone]);
    expect(annotated.find((m) => m.id === 'root')?.thread_count).toBeUndefined();
  });
});

describe('activeTypingUsers — §37 ephemeral typing windows', () => {
  it('drops indicators older than the TTL', () => {
    const now = Date.now();
    const users: TypingIndicator[] = [
      { user_id: 'u1', user_name: 'Fresh', started_at: new Date(now - 1000).toISOString() },
      { user_id: 'u2', user_name: 'Stale', started_at: new Date(now - 60_000).toISOString() },
    ];
    const active = activeTypingUsers(users, now);
    expect(active.map((u) => u.user_id)).toEqual(['u1']);
  });
});
