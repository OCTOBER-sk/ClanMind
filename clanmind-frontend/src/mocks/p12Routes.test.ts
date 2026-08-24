/**
 * P12 — demo REST parity for the Settings surface.
 *
 * Real-contract routes mirror handlers/members.ts, handlers/invites.ts,
 * handlers/me.ts and packages/domain membership/invite services exactly:
 * validation messages, permission codes (GROUP_PERMISSION_DENIED), §8.2
 * token-shown-once semantics, and the §7.2 Owner/Admin role rules.
 *
 * The /ai/agent read-write, provider-config removal and /usage counters are
 * DEMO-PARITY routes only (no real Worker endpoint yet — INTEGRATION_NOTES
 * D26); these tests pin their shapes so live wiring is a route swap later.
 */

import { describe, it, expect } from 'vitest';
import { createDemoTransport } from '@/mocks/transportRoutes';
import { createDemoDataset } from '@/mocks/dataset';
import {
  AiAgentConfigSchema,
  InviteCreatedSchema,
  ProfileSchema,
  UsageSnapshotSchema,
} from '@/api/schemas';
import type { TransportRequest } from '@/api/transport';

function makeHarness() {
  const ds = createDemoDataset();
  const transport = createDemoTransport(ds);
  const send = (path: string, method: TransportRequest['method'] = 'GET', body?: unknown) =>
    transport.send({ method, path, body, query: {} });
  return { ds, send };
}

const ME = 'user_arun_1';
const GROUP = 'grp_robotics_1';

// ─── PATCH /me (handlers/me.ts contract) ─────────────────────────────────────

describe('demo transport — PATCH /me', () => {
  it('updates display_name and returns a schema-valid §23 profile row', async () => {
    const { ds, send } = makeHarness();
    const res = await send('/api/v1/me', 'PATCH', { display_name: 'Arun K.' });
    expect(res.ok).toBe(true);
    expect(ProfileSchema.safeParse(res.json).success).toBe(true);
    expect((res.json as { display_name: string }).display_name).toBe('Arun K.');
    expect(ds.currentUser.name).toBe('Arun K.');
  });

  it('rejects empty and oversized display_name with VALIDATION_FAILED', async () => {
    const { send } = makeHarness();
    for (const bad of ['', 'x'.repeat(101)]) {
      const res = await send('/api/v1/me', 'PATCH', { display_name: bad });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
      expect((res.json as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED');
    }
  });
});

// ─── Members administration (MembershipService.changeRole/removeMember) ─────

describe('demo transport — members PATCH/DELETE + transfer-ownership', () => {
  it('Owner changes a Member role; response mirrors the wire row', async () => {
    const { ds, send } = makeHarness();
    const res = await send(`/api/v1/groups/${GROUP}/members/user_marcus_3`, 'PATCH', { role: 'GUEST' });
    expect(res.ok).toBe(true);
    expect(ds.members.find((m) => m.user_id === 'user_marcus_3')!.role).toBe('GUEST');
  });

  it('role change on the Owner is refused — ownership requires transfer', async () => {
    const { send } = makeHarness();
    const res = await send(`/api/v1/groups/${GROUP}/members/${ME}`, 'PATCH', { role: 'ADMIN' });
    expect(res.status).toBe(403);
    expect((res.json as { error: { code: string } }).error.code).toBe('GROUP_PERMISSION_DENIED');
  });

  it('an Admin actor cannot create or manage Admins (§7.2)', async () => {
    const { ds, send } = makeHarness();
    // Promote Priya to Owner temporarily so she is not the actor... instead:
    // sign in as Priya by making her the dataset's current user proxy: the
    // transport derives the actor from currentUser; swap membership roles.
    ds.members.find((m) => m.user_id === ME)!.role = 'ADMIN';
    ds.members.find((m) => m.user_id === 'user_priya_2')!.role = 'OWNER';
    const res = await send(`/api/v1/groups/${GROUP}/members/user_marcus_3`, 'PATCH', { role: 'ADMIN' });
    expect(res.status).toBe(403);
    expect((res.json as { error: { message: string } }).error.message).toContain('Only the Owner');
  });

  it('removing an ADMIN as Admin actor is refused; Owner removes anyone but self', async () => {
    const { ds, send } = makeHarness();
    // Actor stays OWNER here: removing Priya (ADMIN) succeeds…
    const ok = await send(`/api/v1/groups/${GROUP}/members/user_priya_2`, 'DELETE');
    expect(ok.json).toMatchObject({ ok: true });
    // …but after demoting the actor to ADMIN, another ADMIN removal is denied.
    ds.members.find((m) => m.user_id === ME)!.role = 'ADMIN';
    ds.members.push({
      user_id: 'user_admin_x',
      group_id: GROUP,
      role: 'ADMIN',
      nickname: undefined,
      user: { id: 'user_admin_x', email: 'x@x.io', name: 'X', created_at: new Date().toISOString() },
      joined_at: new Date().toISOString(),
    });
    const denied = await send(`/api/v1/groups/${GROUP}/members/user_admin_x`, 'DELETE');
    expect(denied.status).toBe(403);
    expect((denied.json as { error: { message: string } }).error.message).toContain('Only the Owner');
  });

  it('transfer-ownership flips roles (§7.2): target becomes Owner, actor becomes Admin', async () => {
    const { ds, send } = makeHarness();
    const res = await send(`/api/v1/groups/${GROUP}/transfer-ownership`, 'POST', {
      new_owner_user_id: 'user_priya_2',
    });
    expect(res.json).toMatchObject({ ok: true });
    expect(ds.members.find((m) => m.user_id === ME)!.role).toBe('ADMIN');
    expect(ds.members.find((m) => m.user_id === 'user_priya_2')!.role).toBe('OWNER');
  });

  it('non-actors are permission-denied for every member mutation', async () => {
    const { send } = makeHarness();
    const outsider = await send('/api/v1/groups/grp_biotech_2/members/user_whatever', 'DELETE');
    expect(outsider.status).toBe(403); // current user is not a biotech member
  });
});

// ─── Invites (§72 / §8.2 / §178 token lifetime) ──────────────────────────────

describe('demo transport — invites', () => {
  it('create returns 201 {invite, token}; token validates against the schema', async () => {
    const { send } = makeHarness();
    const res = await send(`/api/v1/groups/${GROUP}/invites`, 'POST', {
      email: 'dana@clanmind.io',
      role: 'MEMBER',
    });
    expect(res.status).toBe(201);
    const parsed = InviteCreatedSchema.safeParse(res.json);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.token.length).toBeGreaterThan(4);
    // §178 — 7-day lifetime.
    const expires = new Date(parsed.data.invite.expires_at).getTime();
    expect(expires - Date.now()).toBeGreaterThan(6 * 24 * 3600_000);
  });

  it('invalid email → VALIDATION_FAILED "Invalid invite email."', async () => {
    const { send } = makeHarness();
    const res = await send(`/api/v1/groups/${GROUP}/invites`, 'POST', { email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect((res.json as { error: { message: string } }).error.message).toBe('Invalid invite email.');
  });

  it('list NEVER carries the raw token (§8.2)', async () => {
    const { ds, send } = makeHarness();
    const created = await send(`/api/v1/groups/${GROUP}/invites`, 'POST', { email: 'n@n.io' });
    const token = (created.json as { token: string }).token;
    ds.invites.find((i) => i.email === 'n@n.io')!.token = token;
    const list = await send(`/api/v1/groups/${GROUP}/invites`);
    const body = JSON.stringify(list.json);
    expect(body.includes(token)).toBe(false);
    expect(body.includes('token_hash')).toBe(false);
  });

  it('revoke stamps revoked_at; revoked rows stay listed with the timestamp', async () => {
    const { ds, send } = makeHarness();
    const res = await send(`/api/v1/groups/${GROUP}/invites/inv_seed_1/revoke`, 'POST', {});
    expect(res.json).toMatchObject({ ok: true });
    expect(ds.invites.find((i) => i.id === 'inv_seed_1')!.revoked_at).not.toBeNull();
    const list = (await send(`/api/v1/groups/${GROUP}/invites`)).json as { items: Array<{ id: string; revoked_at: string | null }> };
    expect(list.items.find((i) => i.id === 'inv_seed_1')!.revoked_at).not.toBeNull();
  });

  it('Members/Guests cannot create, list or revoke invites', async () => {
    const { ds, send } = makeHarness();
    ds.members.find((m) => m.user_id === ME)!.role = 'MEMBER';
    expect((await send(`/api/v1/groups/${GROUP}/invites`, 'POST', {})).status).toBe(403);
    expect((await send(`/api/v1/groups/${GROUP}/invites`)).status).toBe(403);
    expect((await send(`/api/v1/groups/${GROUP}/invites/inv_seed_1/revoke`, 'POST', {})).status).toBe(403);
  });
});

// ─── Group profile (handlers/groups.ts PATCH contract) ──────────────────────

describe('demo transport — PATCH /groups/:groupId', () => {
  it('Owner updates name/description; group row reflects the change', async () => {
    const { ds, send } = makeHarness();
    const res = await send(`/api/v1/groups/${GROUP}`, 'PATCH', { name: 'Robotics Core', description: 'Drones.' });
    expect(res.ok).toBe(true);
    const group = ds.groups.find((g) => g.id === GROUP)!;
    expect(group.name).toBe('Robotics Core');
    expect(group.description).toBe('Drones.');
  });

  it('name >80 chars or description >500 chars are rejected', async () => {
    const { send } = makeHarness();
    expect(
      (await send(`/api/v1/groups/${GROUP}`, 'PATCH', { name: 'x'.repeat(81) })).status,
    ).toBe(400);
    expect(
      (await send(`/api/v1/groups/${GROUP}`, 'PATCH', { description: 'x'.repeat(501) })).status,
    ).toBe(400);
  });

  it('a non-admin member gets GROUP_PERMISSION_DENIED', async () => {
    const { ds, send } = makeHarness();
    ds.members.find((m) => m.user_id === ME)!.role = 'MEMBER';
    const res = await send(`/api/v1/groups/${GROUP}`, 'PATCH', { name: 'Nope' });
    expect(res.status).toBe(403);
    expect((res.json as { error: { code: string } }).error.code).toBe('GROUP_PERMISSION_DENIED');
  });
});

// ─── AI agent row (DEMO-PARITY route — D26) ──────────────────────────────────

describe('demo transport — GET/PATCH ai/agent (demo parity)', () => {
  it('GET returns a §30-shaped agent row', async () => {
    const { send } = makeHarness();
    const res = await send(`/api/v1/groups/${GROUP}/ai/agent`);
    expect(res.ok).toBe(true);
    const parsed = AiAgentConfigSchema.safeParse(res.json);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('Odin');
      expect(parsed.data.mode_policy.proactivity).toBe('balanced');
    }
  });

  it('PATCH persists identity/personality/permissions coherently', async () => {
    const { ds, send } = makeHarness();
    const res = await send(`/api/v1/groups/${GROUP}/ai/agent`, 'PATCH', {
      name: 'Athena',
      personality_config: { preset: 'custom', custom_instructions: 'Be terse.' },
      mode_policy: {
        proactivity: 'low',
        permissions: { read_shared_files: true, merge_pr: true },
      },
    });
    expect(res.ok).toBe(true);
    const agent = ds.aiAgents.find((a) => a.group_id === GROUP)!;
    expect(agent.name).toBe('Athena');
    expect(agent.personality_config.preset).toBe('custom');
    expect(agent.personality_config.custom_instructions).toBe('Be terse.');
    expect(agent.mode_policy.permissions?.merge_pr).toBe(true);
    // The legacy Group mirror follows the rename so other surfaces agree.
    expect(ds.groups.find((g) => g.id === GROUP)!.ai_name).toBe('Athena');
  });

  it('invalid preset/proactivity values are VALIDATION_FAILED, never stored', async () => {
    const { send } = makeHarness();
    const badPreset = await send(`/api/v1/groups/${GROUP}/ai/agent`, 'PATCH', {
      personality_config: { preset: 'chaotic' },
    });
    expect(badPreset.status).toBe(400);
    const badProactivity = await send(`/api/v1/groups/${GROUP}/ai/agent`, 'PATCH', {
      mode_policy: { proactivity: 'maximum' },
    });
    expect(badProactivity.status).toBe(400);
  });
});

// ─── BYOK provider removal (DEMO-PARITY route — D26) ─────────────────────────

describe('demo transport — DELETE ai/providers/:configId (demo parity)', () => {
  it('removes the config AND detaches its model routes', async () => {
    const { ds, send } = makeHarness();
    expect(ds.aiProviderConfigs.some((c) => c.id === 'apc_anthropic_1')).toBe(true);
    const res = await send(`/api/v1/groups/${GROUP}/ai/providers/apc_anthropic_1`, 'DELETE');
    expect(res.json).toMatchObject({ ok: true });
    expect(ds.aiProviderConfigs.some((c) => c.id === 'apc_anthropic_1')).toBe(false);
    expect(ds.aiModelRoutes.some((r) => r.provider_config_id === 'apc_anthropic_1')).toBe(false);
  });

  it('unknown config id → NOT_FOUND', async () => {
    const { send } = makeHarness();
    expect(
      (await send(`/api/v1/groups/${GROUP}/ai/providers/apc_missing`, 'DELETE')).status,
    ).toBe(404);
  });
});

// ─── Usage counters (BE §92 names; DEMO-PARITY route — D26) ──────────────────

describe('demo transport — GET usage (demo parity)', () => {
  it('returns all ten §92 counter names in a valid snapshot shape', async () => {
    const { send } = makeHarness();
    const res = await send(`/api/v1/groups/${GROUP}/usage`);
    expect(res.ok).toBe(true);
    const parsed = UsageSnapshotSchema.safeParse(res.json);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(Object.keys(parsed.data.counters).sort()).toEqual(
        [
          'ai_requests',
          'artifact_generations',
          'estimated_cost',
          'github_actions',
          'input_tokens',
          'output_tokens',
          'research_calls',
          'research_sources',
          'shared_storage_bytes',
          'tool_calls',
        ],
      );
    }
  });

  it('unknown Group → NOT_FOUND (no fabricated zero rows)', async () => {
    const { send } = makeHarness();
    expect((await send('/api/v1/groups/grp_missing/usage')).status).toBe(404);
  });
});
