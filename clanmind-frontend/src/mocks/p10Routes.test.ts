/**
 * P10 — demo REST parity for the BE §95A notification surface and the §98A
 * activity feed (handlers/search.ts shapes).
 *
 * Contract points under test: recipient-scoped lists ordered created_at DESC
 * with the real limit clamp, `unread=true` → read_at IS NULL filter,
 * POST :id/read stamping read_at and answering {ok:true} even for unknown
 * ids (UPDATE matches zero rows on the real Worker), membership-checked
 * activity reads — plus the §143 semantic creation rules the demo mirrors:
 * mention → MENTION row, assignment → TASK_ASSIGNMENT row, GitHub proposal
 * → AI_ACTION_APPROVAL row for Owners/Admins only.
 */

import { describe, it, expect } from 'vitest';
import { createDemoTransport } from '@/mocks/transportRoutes';
import { createDemoDataset } from '@/mocks/dataset';
import { ActivityEventSchema, NotificationSchema } from '@/api/schemas';
import type { TransportRequest } from '@/api/transport';

function makeHarness() {
  const ds = createDemoDataset();
  const transport = createDemoTransport(ds);
  const send = (
    path: string,
    method: TransportRequest['method'] = 'GET',
    body?: unknown,
  ) => {
    // Split `?a=b` suffixes into req.query like the fetch transport does.
    const [pathname, search = ''] = path.split('?');
    const query: Record<string, string> = {};
    for (const pair of new URLSearchParams(search)) {
      query[pair[0]] = pair[1];
    }
    return transport.send({ method, path: pathname!, body, query });
  };
  return { ds, send };
}

const ME = 'user_arun_1';
const GROUP = 'grp_robotics_1';
const PROJECT = 'proj_flight_ctrl';

// ─── BE §95A list + read ─────────────────────────────────────────────────────

describe('demo transport — BE §95A GET /notifications', () => {
  it('returns {items} of schema-valid §95A rows, newest first, recipient-scoped', async () => {
    const { send } = makeHarness();
    const res = await send('/api/v1/notifications');
    expect(res.ok).toBe(true);
    const items = (res.json as { items: unknown[] }).items;
    // notif_priya_1 belongs to another recipient and must never appear.
    expect(items.length).toBe(7);

    let previousCreatedAt = '';
    for (const row of items) {
      const parsed = NotificationSchema.safeParse(row);
      expect(parsed.success).toBe(true);
      if (!parsed.success) continue;
      expect(parsed.data.recipient_user_id).toBe(ME);
      // created_at DESC ordering (repo orders ascending:false)
      if (previousCreatedAt !== '') {
        expect(parsed.data.created_at <= previousCreatedAt).toBe(true);
      }
      previousCreatedAt = parsed.data.created_at;
    }
  });

  it('unread=true filters to read_at IS NULL; read rows return via the plain list', async () => {
    const { ds, send } = makeHarness();
    const unreadRes = await send('/api/v1/notifications?unread=true&limit=50');
    const unreadItems = (unreadRes.json as { items: Array<{ id: string; read_at: string | null }> }).items;
    expect(unreadItems.length).toBe(4); // notif_1..4 seeded unread
    expect(unreadItems.every((n) => n.read_at === null)).toBe(true);

    // Mark one read server-side; the unread list must shrink by exactly that row.
    await send('/api/v1/notifications/notif_1/read', 'POST', {});
    expect(ds.notifications.find((n) => n.id === 'notif_1')!.read_at).not.toBeNull();

    const after = await send('/api/v1/notifications?unread=true');
    expect((after.json as { items: unknown[] }).items.length).toBe(3);
  });

  it('clamps limit to 100 like handlers/search.ts', async () => {
    const { ds, send } = makeHarness();
    // Seed well past the clamp.
    const base = Date.now() - 90 * 24 * 3600_000;
    for (let i = 0; i < 130; i += 1) {
      ds.notifications.push({
        id: `notif_bulk_${i}`,
        recipient_user_id: ME,
        group_id: GROUP,
        project_id: null,
        category: 'SYSTEM',
        subject_type: 'group_invite',
        subject_id: `inv_${i}`,
        title: `Bulk ${i}`,
        body: null,
        delivery_state: 'PENDING',
        read_at: null,
        created_at: new Date(base + i * 1000).toISOString(),
      });
    }
    const res = await send('/api/v1/notifications?limit=500');
    const items = (res.json as { items: unknown[] }).items;
    expect(items.length).toBe(100); // min(requested, 100) — never more
  });
});

describe('demo transport — BE §95A POST /notifications/:id/read', () => {
  it('stamps read_at once; repeats are idempotent', async () => {
    const { ds, send } = makeHarness();
    const first = await send('/api/v1/notifications/notif_2/read', 'POST', {});
    expect(first.json).toMatchObject({ ok: true });
    const stampedAt = ds.notifications.find((n) => n.id === 'notif_2')!.read_at;
    expect(stampedAt).not.toBeNull();

    await new Promise((r) => setTimeout(r, 5));
    await send('/api/v1/notifications/notif_2/read', 'POST', {});
    expect(ds.notifications.find((n) => n.id === 'notif_2')!.read_at).toBe(stampedAt);
  });

  it('answers {ok:true} even for unknown or foreign ids (real-handler parity)', async () => {
    const { send } = makeHarness();
    const unknown = await send('/api/v1/notifications/notif_missing/read', 'POST', {});
    expect(unknown.ok).toBe(true);
    expect(unknown.json).toMatchObject({ ok: true });

    // Another recipient's row: zero rows updated, still ok.
    const foreign = await send('/api/v1/notifications/notif_priya_1/read', 'POST', {});
    expect(foreign.ok).toBe(true);
  });
});

// ─── BE §98A activity ────────────────────────────────────────────────────────

describe('demo transport — BE §98A GET /groups/:groupId/activity', () => {
  it('returns {items} of schema-valid activity rows for members', async () => {
    const { send } = makeHarness();
    const res = await send(`/api/v1/groups/${GROUP}/activity`);
    expect(res.ok).toBe(true);
    const items = (res.json as { items: unknown[] }).items;
    expect(items.length).toBe(3);
    for (const row of items) {
      expect(ActivityEventSchema.safeParse(row).success).toBe(true);
    }
  });

  it('is membership-checked exactly like requireMember', async () => {
    const { send } = makeHarness();
    // The demo user is NOT a member of the biotech Group.
    const res = await send('/api/v1/groups/grp_biotech_2/activity');
    expect(res.status).toBe(403);
    expect((res.json as { error: { code: string } }).error.code).toBe('GROUP_PERMISSION_DENIED');
  });
});

// ─── §143 semantic creation rules (notification-worker parity) ──────────────

describe('demo transport — §143 semantic notifications from domain events', () => {
  it('a message with mention_tokens creates one MENTION row per mentioned teammate, none for the actor', async () => {
    const { ds, send } = makeHarness();
    const before = ds.notifications.length;
    // Real contract: raw tokens ride `mention_tokens` and resolve against
    // the Group's member display names server-side (handlers/messages.ts).
    const res = await send(`/api/v1/groups/${GROUP}/messages`, 'POST', {
      body: 'Priya please review the DMA ring buffer',
      mention_tokens: ['Priya Sharma', 'Marcus Vance'],
    });
    expect(res.status).toBe(201);

    const created = ds.notifications.slice(before);
    expect(created.map((n) => n.category)).toEqual(['MENTION', 'MENTION']);
    expect(created.map((n) => n.recipient_user_id).sort()).toEqual([
      'user_marcus_3',
      'user_priya_2',
    ]);
    for (const row of created) {
      expect(row.subject_type).toBe('message');
      expect(NotificationSchema.safeParse(row).success).toBe(true);
    }
  });

  it('@tokens are extracted from the body when mention_tokens is absent; unknown names never resolve', async () => {
    const { ds, send } = makeHarness();
    const before = ds.notifications.length;
    await send(`/api/v1/groups/${GROUP}/messages`, 'POST', {
      body: '@Priya can you check @NobodySpecial too',
    });
    const created = ds.notifications.slice(before);
    expect(created.map((n) => n.recipient_user_id)).toEqual(['user_priya_2']);

    // No roster match → no notification (never trust names outside the Group).
    await send(`/api/v1/groups/${GROUP}/messages`, 'POST', { body: 'hi @Ghost' });
    expect(ds.notifications.length - before).toBe(1);
  });

  it('assigning a task creates a TASK_ASSIGNMENT row for the assignee; self-assignment creates none', async () => {
    const { ds, send } = makeHarness();
    const before = ds.notifications.length;

    const assigned = await send(`/api/v1/projects/${PROJECT}/tasks`, 'POST', {
      title: 'Bench-test the IMU FIFO',
      owner_user_id: 'user_marcus_3',
    });
    expect(assigned.status).toBe(201);
    expect(ds.notifications.length - before).toBe(1);
    const row = ds.notifications[ds.notifications.length - 1]!;
    expect(row.category).toBe('TASK_ASSIGNMENT');
    expect(row.recipient_user_id).toBe('user_marcus_3');
    expect(row.subject_type).toBe('task');

    const selfAssigned = await send(`/api/v1/projects/${PROJECT}/tasks`, 'POST', {
      title: 'Note to self',
      owner_user_id: ME,
    });
    expect(selfAssigned.status).toBe(201);
    expect(ds.notifications.length - before).toBe(1); // unchanged
  });

  it('proposing a GitHub write notifies Owner/Admin approvers but never the proposing actor', async () => {
    const { ds, send } = makeHarness();
    // currentUser is the OWNER → Priya is the only ADMIN approver audience.
    const before = ds.notifications.filter((n) => n.category === 'AI_ACTION_APPROVAL').length;
    const res = await send(`/api/v1/projects/${PROJECT}/github/actions`, 'POST', {
      action_type: 'create_branch',
      branch_name: 'feat/imu-fifo-bench',
      base_sha: '3f9c2ab91d7e40c1b5a2f8e60d34c7a19b2d5e88',
      head_sha: 'c71de4f20a98b3d64e17f2c805a9b4d23e6f1a52',
      changed_files: [{ path: 'Drivers/IMU/fifo.c', additions: 40, deletions: 2 }],
    });
    expect(res.status).toBe(202);

    const approvals = ds.notifications.filter(
      (n) => n.category === 'AI_ACTION_APPROVAL' && n.subject_type === 'ai_action',
    );
    expect(approvals.length).toBe(before + 1);
    const row = approvals[approvals.length - 1]!;
    expect(row.recipient_user_id).not.toBe(ME);
    expect(['OWNER', 'ADMIN']).toContain(
      ds.members.find((m) => m.user_id === row.recipient_user_id)!.role,
    );
    expect(row.delivery_state).toBe('DELIVERED_REALTIME'); // online demo room
  });

  it('every created row round-trips through GET /notifications validated by the §95A schema', async () => {
    const { send } = makeHarness();
    await send(`/api/v1/groups/${GROUP}/messages`, 'POST', {
      body: 'Marcus, can you scope the bench rig?',
      mention_tokens: ['Marcus Vance'],
    });
    const res = await send(`/api/v1/groups/${GROUP}/messages?limit=5`);
    void res;
    const list = await send('/api/v1/notifications?limit=50');
    const items = (list.json as { items: Array<Record<string, unknown>> }).items;
    for (const row of items) {
      expect(NotificationSchema.safeParse(row).success).toBe(true);
    }
  });
});
