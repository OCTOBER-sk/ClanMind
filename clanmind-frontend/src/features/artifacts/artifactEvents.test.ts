/**
 * P6 — realtime dispatch of the BE §75 artifact streaming vocabulary
 * (FE §97/§252/§251) plus the legacy `artifact.event` path (§139).
 *
 * Contract honesty: metadata-only stubs (D15) open a construction trace but
 * never fabricate store content; full inline rows (demo parity, D17) merge.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { dispatchRealtimeEvent, bindRunToMessage } from '@/realtime/dispatch';
import { useArtifactStore } from '@/state/useArtifactStore';
import { useChatStore } from '@/state/useChatStore';
import { useConstructionStore } from '@/features/artifacts/constructionStore';
import type { Artifact, Message } from '@/types';

function envelope(eventType: string, payload: Record<string, unknown>) {
  return {
    protocol_version: 1,
    event_id: `evt_${Math.random()}`,
    event_type: eventType,
    sequence: 8000 + Math.floor(Math.random() * 1000),
    group_id: 'g1',
    actor_id: 'srv',
    visibility: 'GROUP',
    occurred_at: new Date().toISOString(),
    payload,
  };
}

const inlineArtifact = (id: string): Artifact => ({
  id,
  group_id: 'g1',
  title: 'Live blueprint',
  artifact_type: 'ARCHITECTURE',
  current_version: 1,
  pinned: false,
  used_as_context: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  versions: [
    {
      version_number: 1,
      content: '',
      created_by_name: 'Odin',
      created_at: new Date().toISOString(),
    },
  ],
});

function seedRunBoundMessage(): void {
  const shell: Message = {
    id: 'm_ai_1',
    group_id: 'g1',
    sender_type: 'AI',
    sender_id: 'odin_ai',
    sender_name: 'Odin',
    body: '',
    visibility: 'GROUP',
    pinned: false,
    edited: false,
    deleted: false,
    attachments: [],
    reactions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  useChatStore.getState().addMessage(shell);
}

function resetStores(): void {
  useChatStore.setState({ messages: [], typingUsers: [], presenceOnlineCount: null });
  useArtifactStore.setState({
    aiRunsByMessage: {},
    artifacts: [],
    aiRunByArtifact: {},
    activeArtifact: null,
    activeVersionNumber: 1,
    compareVersionNumber: null,
    rightPanelMode: 'closed',
  });
  useConstructionStore.setState({ byArtifact: {} });
}

describe('dispatch — BE §75 artifact vocabulary', () => {
  beforeEach(resetStores);

  it('artifact.created with a stub opens a trace but stores nothing (D15)', () => {
    // No run bound → not even a trace-worthy binding; still must not crash.
    act(() => {
      dispatchRealtimeEvent(envelope('artifact.created', { artifact_id: 'art_stub', version: 1 }));
    });
    expect(useArtifactStore.getState().artifacts).toHaveLength(0);
    // Trace exists so a manually-opened panel can show honest build status.
    expect(useConstructionStore.getState().byArtifact['art_stub']?.phase).toBe('constructing');
  });

  it('artifact.node.created / edge.created accumulate draft content', () => {
    act(() => {
      dispatchRealtimeEvent(envelope('artifact.created', { artifact_id: 'art_live', version: 1 }));
    });
    act(() => dispatchRealtimeEvent(envelope('artifact.node.created', {
      artifact_id: 'art_live',
      node: { id: 'n1', label: 'IMU', kind: 'sensor' },
    })));
    act(() => dispatchRealtimeEvent(envelope('artifact.edge.created', {
      artifact_id: 'art_live',
      edge: { source: 'n1', target: 'n2' },
    })));
    const c = useConstructionStore.getState().byArtifact['art_live']!;
    expect(c.nodeOrder).toEqual(['n1']);
    expect(c.edgeOrder).toEqual(['n1->n2']);
    expect(c.statusText).toBe('Building · 1 node');
  });

  it('artifact.completed merges the final row and settles the build (§100)', () => {
    act(() => {
      dispatchRealtimeEvent(envelope('artifact.completed', {
        artifact_id: 'art_done',
        artifact: {
          ...inlineArtifact('art_done'),
          versions: [{
            version_number: 1,
            content: JSON.stringify({ nodes: [{ id: 'a', label: 'A' }], edges: [] }),
            created_by_name: 'Odin',
            created_at: new Date().toISOString(),
          }],
        },
      }));
    });
    const stored = useArtifactStore.getState().artifacts.find((a) => a.id === 'art_done');
    expect(stored).toBeDefined();
    expect(stored!.versions[0]!.content).toContain('"nodes"');
    expect(useConstructionStore.getState().byArtifact['art_done']?.phase).toBe('ready');
  });

  it('render_state.updated updates textual status only', () => {
    act(() => {
      dispatchRealtimeEvent(envelope('artifact.render_state.updated', {
        artifact_id: 'art_rs',
        state: 'Settling layout',
      }));
    });
    expect(useConstructionStore.getState().byArtifact['art_rs']?.statusText).toBe('Settling layout');
    expect(useArtifactStore.getState().artifacts).toHaveLength(0);
  });

  it('§252 — auto-open happens only for run-bound creations with content', () => {
    seedRunBoundMessage();
    // Mirror the REST start path: run_id → shell bubble binding.
    bindRunToMessage('run_x', 'm_ai_1');

    act(() => {
      dispatchRealtimeEvent(
        envelope('artifact.event', { kind: 'created', artifact: inlineArtifact('art_new'), run_id: 'run_x' }),
      );
    });

    const state = useArtifactStore.getState();
    expect(state.rightPanelMode).toBe('artifact');
    expect(state.activeArtifact?.id).toBe('art_new');
  });

  it('§252 — unbound creations never yank the panel', () => {
    act(() => {
      dispatchRealtimeEvent(envelope('artifact.event', { kind: 'created', artifact: inlineArtifact('art_orphan') }));
    });
    expect(useArtifactStore.getState().rightPanelMode).toBe('closed');
  });

  it('§251/§139 — a second version of the same artifact does not re-open construction', () => {
    seedRunBoundMessage();
    bindRunToMessage('run_x', 'm_ai_1');
    const v1 = inlineArtifact('art_lin');
    act(() => {
      dispatchRealtimeEvent(envelope('artifact.event', { kind: 'created', artifact: v1, run_id: 'run_x' }));
    });
    useConstructionStore.getState().completeConstruction('art_lin');
    expect(useConstructionStore.getState().byArtifact['art_lin']?.phase).toBe('ready');

    act(() => {
      dispatchRealtimeEvent(envelope('artifact.event', { kind: 'version', artifact: {
        ...v1,
        current_version: 2,
        versions: [...v1.versions, {
          version_number: 2,
          content: '{}',
          created_by_name: 'Odin',
          created_at: new Date().toISOString(),
        }],
      }, run_id: 'run_x' }));
    });

    // `kind:'version'` merges but must NOT restart the build trace.
    expect(useConstructionStore.getState().byArtifact['art_lin']?.phase).toBe('ready');
    expect(useArtifactStore.getState().artifacts[0]!.current_version).toBe(2);
  });
});
