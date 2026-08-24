/**
 * P8 — dispatch projections for the BE §18 project-intelligence fan-out:
 * task.created/updated/assigned/completed/cancelled, decision.proposed/
 * approved/rejected/updated, memory.candidate.created/approved/updated/
 * deleted.
 *
 * Key honesty property: notify-stub payloads (ids only — what the real
 * backend ships today per INTEGRATION_NOTES D15/D21) never fabricate rows.
 * Full §47/§48/§35 rows merge; stubs only flip statuses of ALREADY-HELD rows.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchRealtimeEvent } from '@/realtime/dispatch';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import type { RealtimeEvent } from '@/realtime/events';
import type { Decision, MemoryCandidate, Task } from '@/types';

const TASK: Task = {
  id: 'task_rt_1',
  project_id: 'proj_1',
  title: 'Realtime task',
  description: null,
  owner_user_id: null,
  status: 'TODO',
  priority: 'MEDIUM',
  due_at: null,
  version: 1,
  created_by_user_id: null,
  created_by_ai_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  completed_at: null,
};

const DECISION: Decision = {
  id: 'dec_rt_1',
  project_id: 'proj_1',
  title: 'Realtime decision',
  context: null,
  rationale: null,
  status: 'PROPOSED',
  version: 1,
  proposed_by: null,
  approved_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  approved_at: null,
};

function event(event_type: string, payload: unknown): RealtimeEvent {
  return {
    event_type,
    group_id: 'grp_1',
    payload,
  } as unknown as RealtimeEvent;
}

describe('dispatch — task fan-out', () => {
  beforeEach(() => {
    useProjectDataStore.setState({ tasks: [], decisions: [], memories: [], memoryCandidates: [] });
  });

  it('task.created with a full row upserts the store', () => {
    dispatchRealtimeEvent(event('task.created', { task: TASK }));
    expect(useProjectDataStore.getState().tasks).toHaveLength(1);
    expect(useProjectDataStore.getState().tasks[0]!.title).toBe('Realtime task');
  });

  it('task.updated replaces the held row with the server version', () => {
    useProjectDataStore.getState().upsertTask(TASK);
    dispatchRealtimeEvent(
      event('task.updated', {
        task: { ...TASK, status: 'IN_PROGRESS', version: 2 },
      }),
    );
    const row = useProjectDataStore.getState().tasks[0]!;
    expect(row.status).toBe('IN_PROGRESS');
    expect(row.version).toBe(2);
  });

  it('sparse task.completed stub flips ONLY an already-held row to DONE', () => {
    useProjectDataStore.getState().upsertTask(TASK);
    dispatchRealtimeEvent(event('task.completed', { task_id: TASK.id }));
    expect(useProjectDataStore.getState().tasks[0]!.status).toBe('DONE');

    // Unknown id → nothing fabricated.
    dispatchRealtimeEvent(event('task.completed', { task_id: 'task_ghost' }));
    expect(useProjectDataStore.getState().tasks).toHaveLength(1);
  });

  it('a full-row-only vocabulary: bare stubs without ids are ignored entirely', () => {
    dispatchRealtimeEvent(event('task.created', { task_id: 'task_sparse' }));
    expect(useProjectDataStore.getState().tasks).toHaveLength(0);
  });
});

describe('dispatch — decision fan-out', () => {
  beforeEach(() => {
    useProjectDataStore.setState({ tasks: [], decisions: [], memories: [], memoryCandidates: [] });
  });

  it('decision.approved with a full row merges the new status', () => {
    useProjectDataStore.getState().upsertDecision(DECISION);
    dispatchRealtimeEvent(
      event('decision.approved', {
        decision: { ...DECISION, status: 'APPROVED', approved_by: 'user_a', version: 2 },
      }),
    );
    const row = useProjectDataStore.getState().decisions[0]!;
    expect(row.status).toBe('APPROVED');
    expect(row.approved_by).toBe('user_a');
  });

  it('notify-stub decision.proposed (id only) is tolerated and ignored', () => {
    dispatchRealtimeEvent(event('decision.proposed', { decision_id: 'dec_stub' }));
    expect(useProjectDataStore.getState().decisions).toHaveLength(0);
  });
});

describe('dispatch — memory fan-out', () => {
  beforeEach(() => {
    useProjectDataStore.setState({ tasks: [], decisions: [], memories: [], memoryCandidates: [] });
  });

  it('memory.candidate.created adds a PENDING candidate for the §117 banner', () => {
    dispatchRealtimeEvent(
      event('memory.candidate.created', {
        candidate: {
          id: 'cand_rt',
          group_id: 'grp_1',
          candidate_type: 'CONSTRAINT',
          content: 'Never flash during telemetry.',
          confidence: 0.8,
          recommended_scope: 'PROJECT',
          created_at: new Date().toISOString(),
        },
      }),
    );
    const candidates = useProjectDataStore.getState().memoryCandidates;
    expect(candidates).toHaveLength(1);
    const cand = candidates[0] as MemoryCandidate;
    expect(cand.status).toBe('PENDING');
    expect(cand.recommended_scope).toBe('PROJECT');
  });

  it('memory.approved merges the memory row AND removes the originating candidate', () => {
    useProjectDataStore
      .getState()
      .upsertMemoryCandidate({
        id: 'cand_gone',
        group_id: 'grp_1',
        project_id: null,
        user_id: null,
        source_message_id: null,
        candidate_type: 'FACT',
        content: 'x',
        confidence: 0.5,
        recommended_scope: 'GROUP',
        status: 'PENDING',
        created_at: new Date().toISOString(),
      });
    dispatchRealtimeEvent(
      event('memory.approved', {
        memory: {
          id: 'mem_new',
          scope_type: 'GROUP',
          group_id: 'grp_1',
          project_id: null,
          user_id: null,
          memory_type: 'CONVENTION',
          content: 'PRs require two reviewers.',
          confidence: 0.9,
          importance: 0.7,
          source_type: 'candidate_accepted',
          status: 'ACTIVE',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        candidate_id: 'cand_gone',
      }),
    );
    const state = useProjectDataStore.getState();
    expect(state.memories.map((m) => m.id)).toContain('mem_new');
    expect(state.memoryCandidates).toHaveLength(0);
  });

  it('memory.deleted removes by id', () => {
    useProjectDataStore.getState().upsertMemory({
      id: 'mem_del',
      scope_type: 'GROUP',
      group_id: 'grp_1',
      project_id: null,
      user_id: null,
      memory_type: 'FACT',
      content: 'to be removed',
      confidence: 0.5,
      importance: 0.5,
      source_type: 'conversation',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    dispatchRealtimeEvent(event('memory.deleted', { memory_id: 'mem_del' }));
    expect(useProjectDataStore.getState().memories).toHaveLength(0);
  });
});
