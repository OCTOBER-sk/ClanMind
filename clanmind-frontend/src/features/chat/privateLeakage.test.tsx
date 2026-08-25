/**
 * FE product rule 26 / BE §55A / FE §176 — AUTOMATED PRIVATE-LEAKAGE TEST.
 *
 * Asserts at BOTH enforcement layers that PRIVATE content can never reach a
 * GROUP-scope store or view:
 *   1. CACHE GATE — realtime dispatch refuses to cache PRIVATE_* events
 *      whose participants demonstrably exclude the local user;
 *   2. VIEW FILTER — even if such content existed in the cache, the GROUP-
 *      scope render path and the §176 search corpus exclude it absolutely.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { dispatchRealtimeEvent } from '@/realtime/dispatch';
import { useChatStore } from '@/state/useChatStore';
import { useAuthStore } from '@/state/useAuthStore';
import { MessageList } from '@/features/chat/MessageList';
import {
  filterMessagesForScope,
  mergeMessages,
} from '@/features/chat/chatSelectors';
import type { Message, User } from '@/types';

const ME = 'user_me_1';

function message(overrides: Partial<Message>): Message {
  return {
    id: `m_${Math.random().toString(36).slice(2)}`,
    group_id: 'g1',
    sender_type: 'USER',
    sender_id: ME,
    sender_name: 'Me',
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

function meUser(): User {
  return { id: ME, email: 'me@example.com', name: 'Me', created_at: new Date().toISOString() };
}

function envelope(eventType: string, payload: unknown) {
  return {
    protocol_version: 1,
    event_id: `evt_${Math.random()}`,
    event_type: eventType,
    sequence: 5000 + Math.floor(Math.random() * 1000),
    group_id: 'g1',
    actor_id: 'srv',
    visibility: 'GROUP',
    occurred_at: new Date().toISOString(),
    payload,
  };
}

function resetStores(): void {
  useAuthStore.setState({ user: meUser(), isAuthenticated: true });
  useChatStore.setState({ messages: [], typingUsers: [], presenceOnlineCount: null });
}

describe('PRIVATE-LEAKAGE — cache gate (realtime dispatch → store)', () => {
  beforeEach(resetStores);

  it('does NOT cache a foreign PRIVATE_PAIR message.created (BE §55A)', () => {
    dispatchRealtimeEvent(
      envelope('message.created', {
        message: {
          id: 'msg_foreign_pair',
          group_id: 'g1',
          visibility: 'PRIVATE_PAIR',
          sender_user_id: 'userC',
          recipient_id: 'userD',
          body: 'SECRET-C-D — must never be cached for me',
          client_message_id: 'op_foreign',
          server_sequence: 1,
          created_at: new Date().toISOString(),
        },
      }),
    );
    const bodies = useChatStore.getState().messages.map((m) => m.body);
    expect(bodies).not.toContain('SECRET-C-D — must never be cached for me');
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it('does NOT cache a foreign PRIVATE_AI thread (audit 0.12: `private_to:"ai"` must not admit it)', () => {
    // Audit probe — the original synthetic payload omitted `private_to`, so
    // it never exercised the `recipientId === 'ai'` gate hole. With the
    // controller sending `private_to:'ai'` (useChatController) and the demo
    // hub fanning private rows room-wide, a foreign PRIVATE_AI row carrying
    // the literal 'ai' recipient must STILL be refused entry to this device.
    dispatchRealtimeEvent(
      envelope('message.created', {
        message: {
          id: 'msg_foreign_ai',
          group_id: 'g1',
          visibility: 'PRIVATE_AI',
          sender_user_id: 'userC',
          recipient_id: 'ai',
          body: 'SECRET-AI — someone else’s private AI answer',
          client_message_id: 'op_foreign_ai',
          server_sequence: 2,
          created_at: new Date().toISOString(),
        },
      }),
    );
    expect(
      useChatStore.getState().messages.some((m) => m.id === 'msg_foreign_ai'),
    ).toBe(false);
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it('still caches the user’s OWN private AI thread (requester is participant)', () => {
    dispatchRealtimeEvent(
      envelope('message.created', {
        message: {
          id: 'msg_own_ai',
          group_id: 'g1',
          visibility: 'PRIVATE_AI',
          sender_user_id: ME,
          recipient_id: 'ai',
          body: 'my own private AI question',
          client_message_id: 'op_own_ai',
          server_sequence: 5,
          created_at: new Date().toISOString(),
        },
      }),
    );
    expect(
      useChatStore.getState().messages.some((m) => m.id === 'msg_own_ai'),
    ).toBe(true);
  });

  it('still caches the user’s OWN private messages and plain GROUP messages', () => {
    dispatchRealtimeEvent(
      envelope('message.created', {
        message: {
          id: 'msg_own_pair',
          group_id: 'g1',
          visibility: 'PRIVATE_PAIR',
          sender_user_id: ME,
          recipient_id: 'priya',
          body: 'my own private line',
          client_message_id: 'op_own',
          server_sequence: 3,
          created_at: new Date().toISOString(),
        },
      }),
    );
    dispatchRealtimeEvent(
      envelope('message.created', {
        message: {
          id: 'msg_group_ok',
          group_id: 'g1',
          visibility: 'GROUP',
          sender_user_id: 'priya',
          body: 'group visible line',
          client_message_id: 'op_grp',
          server_sequence: 4,
          created_at: new Date().toISOString(),
        },
      }),
    );
    const ids = useChatStore.getState().messages.map((m) => m.id);
    expect(ids).toContain('msg_own_pair');
    expect(ids).toContain('msg_group_ok');
  });

  it('routes message.deleted fan-out to a tombstone (§32)', () => {
    useChatStore.setState({
      messages: [message({ id: 'victim', body: 'to be deleted' })],
    });
    dispatchRealtimeEvent(envelope('message.deleted', { message_id: 'victim' }));
    expect(useChatStore.getState().messages[0]?.deleted).toBe(true);
  });

  it('applies message.edited fan-out (§31 subtle edited state)', () => {
    useChatStore.setState({
      messages: [message({ id: 'edit_me', body: 'before edit' })],
    });
    dispatchRealtimeEvent(
      envelope('message.updated', { message_id: 'edit_me', body: 'after edit', edited_at: new Date().toISOString() }),
    );
    const edited = useChatStore.getState().messages[0]!;
    expect(edited.body).toBe('after edit');
    expect(edited.edited).toBe(true);
  });
});

describe('PRIVATE-LEAKAGE — view filter (GROUP render + §176 search corpus)', () => {
  beforeEach(resetStores);

  function seedCache(): void {
    // Even a POLLUTED cache (as if something went wrong upstream) cannot
    // leak into a GROUP-scope view — this is the belt-and-braces guarantee.
    useChatStore.setState({
      messages: [
        message({ id: 'pub1', body: 'PUBLIC-GROUP-PLAN', visibility: 'GROUP' }),
        message({
          id: 'leak_attempt_pair',
          body: 'PRIVATE-PAIR-SECRET',
          visibility: 'PRIVATE_PAIR',
          sender_id: 'carol',
          recipient_id: 'dave',
        }),
        message({
          id: 'leak_attempt_ai',
          body: 'PRIVATE-AI-SECRET',
          visibility: 'PRIVATE_AI',
          sender_id: 'odin_ai',
        }),
      ],
    });
  }

  it('renders zero PRIVATE_* content in the GROUP-scope conversation', () => {
    seedCache();
    const polluted = mergeMessages([], useChatStore.getState().messages);
    const scoped = filterMessagesForScope(polluted, {
      groupId: 'g1',
      visibility: 'GROUP',
      currentUserId: ME,
    });

    render(
      <MessageList
        messages={scoped}
        currentUserId={ME}
        typingUsers={[]}
        onReply={() => {}}
        onReact={() => {}}
        onEditSave={() => {}}
        onDelete={() => {}}
        onTogglePin={() => {}}
        onCreateTask={() => {}}
        onCreateDecision={() => {}}
        onUseAsContext={() => {}}
      />,
    );

    expect(screen.getByText('PUBLIC-GROUP-PLAN')).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE-PAIR-SECRET')).not.toBeInTheDocument();
    expect(screen.queryByText('PRIVATE-AI-SECRET')).not.toBeInTheDocument();
  });

  it('§176 — the search corpus derived for shared views excludes private rows', () => {
    seedCache();
    const corpus = filterMessagesForScope(
      mergeMessages([], useChatStore.getState().messages),
      { groupId: 'g1', visibility: 'GROUP', currentUserId: ME },
    );
    expect(corpus.some((m) => m.visibility !== 'GROUP')).toBe(false);
    expect(corpus.map((m) => m.body)).toEqual(['PUBLIC-GROUP-PLAN']);
  });

  it('audit probe — a foreign PRIVATE_AI row never renders in MY PRIVATE_AI view; my own does', () => {
    // Simulates the audit's cross-user leak even with a POLLUTED cache: a
    // teammate B's private AI message has reached device A. It must NOT
    // appear in A's /private AI conversation, while A's own private AI rows
    // still render (structural participation check via store scoping).
    const polluted = [
      message({ id: 'my_q', body: 'MY-OWN-AI-Q', visibility: 'PRIVATE_AI', sender_id: ME, recipient_id: 'ai' }),
      message({ id: 'my_a', body: 'MY-OWN-AI-A', visibility: 'PRIVATE_AI', sender_id: 'odin_ai', recipient_id: ME }),
      message({
        id: 'b_private_ai',
        body: 'B-PRIVATE-AI-SECRET',
        visibility: 'PRIVATE_AI',
        sender_id: 'userB',
        recipient_id: 'ai',
      }),
    ];
    const scoped = filterMessagesForScope(mergeMessages([], polluted), {
      groupId: 'g1',
      visibility: 'PRIVATE_AI',
      currentUserId: ME,
    });

    render(
      <MessageList
        messages={scoped}
        currentUserId={ME}
        typingUsers={[]}
        onReply={() => {}}
        onReact={() => {}}
        onEditSave={() => {}}
        onDelete={() => {}}
        onTogglePin={() => {}}
        onCreateTask={() => {}}
        onCreateDecision={() => {}}
        onUseAsContext={() => {}}
      />,
    );

    expect(screen.getByText('MY-OWN-AI-Q')).toBeInTheDocument();
    expect(screen.getByText('MY-OWN-AI-A')).toBeInTheDocument();
    expect(screen.queryByText('B-PRIVATE-AI-SECRET')).not.toBeInTheDocument();
  });
});
