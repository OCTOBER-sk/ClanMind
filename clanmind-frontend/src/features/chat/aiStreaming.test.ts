/**
 * P5 — AI streaming polish (FE §134/§135/§136/§137/§138/§139/§140/§142/§218).
 *
 * Store/dispatch/controller level: batching, terminal commits, cancel,
 * retry-as-new-run, error metadata. Component rendering lives in
 * aiStreamingUi.test.tsx.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { dispatchRealtimeEvent, bindRunToMessage, cancelRunLocally } from '@/realtime/dispatch';
import { useChatStore } from '@/state/useChatStore';
import { useArtifactStore } from '@/state/useArtifactStore';
import { useAiStreamStore } from '@/features/ai/aiStreamStore';
import { useAuthStore } from '@/state/useAuthStore';
import { useGroupStore } from '@/state/useGroupStore';
import { setTransportOverride } from '@/api/transport';
import type { Transport, TransportRequest, TransportResponse } from '@/api/transport';
import { useChatController } from '@/features/chat/useChatController';
import type { Message, User, Group } from '@/types';

function envelope(eventType: string, payload: Record<string, unknown>) {
  return {
    protocol_version: 1,
    event_id: `evt_${Math.random()}`,
    event_type: eventType,
    sequence: 7000 + Math.floor(Math.random() * 1000),
    group_id: 'g1',
    actor_id: 'srv',
    visibility: 'GROUP',
    occurred_at: new Date().toISOString(),
    payload,
  };
}

function userMessage(id: string, body: string): Message {
  return {
    id,
    group_id: 'g1',
    sender_type: 'USER',
    sender_id: 'u1',
    sender_name: 'Arun',
    body,
    visibility: 'GROUP',
    pinned: false,
    edited: false,
    deleted: false,
    attachments: [],
    reactions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function resetStores(): void {
  useChatStore.setState({ messages: [], typingUsers: [], presenceOnlineCount: null });
  useArtifactStore.setState({ aiRunsByMessage: {}, artifacts: [], aiRunByArtifact: {} });
  useAiStreamStore.setState({ bodiesByMessage: {} });
}

const me: User = { id: 'u1', email: 'u@x.io', name: 'Arun', created_at: new Date().toISOString() };
const group: Group = {
  id: 'g1',
  name: 'Flight Controller',
  status: 'ACTIVE',
  ai_name: 'Odin',
  ai_proactivity: 'off',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function primeIdentity(): void {
  useAuthStore.setState({ user: me, isAuthenticated: true });
  useGroupStore.setState({ activeGroup: group });
}

describe('§135/§203 — batched streaming rendering', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStores();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid deltas into the stream store; chat store is untouched mid-stream', () => {
    useChatStore.getState().addMessage(userMessage('m_ai', ''));
    dispatchRealtimeEvent(envelope('ai.status', { message_id: 'm_ai', run_id: 'r1', status: 'RUNNING' }));

    // Five deltas inside one flush window — a per-token pipeline would have
    // written the chat store five times by now (§135 forbids exactly that).
    for (const delta of ['Hello ', 'brave ', 'new ', 'streaming ', 'world']) {
      dispatchRealtimeEvent(envelope('ai.delta', { run_id: 'r1', message_id: 'm_ai', delta }));
    }

    expect(useChatStore.getState().messages[0]!.body).toBe('');
    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(useAiStreamStore.getState().bodiesByMessage['m_ai']).toBe('Hello brave new streaming world');
    // Still no chat-store commit — deltas never leak into the shared list.
    expect(useChatStore.getState().messages[0]!.body).toBe('');
    // Exactly one STREAMING transition despite five deltas (§203).
    expect(useArtifactStore.getState().aiRunsByMessage['m_ai']?.status).toBe('STREAMING');
  });

  it('commits the body to the chat store EXACTLY once at the terminal event', () => {
    useChatStore.getState().addMessage(userMessage('m_ai', ''));
    dispatchRealtimeEvent(envelope('ai.status', { message_id: 'm_ai', run_id: 'r1', status: 'STREAMING' }));
    dispatchRealtimeEvent(envelope('ai.delta', { run_id: 'r1', message_id: 'm_ai', delta: 'partial ' }));

    const updates: string[] = [];
    const unsub = useChatStore.subscribe((state) => {
      const m = state.messages.find((x) => x.id === 'm_ai');
      if (m) updates.push(m.body);
    });

    act(() => {
      dispatchRealtimeEvent(
        envelope('ai.completed', { run_id: 'r1', message_id: 'm_ai', final_body: 'final answer' }),
      );
    });
    unsub();

    // One terminal write; intermediate flushes contributed nothing.
    expect(updates.filter((b) => b !== '')).toEqual(['final answer']);
    expect(useChatStore.getState().messages[0]!.body).toBe('final answer');
    expect(useAiStreamStore.getState().bodiesByMessage['m_ai']).toBeUndefined();
    expect(useArtifactStore.getState().aiRunsByMessage['m_ai']?.status).toBe('COMPLETED');
  });

  it('replays deltas that arrive before the REST start binds the run', () => {
    useChatStore.getState().addMessage(userMessage('m_ai', ''));
    // Delta first — run unbound — must buffer, not drop.
    dispatchRealtimeEvent(envelope('ai.delta', { run_id: 'r_live', delta: 'early ' }));
    expect(useAiStreamStore.getState().bodiesByMessage['m_ai']).toBeUndefined();

    act(() => {
      bindRunToMessage('r_live', 'm_ai');
      vi.advanceTimersByTime(120);
    });

    expect(useAiStreamStore.getState().bodiesByMessage['m_ai']).toBe('early ');
  });

  it('keeps fallback model metadata from ai.completed on the run (§142)', () => {
    useChatStore.getState().addMessage(userMessage('m_ai', ''));
    act(() => {
      dispatchRealtimeEvent(
        envelope('ai.completed', {
          run_id: 'r_fb',
          message_id: 'm_ai',
          final_body: 'done',
          model_used: 'secondary-fallback',
          is_fallback: true,
        }),
      );
    });
    const run = useArtifactStore.getState().aiRunsByMessage['m_ai'];
    expect(run?.is_fallback).toBe(true);
    expect(run?.model_used).toBe('secondary-fallback');
  });
});

describe('§137 — Stop / CANCELLED preserves partial content', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStores();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancelRunLocally keeps streamed partials and marks CANCELLED', () => {
    useChatStore.getState().addMessage(userMessage('m_ai', ''));
    dispatchRealtimeEvent(envelope('ai.status', { message_id: 'm_ai', run_id: 'r1', status: 'STREAMING' }));
    dispatchRealtimeEvent(envelope('ai.delta', { run_id: 'r1', message_id: 'm_ai', delta: 'kept partial' }));
    act(() => {
      vi.advanceTimersByTime(120);
    });

    act(() => {
      cancelRunLocally('m_ai');
    });

    expect(useChatStore.getState().messages[0]!.body).toBe('kept partial');
    expect(useArtifactStore.getState().aiRunsByMessage['m_ai']?.status).toBe('CANCELLED');
    expect(useAiStreamStore.getState().bodiesByMessage['m_ai']).toBeUndefined();
  });

  it('a server ai.status CANCELLED frame after local cancel is idempotent', () => {
    useChatStore.getState().addMessage(userMessage('m_ai', ''));
    dispatchRealtimeEvent(envelope('ai.status', { message_id: 'm_ai', run_id: 'r1', status: 'STREAMING' }));
    dispatchRealtimeEvent(envelope('ai.delta', { run_id: 'r1', message_id: 'm_ai', delta: 'partial' }));
    act(() => {
      cancelRunLocally('m_ai');
      dispatchRealtimeEvent(envelope('ai.status', { run_id: 'r1', message_id: 'm_ai', status: 'CANCELLED' }));
    });

    expect(useChatStore.getState().messages[0]!.body).toBe('partial');
    expect(useArtifactStore.getState().aiRunsByMessage['m_ai']?.status).toBe('CANCELLED');
  });
});

describe('§140 — failure keeps partial output + real error codes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStores();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ai.failed stores the provider failure code without discarding streamed text', () => {
    useChatStore.getState().addMessage(userMessage('m_ai', ''));
    dispatchRealtimeEvent(envelope('ai.status', { message_id: 'm_ai', run_id: 'r1', status: 'STREAMING' }));
    dispatchRealtimeEvent(envelope('ai.delta', { run_id: 'r1', message_id: 'm_ai', delta: 'half an answer' }));
    act(() => {
      vi.advanceTimersByTime(120);
      dispatchRealtimeEvent(
        envelope('ai.failed', { run_id: 'r1', message_id: 'm_ai', failure_code: 'PROVIDER_TIMEOUT' }),
      );
    });

    expect(useChatStore.getState().messages[0]!.body).toBe('half an answer');
    const run = useArtifactStore.getState().aiRunsByMessage['m_ai'];
    expect(run?.status).toBe('FAILED');
    expect(run?.error_code).toBe('PROVIDER_TIMEOUT');
  });
});

describe('§138/§139 — Retry / Regenerate start NEW runs', () => {
  const requests: TransportRequest[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    resetStores();
    primeIdentity();
    requests.length = 0;
    const stub: Transport = {
      async send(req) {
        requests.push(req);
        const response: TransportResponse = { status: 200, ok: true, json: {} };
        return response;
      },
    };
    setTransportOverride(stub);
  });
  afterEach(() => {
    setTransportOverride(null);
    vi.useRealTimers();
  });

  it('retryAiResponse appends a fresh AI shell and leaves the previous response intact', () => {
    const chat = useChatStore.getState();
    chat.addMessage(userMessage('m_user', '@odin design the bus map'));
    chat.addMessage({ ...userMessage('m_old_ai', ''), id: 'm_old_ai', sender_type: 'AI', sender_name: 'Odin', body: 'old completed answer' });
    useArtifactStore.getState().setAiRunByMessage('m_old_ai', {
      id: 'run_old',
      group_id: 'g1',
      status: 'COMPLETED',
      mode: 'ASSIST',
      prompt: 'design the bus map',
      tool_calls: [],
      sources: [],
      created_artifacts: ['art_1'],
      created_at: new Date().toISOString(),
    });

    const { result } = renderHook(() => useChatController());
    act(() => {
      result.current.retryAiResponse('m_old_ai');
    });

    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(3);
    expect(messages.find((m) => m.id === 'm_old_ai')!.body).toBe('old completed answer');
    const fresh = messages[messages.length - 1]!;
    expect(fresh.sender_type).toBe('AI');
    expect(fresh.body).toBe('');
    const freshRun = useArtifactStore.getState().aiRunsByMessage[fresh.id];
    expect(freshRun?.status).toBe('QUEUED');
    expect(freshRun?.prompt).toBe('design the bus map');
    expect(freshRun?.id).not.toBe('run_old');
  });

  it('stopAiRun posts the REST cancel route and applies local terminal state (§106/§137)', () => {
    const chat = useChatStore.getState();
    chat.addMessage(userMessage('m_user', '@odin hello'));
    chat.addMessage({ ...userMessage('m_ai', ''), id: 'm_ai', sender_type: 'AI', sender_name: 'Odin', body: '' });
    useArtifactStore.getState().setAiRunByMessage('m_ai', {
      id: 'run_live_uuid',
      group_id: 'g1',
      status: 'STREAMING',
      mode: 'ASSIST',
      prompt: 'hello',
      tool_calls: [],
      sources: [],
      created_artifacts: [],
      created_at: new Date().toISOString(),
    });

    const { result } = renderHook(() => useChatController());
    act(() => {
      result.current.stopAiRun('m_ai');
    });

    const cancel = requests.find((r) => r.method === 'POST' && r.path.includes('/ai/runs/run_live_uuid/cancel'));
    expect(cancel).toBeDefined();
    expect(useArtifactStore.getState().aiRunsByMessage['m_ai']?.status).toBe('CANCELLED');
  });

  it('§139 artifact events merge as new versions, never overwrite', () => {
    const base = {
      id: 'art_lineage',
      group_id: 'g1',
      title: 'Blueprint',
      artifact_type: 'ARCHITECTURE' as const,
      current_version: 1,
      pinned: false,
      used_as_context: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      versions: [
        {
          version_number: 1,
          content: 'v1',
          created_by_name: 'Odin',
          created_at: new Date().toISOString(),
        },
      ],
    };
    useArtifactStore.getState().mergeArtifactVersion({ ...base });
    act(() => {
      dispatchRealtimeEvent(
        envelope('artifact.event', {
          kind: 'created',
          artifact: {
            ...base,
            current_version: 2,
            versions: [
              {
                version_number: 2,
                content: 'v2 regenerated',
                created_by_name: 'Odin',
                created_at: new Date().toISOString(),
              },
            ],
          },
        }),
      );
    });

    const store = useArtifactStore.getState();
    expect(store.artifacts).toHaveLength(1);
    expect(store.artifacts[0]!.versions.map((v) => v.version_number)).toEqual([1, 2]);
    expect(store.artifacts[0]!.current_version).toBe(2);
    // Replayed identical version payloads are idempotent (no duplicate rows).
    act(() => {
      dispatchRealtimeEvent(
        envelope('artifact.event', {
          kind: 'created',
          artifact: {
            ...base,
            current_version: 2,
            versions: [
              {
                version_number: 2,
                content: 'v2 regenerated',
                created_by_name: 'Odin',
                created_at: new Date().toISOString(),
              },
            ],
          },
        }),
      );
    });
    expect(useArtifactStore.getState().artifacts[0]!.versions).toHaveLength(2);
  });
});
