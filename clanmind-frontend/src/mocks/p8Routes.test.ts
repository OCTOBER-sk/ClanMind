/**
 * P8 — demo REST parity for BE §111 tasks / §110 decisions / §108 memory
 * (handlers/intel.ts + handlers/memory.ts shapes).
 *
 * Contract points under test: §21.2 optimistic-concurrency CAS fields on
 * every mutation (409 CONFLICT on stale versions), server-side transition
 * guards (PROPOSED→APPROVED only), approve superseding sibling APPROVED
 * rows, candidate accept creating the §35 row, and §102 envelopes on bad
 * bodies — exactly what the real Worker answers.
 */

import { describe, it, expect } from 'vitest';
import { createDemoTransport } from '@/mocks/transportRoutes';
import { createDemoDataset } from '@/mocks/dataset';
import { TaskSchema } from '@/api/schemas';
import type { TransportRequest } from '@/api/transport';

function makeHarness() {
  const ds = createDemoDataset();
  const transport = createDemoTransport(ds);
  const send = (
    path: string,
    method: TransportRequest['method'] = 'GET',
    body?: unknown,
  ) => transport.send({ method, path, body });
  return { ds, send };
}

const PROJECT = 'proj_flight_ctrl';

// ─── BE §111 tasks ───────────────────────────────────────────────────────────

describe('demo transport — BE §111 tasks', () => {
  it('GET /projects/:id/tasks returns {items} of §48 rows validated by TaskSchema', async () => {
    const { send } = makeHarness();
    const res = await send(`/api/v1/projects/${PROJECT}/tasks`);
    expect(res.ok).toBe(true);
    const items = (res.json as { items: unknown[] }).items;
    expect(items.length).toBe(4);
    for (const row of items) {
      expect(TaskSchema.safeParse(row).success).toBe(true);
    }
  });

  it('POST creates with server defaults TODO/MEDIUM/version 1 and broadcasts task.created', async () => {
    const { ds, send } = makeHarness();
    const res = await send(`/api/v1/projects/${PROJECT}/tasks`, 'POST', {
      title: 'Wire CAN bus sniffer',
      description: 'Log cell voltages',
      owner_user_id: 'user_marcus_3',
    });
    expect(res.status).toBe(201);
    const task = res.json as Record<string, unknown>;
    expect(task).toMatchObject({
      title: 'Wire CAN bus sniffer',
      status: 'TODO',
      priority: 'MEDIUM',
      version: 1,
      owner_user_id: 'user_marcus_3',
    });
    expect(ds.tasks.some((t) => t.id === task.id)).toBe(true);

    const list = await send(`/api/v1/projects/${PROJECT}/tasks`);
    expect((list.json as { items: unknown[] }).items.length).toBe(5);
  });

  it('rejects invalid bodies with VALIDATION_FAILED (§102)', async () => {
    const { send } = makeHarness();
    const empty = await send(`/api/v1/projects/${PROJECT}/tasks`, 'POST', { title: '' });
    expect(empty.status).toBe(400);
    expect((empty.json as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED');

    const long = await send(`/api/v1/projects/${PROJECT}/tasks`, 'POST', {
      title: 'x'.repeat(301),
    });
    expect(long.status).toBe(400);
  });

  it('PATCH applies the patch, bumps version; stale expected_version → 409 CONFLICT', async () => {
    const { ds, send } = makeHarness();
    const before = ds.tasks.find((t) => t.id === 'task_1')!.version;
    const res = await send(`/api/v1/tasks/task_1`, 'PATCH', {
      expected_version: before,
      patch: { status: 'DONE' },
    });
    expect(res.ok).toBe(true);
    const updated = res.json as { version: number; status: string; completed_at: string | null };
    expect(updated.version).toBe(before + 1);
    expect(updated.status).toBe('DONE');
    expect(updated.completed_at).not.toBeNull();

    // Another writer wins first → the client's next CAS fails.
    const stale = await send(`/api/v1/tasks/task_1`, 'PATCH', {
      expected_version: before, // now stale
      patch: { status: 'CANCELLED' },
    });
    expect(stale.status).toBe(409);
    expect((stale.json as { error: { code: string } }).error.code).toBe('CONFLICT');
    expect(
      ((stale.json as { error: { message: string } }).error.message),
    ).toContain('changed elsewhere');
  });

  it('POST /complete is CAS-guarded and marks DONE', async () => {
    const { ds, send } = makeHarness();
    const before = ds.tasks.find((t) => t.id === 'task_2')!.version;
    const ok = await send(`/api/v1/tasks/task_2/complete`, 'POST', {
      expected_version: before,
    });
    expect(ok.ok).toBe(true);
    expect((ok.json as { status: string }).status).toBe('DONE');

    const again = await send(`/api/v1/tasks/task_2/complete`, 'POST', {
      expected_version: before, // stale now
    });
    expect(again.status).toBe(409);

    const missing = await send(`/api/v1/tasks/task_missing`, 'GET');
    expect(missing.status).toBe(404);
    void ds;
  });

  it('unknown project answers NOT_FOUND', async () => {
    const { send } = makeHarness();
    const res = await send('/api/v1/projects/proj_missing/tasks');
    expect(res.status).toBe(404);
  });
});

// ─── BE §110 decisions ───────────────────────────────────────────────────────

describe('demo transport — BE §110 decisions', () => {
  it('GET returns the log; POST lands PROPOSED with version 1', async () => {
    const { ds, send } = makeHarness();
    const list = await send(`/api/v1/projects/${PROJECT}/decisions`);
    expect((list.json as { items: unknown[] }).items.length).toBe(3);

    const res = await send(`/api/v1/projects/${PROJECT}/decisions`, 'POST', {
      title: 'Adopt FreeRTOS soft timers',
      context: 'Debounce polling wastes CPU.',
      options: [{ label: 'Soft timers' }, 'Busy-wait'],
    });
    expect(res.status).toBe(201);
    const decision = res.json as {
      status: string;
      version: number;
      proposed_by: string | null;
      options: Array<{ label: string }> | null;
    };
    expect(decision.status).toBe('PROPOSED'); // §122 default
    expect(decision.version).toBe(1);
    expect(decision.proposed_by).toBe(ds.currentUser.id);
    // §122 options persist into the §47 jsonb column (demo parity; the real
    // handler drops them today — D22).
    expect(decision.options).toEqual([{ label: 'Soft timers' }, { label: 'Busy-wait' }]);
  });

  it('approve is CAS-bound: PROPOSED→APPROVED stamps approver; stale version 409s', async () => {
    const { ds, send } = makeHarness();
    const proposed = ds.decisions.find((d) => d.id === 'dec_3')!;

    const stale = await send(`/api/v1/decisions/dec_3/approve`, 'POST', {
      expected_version: proposed.version + 7,
    });
    expect(stale.status).toBe(409);
    expect(proposed.status).toBe('PROPOSED');

    const ok = await send(`/api/v1/decisions/dec_3/approve`, 'POST', {
      expected_version: proposed.version,
    });
    expect(ok.ok).toBe(true);
    const approved = ok.json as {
      status: string;
      approved_by: string | null;
      approved_at: string | null;
      version: number;
    };
    expect(approved.status).toBe('APPROVED');
    expect(approved.approved_by).toBe(ds.currentUser.id);
    expect(approved.approved_at).not.toBeNull();

    // Approving supersedes the Project's other APPROVED rows (BE service).
    expect(ds.decisions.find((d) => d.id === 'dec_1')!.status).toBe('SUPERSEDED');
    expect(ds.decisions.find((d) => d.id === 'dec_2')!.status).toBe('SUPERSEDED');
  });

  it('approve of a non-PROPOSED decision conflicts; reject transitions terminal', async () => {
    const { ds, send } = makeHarness();
    // dec_1 is APPROVED in the dataset — approving again must 409…
    const approvedRow = ds.decisions.find((d) => d.id === 'dec_1')!;
    const doubleApprove = await send(`/api/v1/decisions/dec_1/approve`, 'POST', {
      expected_version: approvedRow.version,
    });
    expect(doubleApprove.status).toBe(409);

    // …and rejecting a fresh proposal works and is terminal.
    const res = await send(`/api/v1/projects/${PROJECT}/decisions`, 'POST', {
      title: 'Drop the legacy bootloader',
    });
    const created = res.json as { id: string; version: number };
    const rejected = await send(`/api/v1/decisions/${created.id}/reject`, 'POST', {
      expected_version: created.version,
    });
    expect(rejected.ok).toBe(true);
    expect(rejected.json).toMatchObject({ ok: true });
    expect(ds.decisions.find((d) => d.id === created.id)!.status).toBe('REJECTED');
  });
});

// ─── BE §108 memory ──────────────────────────────────────────────────────────

describe('demo transport — BE §108 memory', () => {
  const GROUP = 'grp_robotics_1';

  it('group memory lists GROUP scope only; project memory lists PROJECT scope only', async () => {
    const { send } = makeHarness();
    const group = await send(`/api/v1/groups/${GROUP}/memory`);
    const groupItems = (group.json as { items: Array<{ scope_type: string }> }).items;
    expect(groupItems.length).toBeGreaterThan(0);
    expect(groupItems.every((m) => m.scope_type === 'GROUP')).toBe(true);

    const project = await send(`/api/v1/projects/${PROJECT}/memory`);
    const projectItems = (project.json as { items: Array<{ scope_type: string }> }).items;
    expect(projectItems.length).toBeGreaterThan(0);
    expect(projectItems.every((m) => m.scope_type === 'PROJECT')).toBe(true);
  });

  it('candidates lists PENDING rows; accept creates the §35 row (201) and reject dismisses', async () => {
    const { ds, send } = makeHarness();
    const pending = await send(`/api/v1/groups/${GROUP}/memory/candidates`);
    const items = (pending.json as { items: Array<{ id: string; status: string }> }).items;
    expect(items.map((c) => c.id)).toContain('cand_1');
    expect(items.every((c) => c.status === 'PENDING')).toBe(true);

    const accepted = await send('/api/v1/memory/cand_1/accept', 'POST', {});
    expect(accepted.status).toBe(201);
    const memory = accepted.json as {
      scope_type: string;
      memory_type: string;
      content: string;
      confidence: number;
      status: string;
    };
    expect(memory.scope_type).toBe('PROJECT');
    expect(memory.memory_type).toBe('CONSTRAINT');
    expect(memory.content).toContain('disable the SPI peripheral');
    expect(memory.status).toBe('ACTIVE');
    expect(ds.memories.some((m) => m.content === memory.content)).toBe(true);

    // The accepted candidate leaves the pending list.
    const after = await send(`/api/v1/groups/${GROUP}/memory/candidates`);
    expect((after.json as { items: unknown[] }).items).toHaveLength(0);
  });

  it('accepting an already-handled candidate 404s like handlers/memory.ts', async () => {
    const { send } = makeHarness();
    await send('/api/v1/memory/cand_1/accept', 'POST', {});
    const twice = await send('/api/v1/memory/cand_1/accept', 'POST', {});
    expect(twice.status).toBe(404);
  });

  it('PATCH validates field ranges and updates content/importance', async () => {
    const { ds, send } = makeHarness();
    const empty = await send('/api/v1/memory/mem_1', 'PATCH', {});
    expect(empty.status).toBe(400);

    const bad = await send('/api/v1/memory/mem_1', 'PATCH', { importance: 4 });
    expect(bad.status).toBe(400);

    const ok = await send('/api/v1/memory/mem_1', 'PATCH', {
      content: 'Updated convention text.',
      importance: 0.9,
    });
    expect(ok.ok).toBe(true);
    const row = ds.memories.find((m) => m.id === 'mem_1')!;
    expect(row.content).toBe('Updated convention text.');
    expect(row.importance).toBe(0.9);
  });

  it('DELETE removes the row and subsequent GETs never see it', async () => {
    const { ds, send } = makeHarness();
    const res = await send('/api/v1/memory/mem_3', 'DELETE');
    expect(res.ok).toBe(true);
    expect(res.json).toMatchObject({ ok: true });
    expect(ds.memories.some((m) => m.id === 'mem_3')).toBe(false);

    const gone = await send('/api/v1/memory/mem_3', 'DELETE');
    expect(gone.status).toBe(404);
  });

  it('explicit-memory create rejects bad bodies; valid input persists (demo-parity route)', async () => {
    const { ds, send } = makeHarness();
    const badScope = await send(`/api/v1/groups/${GROUP}/memory`, 'POST', {
      scope_type: 'EVERYWHERE',
      content: 'nope',
    });
    expect(badScope.status).toBe(400);

    const res = await send(`/api/v1/groups/${GROUP}/memory`, 'POST', {
      scope_type: 'USER_PRIVATE',
      group_id: GROUP,
      memory_type: 'PREFERENCE',
      content: 'Prefers metric units.',
    });
    expect(res.status).toBe(201);
    expect(ds.memories.some((m) => m.content === 'Prefers metric units.')).toBe(true);
  });
});
