/**
 * P11 — demo REST parity for the offline sync surface (BE §20 protocol +
 * §20A row shapes; DEMO-PARITY routes — the real Worker has the tables but
 * no sync endpoints yet, audit H3 / INTEGRATION_NOTES D25).
 *
 * Contract points under test: membership-checked batch push that applies
 * operations IN ORDER with per-op acks (§20 "server validates + applies …
 * returns acks/conflicts"), §19 idempotent message.create replay (same
 * client_operation_id → same logical message), §21.2 stale-version
 * task.update → version_mismatch conflict row with a deterministic id,
 * unsupported operation types REJECTED (never silent success), unresolved
 * conflict listing, and the §186A.4 resolution write-back through the SAME
 * row (stamps strategy/by/at; second resolve 409s).
 */

import { describe, it, expect } from 'vitest';
import { createDemoTransport } from '@/mocks/transportRoutes';
import { createDemoDataset } from '@/mocks/dataset';
import type { TransportRequest } from '@/api/transport';

function makeHarness() {
  const ds = createDemoDataset();
  const transport = createDemoTransport(ds);
  const send = (
    path: string,
    method: TransportRequest['method'] = 'GET',
    body?: unknown,
  ) => {
    const [pathname, search = ''] = path.split('?');
    const query: Record<string, string> = {};
    for (const pair of new URLSearchParams(search)) {
      query[pair[0]] = pair[1];
    }
    return transport.send({ method, path: pathname!, body, query });
  };
  return { ds, send };
}

const GROUP = 'grp_robotics_1';

function wireOp(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    client_operation_id: `client_op_${Math.random().toString(36).slice(2, 12)}`,
    operation_type: 'message.create',
    entity_type: 'message',
    entity_id: 'msg_local_1',
    action: 'CREATE',
    payload: { body: 'queued offline', visibility: 'GROUP' },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('demo transport — POST /groups/:g/sync/operations (BE §20 push)', () => {
  it('applies message.create ops as REAL dataset messages and answers APPLIED with result_reference', async () => {
    const { ds, send } = makeHarness();
    const op = wireOp({ entity_id: 'msg_local_a' });
    const res = await send(`/api/v1/groups/${GROUP}/sync/operations`, 'POST', { operations: [op] });
    expect(res.ok).toBe(true);
    const results = (res.json as { results: Array<{ status: string; result_reference: string | null }> }).results;
    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe('APPLIED');
    expect(results[0]!.result_reference).toBeTruthy();
    // The queued write became a genuine persisted message in order.
    const persisted = ds.messages.find((m) => m.client_message_id === op.client_operation_id);
    expect(persisted).toBeDefined();
    expect(persisted!.body).toBe('queued offline');
    expect(results[0]!.result_reference).toBe(persisted!.id);
  });

  it('is idempotent per §19 — replaying the same client_operation_id never duplicates the message', async () => {
    const { ds, send } = makeHarness();
    const op = wireOp({});
    await send(`/api/v1/groups/${GROUP}/sync/operations`, 'POST', { operations: [op] });
    const second = await send(`/api/v1/groups/${GROUP}/sync/operations`, 'POST', { operations: [op] });
    expect(second.ok).toBe(true);
    const results = (second.json as { results: Array<{ status: string }> }).results;
    expect(results[0]!.status).toBe('APPLIED');
    const copies = ds.messages.filter((m) => m.client_message_id === op.client_operation_id);
    expect(copies).toHaveLength(1);
  });

  it('records a version_mismatch CONFLICT (deterministic sc_<op> id) for stale task.update versions', async () => {
    const { ds, send } = makeHarness();
    const task = ds.tasks.find((t) => t.project_id === 'proj_flight_ctrl')!;
    const op = wireOp({
      operation_type: 'task.update',
      entity_type: 'task',
      entity_id: task.id,
      action: 'UPDATE',
      payload: {
        expected_version: task.version - 1, // captured offline; server moved on (§21.2)
        patch: { status: 'DONE' },
      },
    });
    const res = await send(`/api/v1/groups/${GROUP}/sync/operations`, 'POST', { operations: [op] });
    const result = (res.json as { results: Array<Record<string, unknown>> }).results[0]!;
    expect(result.status).toBe('CONFLICT');
    const conflict = result.conflict as Record<string, unknown>;
    expect(conflict.id).toBe(`sc_${op.client_operation_id}`);
    expect(conflict.conflict_type).toBe('version_mismatch');
    expect(conflict.server_payload).toMatchObject({ version: task.version });
    // The task was NOT overwritten.
    expect(ds.tasks.find((t) => t.id === task.id)!.status).not.toBe('DONE');
    // And the row is listed as unresolved.
    const list = await send(`/api/v1/groups/${GROUP}/sync/conflicts`);
    const items = (list.json as { items: Array<{ id: string }> }).items;
    expect(items.some((c) => c.id === `sc_${op.client_operation_id}`)).toBe(true);
  });

  it('REJECTS unsupported operation types instead of silently succeeding (§186A.2)', async () => {
    const { send } = makeHarness();
    const op = wireOp({ operation_type: 'artifact.version.create' });
    const res = await send(`/api/v1/groups/${GROUP}/sync/operations`, 'POST', { operations: [op] });
    const result = (res.json as { results: Array<{ status: string; error_message?: string }> }).results[0]!;
    expect(result.status).toBe('REJECTED');
    expect(result.error_message).toContain('Unsupported operation_type');
  });

  it('validates the batch envelope and membership like the real handlers would', async () => {
    const { send } = makeHarness();
    const empty = await send(`/api/v1/groups/${GROUP}/sync/operations`, 'POST', { operations: [] });
    expect(empty.status).toBe(400);
    expect((empty.json as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED');

    const badId = await send(`/api/v1/groups/${GROUP}/sync/operations`, 'POST', {
      operations: [{ client_operation_id: 'short', operation_type: 'message.create' }],
    });
    expect(badId.status).toBe(400);

    const foreign = await send('/api/v1/groups/grp_other/sync/operations', 'POST', {
      operations: [wireOp({})],
    });
    expect(foreign.status).toBe(403);
    expect((foreign.json as { error: { code: string } }).error.code).toBe('GROUP_PERMISSION_DENIED');
  });

  it('processes a MIXED batch strictly in order (apply → conflict → reject)', async () => {
    const { ds, send } = makeHarness();
    const task = ds.tasks.find((t) => t.project_id === 'proj_flight_ctrl')!;
    const ops = [
      wireOp({ entity_id: 'msg_local_m1' }),
      wireOp({
        operation_type: 'task.update',
        entity_type: 'task',
        entity_id: task.id,
        action: 'UPDATE',
        payload: { expected_version: 9999, patch: { priority: 'HIGH' } },
      }),
      wireOp({ operation_type: 'artifact.version.create', entity_id: 'art_x' }),
    ];
    const res = await send(`/api/v1/groups/${GROUP}/sync/operations`, 'POST', { operations: ops });
    const statuses = (res.json as { results: Array<{ status: string }> }).results.map((r) => r.status);
    expect(statuses).toEqual(['APPLIED', 'CONFLICT', 'REJECTED']);
  });
});

describe('demo transport — POST /sync/conflicts/:id/resolve (§186A.4)', () => {
  it('writes resolution_strategy / resolved_by / resolved_at back through the SAME row', async () => {
    const { ds, send } = makeHarness();
    const task = ds.tasks.find((t) => t.project_id === 'proj_flight_ctrl')!;
    const op = wireOp({
      operation_type: 'task.update',
      entity_type: 'task',
      entity_id: task.id,
      action: 'UPDATE',
      payload: { expected_version: 1, patch: { title: 'mine' } },
    });
    await send(`/api/v1/groups/${GROUP}/sync/operations`, 'POST', { operations: [op] });

    const res = await send(`/api/v1/sync/conflicts/sc_${op.client_operation_id}/resolve`, 'POST', {
      resolution_strategy: 'client_wins',
      resolved_by: 'user_arun_1',
    });
    expect(res.ok).toBe(true);
    const conflict = (res.json as { conflict: Record<string, unknown> }).conflict;
    expect(conflict.resolution_strategy).toBe('client_wins');
    expect(conflict.resolved_by).toBe('user_arun_1');
    expect(conflict.resolved_at).toBeTruthy();

    // The SAME dataset row was stamped — no duplicate flow was created.
    const stored = ds.syncConflicts.find((c) => c.id === `sc_${op.client_operation_id}`)!;
    expect(stored.resolution_strategy).toBe('client_wins');
    expect(stored.resolved_at).toBe(conflict.resolved_at);

    // No longer listed as unresolved.
    const list = await send(`/api/v1/groups/${GROUP}/sync/conflicts`);
    expect(
      (list.json as { items: Array<{ id: string }> }).items.some(
        (c) => c.id === `sc_${op.client_operation_id}`,
      ),
    ).toBe(false);
  });

  it('answers 409 for double-resolution, 404 for unknown rows, 400 for bad strategies', async () => {
    const { ds, send } = makeHarness();
    const task = ds.tasks.find((t) => t.project_id === 'proj_flight_ctrl')!;
    const op = wireOp({
      operation_type: 'task.update',
      entity_type: 'task',
      entity_id: task.id,
      action: 'UPDATE',
      payload: { expected_version: 1, patch: {} },
    });
    await send(`/api/v1/groups/${GROUP}/sync/operations`, 'POST', { operations: [op] });
    const id = `sc_${op.client_operation_id}`;

    const first = await send(`/api/v1/sync/conflicts/${id}/resolve`, 'POST', { resolution_strategy: 'server_wins' });
    expect(first.ok).toBe(true);
    const again = await send(`/api/v1/sync/conflicts/${id}/resolve`, 'POST', { resolution_strategy: 'merged' });
    expect(again.status).toBe(409);

    const missing = await send('/api/v1/sync/conflicts/sc_unknown/resolve', 'POST', {
      resolution_strategy: 'manual',
    });
    expect(missing.status).toBe(404);

    const invalid = await send(`/api/v1/sync/conflicts/${id}/resolve`, 'POST', {
      resolution_strategy: 'i_win',
    });
    expect(invalid.status).toBe(400);

    void ds;
  });
});
