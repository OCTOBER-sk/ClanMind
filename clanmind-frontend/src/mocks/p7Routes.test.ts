/**
 * P7 — demo transport parity for the BE §113 GitHub/approval surface and the
 * §107 ai-config (BYOK) routes (INTEGRATION_NOTES D18 endpoint table).
 *
 * The in-process transport must answer EXACTLY what handlers/github.ts and
 * handlers/ai-config.ts answer, including the §164A.2 integrity contract:
 * approve binds to `displayed_payload_hash` + `displayed_payload_version`,
 * and a mismatch is a 409 ACTION_EXPIRED — never a silent accept.
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
  ) => transport.send({ method, path, body });
  return { ds, send };
}

const GROUP = 'grp_robotics_1'; // has the §77 connection fixture
const PROJECT = 'proj_flight_ctrl';

describe('demo transport — BE §76/§78 github status + actions', () => {
  it('GET /groups/:id/github/status returns {connected, connection} with no credential material', async () => {
    const { send } = makeHarness();
    const res = await send(`/api/v1/groups/${GROUP}/github/status`);
    expect(res.ok).toBe(true);
    const json = res.json as {
      connected: boolean;
      connection: Record<string, unknown> | null;
    };
    expect(json.connected).toBe(true);
    expect(json.connection).toMatchObject({
      repo_full_name: 'robotics-core/flight-controller',
      default_branch: 'main',
      permission_mode: 'READ_WRITE',
    });
    expect(JSON.stringify(json)).not.toMatch(/token|secret|password/i);
  });

  it('GET /projects/:id/github/actions joins status/risk through ai_actions; payload/hash stay off the list row', async () => {
    const { send } = makeHarness();
    const res = await send(`/api/v1/projects/${PROJECT}/github/actions`);
    expect(res.ok).toBe(true);
    const items = (res.json as { items: Array<Record<string, unknown>> }).items;
    expect(items.length).toBeGreaterThan(0);
    for (const row of items) {
      expect(row).toHaveProperty('status');
      expect(row).toHaveProperty('risk_level');
      expect(row).toHaveProperty('ai_action_id');
      // The joined list never carries approval-binding fields (§164A.2 —
      // cards render only for envelopes the client actually holds).
      expect(row).not.toHaveProperty('payload_hash');
      expect(row).not.toHaveProperty('payload');
    }
  });

  it('POST connect validates the body; disconnect invalidates the installation', async () => {
    const { ds, send } = makeHarness();
    const bad = await send(`/api/v1/groups/${GROUP}/github/connect`, 'POST', {
      installation_id: -1,
      owner_login: '',
      repo_name: 'x',
    });
    expect(bad.status).toBe(400);
    expect((bad.json as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED');

    const okRes = await send(`/api/v1/groups/${GROUP}/github/connect`, 'POST', {
      installation_id: 4821934,
      owner_login: 'robotics-core',
      repo_name: 'flight-controller',
      default_branch: 'main',
      permission_mode: 'READ_WRITE',
    });
    expect(okRes.status).toBe(201);

    await send(`/api/v1/groups/${GROUP}/github/disconnect`, 'POST', {});
    // §142 — cached installation is invalidated server-side.
    expect(ds.githubConnections[0]!.installation_id).toBeNull();
    expect(ds.githubConnections[0]!.disconnected_at).not.toBeNull();
  });
});

describe('demo transport — BE §164A.2/§78A approve/reject engine order', () => {
  const APPROVE = '/api/v1/github/actions/act_github_1/approve';

  async function waitingAction() {
    const harness = makeHarness();
    const action = harness.ds.aiActions.find((a) => a.id === 'act_github_1')!;
    expect(action.status).toBe('WAITING_APPROVAL');
    return harness;
  }

  it('rejects non-binding bodies with VALIDATION_FAILED', async () => {
    const { send } = await waitingAction();
    const res = await send(APPROVE, 'POST', { approved: true });
    expect(res.status).toBe(400);
    expect((res.json as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED');
  });

  it('hash/version mismatch → 409 ACTION_EXPIRED, action stays unapproved (§164A.4)', async () => {
    const { ds, send } = await waitingAction();
    const action = ds.aiActions.find((a) => a.id === 'act_github_1')!;
    const staleHash = 'f'.repeat(64) === action.payload_hash ? 'e'.repeat(64) : 'f'.repeat(64);
    const res = await send(APPROVE, 'POST', {
      displayed_payload_hash: staleHash,
      displayed_payload_version: action.payload_version,
    });
    expect(res.status).toBe(409);
    expect((res.json as { error: { code: string } }).error.code).toBe('ACTION_EXPIRED');
    expect(ds.aiActions.find((a) => a.id === 'act_github_1')!.status).toBe('WAITING_APPROVAL');
  });

  it('exact binding approves transparently: executed=false until App credentials exist (§79)', async () => {
    const { ds, send } = await waitingAction();
    const action = ds.aiActions.find((a) => a.id === 'act_github_1')!;
    const res = await send(APPROVE, 'POST', {
      displayed_payload_hash: action.payload_hash,
      displayed_payload_version: action.payload_version,
    });
    expect(res.ok).toBe(true);
    const json = res.json as {
      executed: boolean;
      reason?: string;
      action: { status: string };
    };
    expect(json.executed).toBe(false); // demo executor not configured — never fabricated
    expect(json.reason).toBe('github_credentials_not_configured');
    expect(json.action.status).toBe('APPROVED');
    expect(ds.aiActions.find((a) => a.id === 'act_github_1')!.status).toBe('APPROVED');
  });

  it('lapsed expiry window flips the row to EXPIRED instead of approving', async () => {
    const { ds, send } = makeHarness();
    const action = ds.aiActions.find((a) => a.id === 'act_github_1')!;
    action.expires_at = new Date(Date.now() - 1000).toISOString();
    const res = await send(
      `/api/v1/github/actions/${action.id}/approve`,
      'POST',
      {
        displayed_payload_hash: action.payload_hash,
        displayed_payload_version: action.payload_version,
      },
    );
    expect(res.status).toBe(409);
    expect((res.json as { error: { code: string } }).error.code).toBe('ACTION_EXPIRED');
    expect(action.status).toBe('EXPIRED');
  });

  it('reject is terminal REJECTED on the ai_action and its github_actions join row', async () => {
    const { ds, send } = await waitingAction();
    const res = await send('/api/v1/github/actions/act_github_1/reject', 'POST', {});
    expect(res.ok).toBe(true);
    expect((res.json as { ok: boolean }).ok).toBe(true);
    expect(ds.aiActions.find((a) => a.id === 'act_github_1')!.status).toBe('REJECTED');
    expect(ds.githubActions.find((g) => g.ai_action_id === 'act_github_1')!.status).toBe('REJECTED');
  });

  it('proposal refuses Groups without an active connection and protects the default branch (§139)', async () => {
    const { send } = makeHarness();
    const files = [{ path: 'src/a.ts', additions: 1, deletions: 0 }];

    // Disconnect first → proposal hits the "no active repository" guard.
    await send(`/api/v1/groups/${GROUP}/github/disconnect`, 'POST', {});
    const noConn = await send(`/api/v1/projects/${PROJECT}/github/actions`, 'POST', {
      action_type: 'apply_patch',
      branch_name: 'feat/x',
      base_sha: 'a'.repeat(40),
      head_sha: 'b'.repeat(40),
      changed_files: files,
    });
    expect(noConn.status).toBe(409);
    expect((noConn.json as { error: { code: string } }).error.code).toBe('CONFLICT');

    // Reconnect (READ_WRITE, default branch main) for the remaining cases.
    const reconnect = await send(`/api/v1/groups/${GROUP}/github/connect`, 'POST', {
      installation_id: 4821934,
      owner_login: 'robotics-core',
      repo_name: 'flight-controller',
      default_branch: 'main',
      permission_mode: 'READ_WRITE',
    });
    expect(reconnect.status).toBe(201);

    const protectedBranch = await send(`/api/v1/projects/${PROJECT}/github/actions`, 'POST', {
      action_type: 'apply_patch',
      branch_name: 'main',
      base_sha: 'a'.repeat(40),
      head_sha: 'b'.repeat(40),
      changed_files: files,
    });
    expect(protectedBranch.status).toBe(403);
    expect((protectedBranch.json as { error: { code: string } }).error.code).toBe(
      'GROUP_PERMISSION_DENIED',
    );

    const okRes = await send(`/api/v1/projects/${PROJECT}/github/actions`, 'POST', {
      action_type: 'create_pr',
      branch_name: 'feat/auth-flow',
      base_sha: 'a'.repeat(40),
      head_sha: 'b'.repeat(40),
      changed_files: files,
    });
    expect(okRes.status).toBe(202);
    const json = okRes.json as {
      action: { action_kind: string; risk_level: string; payload_hash: string; payload_version: number; status: string };
      github_action: Record<string, unknown>;
    };
    expect(json.action.action_kind).toBe('github.create_pr');
    expect(json.action.risk_level).toBe('HIGH');
    expect(json.action.status).toBe('WAITING_APPROVAL');
    expect(json.action.payload_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('demo transport — §165A flags + §63 BYOK sanitization', () => {
  it('GET /groups/:id/flags exposes exactly the §165A vocabulary', async () => {
    const { send } = makeHarness();
    const res = await send(`/api/v1/groups/${GROUP}/flags`);
    expect(res.ok).toBe(true);
    expect(Object.keys(res.json as Record<string, unknown>).sort()).toEqual([
      'custom_skills',
      'deep_research',
      'github_merge',
      'github_write',
      'interactive_artifacts',
      'meeting_mode',
      'offline_sync_v2',
      'proactive_ai',
    ]);
  });

  it('validate-before-store: rejects bad keys, stores sanitized config only', async () => {
    const { ds, send } = makeHarness();
    const url = `/api/v1/groups/${GROUP}/ai/providers/validate`;

    const shortKey = await send(url, 'POST', { provider: 'anthropic', api_key: 'short' });
    expect(shortKey.status).toBe(400);

    const badKey = await send(url, 'POST', { provider: 'anthropic', api_key: 'an-invalid-key-999' });
    expect(badKey.status).toBe(400);

    const key = 'sk-ant-0987654321abcdef';
    const okRes = await send(url, 'POST', { provider: 'anthropic', api_key: key });
    expect(okRes.status).toBe(201);
    const config = (okRes.json as { config: Record<string, unknown>; models: unknown[] }).config;
    expect(config.kind).toBe('BYOK');
    expect(config.key_last4).toBe(key.slice(-4).toUpperCase());
    expect(JSON.stringify(okRes.json)).not.toContain(key); // raw key never echoed
    expect((okRes.json as { models: unknown[] }).models.length).toBeGreaterThan(0);

    // Stored dataset row carries metadata only.
    expect(ds.aiProviderConfigs.at(-1)).toMatchObject({ provider: 'anthropic' });
    expect(JSON.stringify(ds.aiProviderConfigs.at(-1))).not.toContain(key);
  });

  it('PATCH /ai/config enforces exactly one PRIMARY slot', async () => {
    const { send } = makeHarness();
    const cfgId = 'apc_anthropic_1';
    const twoPrimaries = await send(`/api/v1/groups/${GROUP}/ai/config`, 'PATCH', {
      routes: [
        { provider_config_id: cfgId, role: 'PRIMARY', model_id: 'm1' },
        { provider_config_id: cfgId, role: 'PRIMARY', model_id: 'm2' },
      ],
    });
    expect(twoPrimaries.status).toBe(400);

    const valid = await send(`/api/v1/groups/${GROUP}/ai/config`, 'PATCH', {
      routes: [
        { provider_config_id: cfgId, role: 'PRIMARY', model_id: 'claude-sonnet-4-5' },
        { provider_config_id: cfgId, role: 'FALLBACK_1', model_id: 'claude-haiku-4' },
      ],
    });
    expect(valid.ok).toBe(true);
    expect((valid.json as { ok: boolean }).ok).toBe(true);
  });
});
