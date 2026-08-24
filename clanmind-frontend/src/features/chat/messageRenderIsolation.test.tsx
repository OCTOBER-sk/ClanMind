/**
 * P14 — FE §203 render-isolation regression (spec-mandated behavior):
 *   "Only active response component should change on each stream batch.
 *    Do not rerender: every message …"
 *
 * Instrument note: React 19's <Profiler> reports a commit even when a memoized
 * child bails out (verified empirically), so commit counting cannot observe
 * memoization. Instead we count invocations of MessageActions — an
 * always-mounted child of every row — which fire exactly once per ACTUAL row
 * render. Zero extra invocations == zero inner renders == memo held.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

const rowRenders = vi.hoisted(() => ({ ids: [] as string[] }));

vi.mock('./MessageActions', () => ({
  MessageActions: (props: { message: { id: string } }) => {
    rowRenders.ids.push(props.message.id);
    return null;
  },
}));

import { MessageRow } from './MessageRow';
import { useAiStreamStore } from '@/features/ai/aiStreamStore';
import type { Message } from '@/types';

function makeMessage(id: string, body: string, senderType: 'USER' | 'AI' = 'USER'): Message {
  return {
    id,
    group_id: 'g1',
    sender_type: senderType,
    sender_id: senderType === 'AI' ? 'odin_ai' : 'u1',
    sender_name: senderType === 'AI' ? 'Odin' : 'Arun',
    body,
    visibility: 'GROUP',
    pinned: false,
    edited: false,
    deleted: false,
    attachments: [],
    reactions: [],
    created_at: new Date(Date.parse('2026-08-24T10:00:00Z')).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Fresh callback identities — the exact shape AppShell produces EVERY shell render. */
function freshCallbacks() {
  return {
    onReply: vi.fn(),
    onReact: vi.fn(),
    onEditSave: vi.fn(),
    onDelete: vi.fn(),
    onTogglePin: vi.fn(),
    onCreateTask: vi.fn(),
    onCreateDecision: vi.fn(),
    onUseAsContext: vi.fn(),
  };
}

function renderRow(message: Message, extra: Record<string, unknown> = {}) {
  return render(<MessageRow message={message} currentUserId="u1" {...freshCallbacks()} {...extra} />);
}

describe('FE §203 — a stream batch re-renders only the active row', () => {
  beforeEach(() => {
    useAiStreamStore.setState({ bodiesByMessage: {} });
    rowRenders.ids = [];
  });

  it('delta commits the streaming row and never touches any other row', () => {
    const idle = renderRow(makeMessage('m_idle', 'earlier answer'));
    const active = renderRow(makeMessage('m_active', '', 'AI'), { isStreaming: true });
    expect(rowRenders.ids).toEqual(['m_idle', 'm_active']); // mounts only

    // One stream batch lands for the ACTIVE message only.
    act(() => {
      useAiStreamStore.getState().setBody('m_active', 'streamed chunk');
    });

    // Exactly ONE additional row render occurred, and it was the active one.
    expect(rowRenders.ids).toEqual(['m_idle', 'm_active', 'm_active']);
    // Streamed text reached the active bubble; the idle row is untouched.
    expect(active.container.textContent).toContain('streamed chunk');
    expect(idle.container.textContent).toContain('earlier answer');
  });
});

describe('MessageRow memo comparator contract (enables §203)', () => {
  beforeEach(() => {
    useAiStreamStore.setState({ bodiesByMessage: {} });
    rowRenders.ids = [];
  });

  it('ignores fresh callback identities when content props are unchanged', () => {
    const msg = makeMessage('m1', 'stable body');
    const view = renderRow(msg);
    expect(rowRenders.ids).toEqual(['m1']);

    // Parent re-rendered with ALL-NEW function identities, identical content.
    view.rerender(
      <MessageRow message={msg} currentUserId="u1" {...freshCallbacks()} />,
    );
    // Comparator held: the row body never executed again.
    expect(rowRenders.ids).toEqual(['m1']);
  });

  it('re-renders when real content changes (edited body reaches the DOM)', () => {
    const view = renderRow(makeMessage('m1', 'v1'));
    view.rerender(
      <MessageRow message={makeMessage('m1', 'v2 — edited')} currentUserId="u1" {...freshCallbacks()} />,
    );
    expect(rowRenders.ids).toEqual(['m1', 'm1']);
    expect(view.container.textContent).toContain('v2 — edited');
  });
});
