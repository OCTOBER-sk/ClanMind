/**
 * Demo REST transport — implements the documented `/api/v1` contract against
 * the in-memory dataset (BE §104–113 subset used by current phases), including
 * realistic latency and the BE §102 error envelope on unknown routes.
 */

import type { Transport, TransportRequest, TransportResponse, TransportUploadRequest } from '@/api/transport';
import type { DemoDataset } from './dataset';
import type { Message, AiAction, AiProviderConfig } from '@/types';
import { getDemoHub } from './wsHub';
import {
  ATTACHMENTS_PER_MESSAGE_MAX,
  ATTACHMENT_MAX_BYTES,
  SIGNED_URL_LIFETIME_SECONDS,
} from '@/config/limits';

type Handler = (
  params: Record<string, string>,
  req: TransportRequest,
  ds: DemoDataset,
) => TransportResponse | Promise<TransportResponse>;

const ok = (json: unknown, status = 200): TransportResponse => ({ status, ok: status < 400, json });
const fail = (status: number, code: string, message?: string): TransportResponse => ({
  status,
  ok: false,
  json: { error: { code, message: message ?? code, request_id: `req_${crypto.randomUUID()}` } },
});

// ─── Artifacts (BE §44/§109): canonical FE rows ↔ §44 wire rows ─────────────

/**
 * Serialize a dataset artifact into the §44 wire row the real Worker returns
 * (metadata + `content_ref`), including the inline-`content` extension the
 * client contract documents (INTEGRATION_NOTES D17) until the backend ships
 * an inline-content surface.
 */
function toWireArtifact(ds: DemoDataset, a: DemoDataset['artifacts'][number]): Record<string, unknown> {
  const aiName = ds.groups[0]?.ai_name || 'Odin';
  return {
    id: a.id,
    group_id: a.group_id,
    project_id: a.project_id ?? null,
    name: a.title,
    artifact_type: a.artifact_type,
    status: a.deleted ? 'DELETED' : 'ACTIVE',
    pinned: a.pinned,
    current_version_id: `v_${a.id}_${a.current_version}`,
    current_version: a.current_version,
    created_by_user_id: a.created_by_id && a.created_by_id !== 'odin_ai' ? a.created_by_id : ds.currentUser.id,
    created_by_ai_id: null,
    deleted_at: a.deleted ? a.updated_at : null,
    created_at: a.created_at,
    updated_at: a.updated_at,
    versions: a.versions.map((v) => ({
      id: v.id ?? `v_${a.id}_${v.version_number}`,
      artifact_id: a.id,
      version_number: v.version_number,
      content_type: a.artifact_type === 'TABLE' || a.artifact_type === 'ARCHITECTURE' ? 'application/json' : 'text/markdown',
      content_ref: `groups/${a.group_id}/artifacts/${a.id}/v${v.version_number}`,
      checksum: null,
      created_by_user_id: v.created_by_name === aiName ? null : ds.currentUser.id,
      created_by_ai_id: v.created_by_name === aiName ? 'odin_ai' : null,
      parent_version_id: v.version_number > 1 ? `v_${a.id}_${v.version_number - 1}` : null,
      created_at: v.created_at,
      content: v.content,
      change_summary: v.change_summary ?? null,
    })),
  };
}

/** Apply a restore in-place so later GETs stay consistent; returns the row. */
function restoreInPlace(
  ds: DemoDataset,
  artifactId: string,
  versionNumber: number,
): { row: Record<string, unknown> | null; artifact?: DemoDataset['artifacts'][number] } {
  const artifact = ds.artifacts.find((a) => a.id === artifactId);
  if (!artifact) return { row: null };
  const target = artifact.versions.find((v) => v.version_number === versionNumber);
  if (!target) return { row: null };
  // §256 lineage semantics — restoring creates a NEW current pointer without
  // destroying history: current_version moves, versions array stays intact.
  artifact.current_version = target.version_number;
  artifact.updated_at = new Date().toISOString();
  if (!artifact.versions.includes(target)) {
    artifact.versions.push(target);
  }
  return { row: toWireArtifact(ds, artifact), artifact };
}

function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i]!.startsWith(':')) {
      params[p[i]!.slice(1)] = decodeURIComponent(a[i]!);
    } else if (p[i] !== a[i]) {
      return null;
    }
  }
  return params;
}

// ─── §78A payload hashing — mirrors packages/domain canonicalization ─────────

/** Deterministic JSON canonicalization (sorted keys, no undefined). */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
}

/** SHA-256 of the canonical form; deterministic fallback when WebCrypto is absent. */
async function hashPayload(payload: Record<string, unknown>): Promise<string> {
  const canonical = canonicalize(payload);
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    let h = 5381;
    let out = '';
    for (let round = 0; round < 4; round++) {
      for (let i = 0; i < canonical.length; i++) {
        h = ((h << 5) + h + canonical.charCodeAt(i) + round * 7) | 0;
      }
      out += (h >>> 0).toString(16).padStart(8, '0');
    }
    return out;
  }
}

/** §140 buildDiffPreview — identical shape to @clanmind/domain. */
function buildDiffPreview(input: {
  changed_files: Array<{ path: string; additions: number; deletions: number }>;
  branch_name: string;
  base_sha: string;
  target_sha: string;
}): Record<string, unknown> {
  return {
    changed_files: input.changed_files,
    additions: input.changed_files.reduce((s, f) => s + f.additions, 0),
    deletions: input.changed_files.reduce((s, f) => s + f.deletions, 0),
    branch: input.branch_name,
    base_sha: input.base_sha,
    target_sha: input.target_sha,
  };
}

let serverSequence = 1421;

/**
 * BE §39 wire shape for history reads (GET /messages). The dataset stores
 * canonical FE messages; the REST surface must reproduce the REAL backend
 * row (`server_sequence`, `sender_user_id`, `body_format`, …) because the
 * client validates every page through MessageSchema at the boundary.
 * Sequence assignment is stable per message id so cursor paging is
 * deterministic across refetches.
 */
const wireSeqById = new Map<string, number>();
function toWireMessage(m: Message): Record<string, unknown> {
  let seq = wireSeqById.get(m.id);
  if (seq === undefined) {
    seq = ++serverSequence;
    wireSeqById.set(m.id, seq);
  }
  return {
    id: m.id,
    group_id: m.group_id,
    project_id: m.project_id ?? null,
    sender_type: m.sender_type,
    sender_user_id: m.sender_type === 'USER' ? m.sender_id : null,
    sender_ai_id: m.sender_type === 'AI' ? m.sender_id : null,
    visibility: m.visibility,
    body: m.body,
    body_format: 'markdown',
    reply_to_id: m.reply_to_message_id ?? null,
    client_message_id: m.client_message_id ?? `demo_${m.id}`,
    server_sequence: seq,
    created_at: m.created_at,
    edited_at: m.edited ? m.updated_at : null,
    deleted_at: m.deleted ? m.updated_at : null,
  };
}

/**
 * Demo session-expiry injection (FE §197 testing). Once tripped, every
 * authenticated domain call answers 401 AUTH_SESSION_EXPIRED until the next
 * successful login "refreshes" the demo session. Auth routes are exempt —
 * signing in must stay possible while expired.
 */
let sessionExpired = false;

export function expireDemoSession(): void {
  sessionExpired = true;
}

function requireSession(req: Pick<TransportRequest, 'path'>): TransportResponse | null {
  if (!sessionExpired) return null;
  const path = req.path.split('?')[0]!.replace(/^\/api\/v1/, '');
  if (path.startsWith('/auth/')) return null;
  return fail(401, 'AUTH_SESSION_EXPIRED', 'Your session has expired.');
}

export function createDemoTransport(ds: DemoDataset): Transport {
  // History store speaks §39 WIRE rows end-to-end: seeded dataset entries are
  // converted once at install, POST appends wire rows directly, GET pages
  // slice them verbatim — exactly what the real Worker's Postgres returns.
  let cursorBase: Array<Record<string, unknown>> = ds.messages.map((m) => toWireMessage(m));

  const routes: Array<[string, string, Handler]> = [
    ['GET', '/me', () =>
      // BE §6.2/§104 — profile shape validated by ProfileSchema client-side.
      ok({
        id: ds.currentUser.id,
        email: ds.currentUser.email,
        display_name: ds.currentUser.name,
        created_at: ds.currentUser.created_at ?? new Date(Date.now() - 30 * 86_400_000).toISOString(),
        last_seen_at: new Date().toISOString(),
      })],

    ['POST', '/auth/login', (_p, req) => {
      const body = (req.body ?? {}) as { email?: string; password?: string };
      // Deterministic failure path for tests/E2E: password "wrongpass" fails.
      if (body.password === 'wrongpass') {
        return fail(401, 'AUTH_INVALID_CREDENTIALS', 'Incorrect email or password.');
      }
      void body.email;
      return ok({
        access_token: 'demo-token',
        user: { id: ds.currentUser.id, email: ds.currentUser.email, name: ds.currentUser.name },
      });
    }],

    ['POST', '/auth/signup', (_p, req) => {
      const body = (req.body ?? {}) as { name?: string; email?: string };
      return ok({
        access_token: 'demo-token',
        user: {
          id: ds.currentUser.id,
          email: body.email ?? ds.currentUser.email,
          name: body.name ?? ds.currentUser.name,
        },
      });
    }],

    ['POST', '/auth/request-password-reset', () =>
      // FE §68 — always 200; response never reveals account existence.
      ok({ sent: true })],

    ['POST', '/auth/logout', () => {
      sessionExpired = false;
      return ok({ signed_out: true });
    }],

    // Real BE (handlers/groups.ts) wraps lists as { items } — demo matches.
    ['GET', '/groups', () => ok({ items: ds.groups })],

    ['GET', '/groups/:groupId/projects', (p) =>
      ok({ items: ds.projects.filter((proj) => proj.group_id === p.groupId) })],

    // BE §105/§156 — Page<Message>: { items, next_cursor } with real §39 rows.
    ['GET', '/groups/:groupId/messages', (p, req) => {
      const limit = Number(req.query?.limit ?? 50);
      const before = req.query?.before as string | undefined;
      const all = cursorBase.filter((m) => m.group_id === p.groupId);
      const ordered = [...all].sort((a, b) =>
        String(a.created_at).localeCompare(String(b.created_at)),
      );
      let endIdx = ordered.length;
      if (before) {
        const idx = ordered.findIndex((m) => m.id === before);
        if (idx > 0) endIdx = idx;
      }
      const start = Math.max(0, endIdx - limit);
      const items = ordered.slice(start, endIdx);
      return ok({ items, next_cursor: start > 0 ? items[0]?.id ?? null : null });
    }],

    ['POST', '/groups/:groupId/messages', async (p, req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      // §2.4 — private scope rides `private_to` ("ai" | teammate id); the
      // demo mirrors it onto the wire row's visibility so client-side scope
      // isolation (FE rule 26) is exercisable end-to-end in demo mode.
      const privateTo = body.private_to;
      const isPrivateAi = privateTo === 'ai';
      const isPrivatePair = typeof privateTo === 'string' && privateTo !== 'ai' && privateTo.length > 0;
      const message = {
        id: `msg_srv_${serverSequence}`,
        group_id: p.groupId,
        project_id: (body.project_id as string | null) ?? null,
        sender_type: 'USER',
        sender_user_id: ds.currentUser.id,
        visibility: isPrivateAi ? 'PRIVATE_AI' : isPrivatePair ? 'PRIVATE_PAIR' : String(body.visibility ?? 'GROUP'),
        ...(isPrivatePair ? { recipient_id: privateTo } : {}),
        body: String(body.body ?? ''),
        reply_to_id:
          (body.reply_to_id as string | null) ??
          (body.reply_to_message_id as string | null) ??
          null,
        client_message_id: String(body.client_message_id ?? `op_${serverSequence}`),
        server_sequence: ++serverSequence,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
      };
      cursorBase.push(message as never);
      // §122 — the message transaction inserts attachment links. The FE sends
      // BE §43 row ids of uploaded chips; link them in the demo object store.
      const attachmentIds = Array.isArray(body.attachment_ids)
        ? (body.attachment_ids as string[])
        : [];
      for (const attachmentId of attachmentIds) {
        const obj = demoObjects.get(attachmentId);
        if (obj && !obj.messageId) obj.messageId = message.id;
      }
      getDemoHub().messageCreated(message);
      await sleep(80);
      return ok(message, 201);
    }],

    ['PATCH', '/messages/:messageId', (p, req) => {
      const target = cursorBase.find((m) => m.id === p.messageId);
      if (!target) return fail(404, 'NOT_FOUND');
      Object.assign(target, (req.body ?? {}) as object, { updated_at: new Date().toISOString() });
      return ok(target);
    }],

    ['DELETE', '/messages/:messageId', (p) => {
      const target = cursorBase.find((m) => m.id === p.messageId);
      if (!target) return fail(404, 'NOT_FOUND');
      const wire = target as unknown as { deleted_at?: string | null };
      wire.deleted_at = new Date().toISOString();
      return ok({ id: target.id, deleted_at: wire.deleted_at });
    }],

    // BE §106 — group-scoped canonical start path; streaming rides the socket.
    ['POST', '/groups/:groupId/ai/runs', (p, req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const runId = `run_${Date.now()}`;
      getDemoHub().startAiRun({
        runId,
        messageId: String(body.message_id ?? ''),
        groupId: p.groupId,
        projectId: (body.project_id as string | null) ?? null,
        prompt: String(body.message ?? body.prompt ?? ''),
        aiName: String(body.ai_name ?? 'Odin'),
      });
      return ok(
        {
          run_id: runId,
          response: '',
          tool_calls: 0,
          truncated: false,
        },
        202,
      );
    }],

    ['POST', '/ai/runs/:runId/cancel', (p) => {
      getDemoHub().cancelAiRun(p.runId);
      return ok({ id: p.runId, status: 'CANCELLED' });
    }],

    ['GET', '/groups/:groupId/flags', () =>
      // §165A per-Group flags — the same shape the live Worker will expose.
      ok(ds.featureFlags)],

    // ── AI provider config (BE §107 handlers/ai-config.ts parity, P7) ──────

    ['GET', '/groups/:groupId/ai/config', (p) => {
      void p;
      return ok({
        configs: ds.aiProviderConfigs.map((c) => ({
          ...c,
          // §63.1 — sanitized: credential_ref is namespaced, key material never.
          credential_ref: c.credential_ref ? `secret:${c.credential_ref.replace(/^secret:/, '')}` : null,
        })),
        routes: ds.aiModelRoutes,
      });
    }],

    ['PATCH', '/groups/:groupId/ai/config', (p, req) => {
      void p;
      const body = (req.body ?? {}) as { routes?: unknown };
      const routes = Array.isArray(body.routes) ? body.routes : null;
      if (!routes || routes.length < 1 || routes.length > 4) {
        return fail(400, 'VALIDATION_FAILED', 'Invalid route list.');
      }
      const roles = routes.map((r) => (r as { role?: string }).role);
      const primaries = roles.filter((r) => r === 'PRIMARY').length;
      if (primaries !== 1) return fail(400, 'VALIDATION_FAILED', 'Exactly one PRIMARY route is required.');
      if (roles.filter((r) => typeof r === 'string' && r.startsWith('FALLBACK_')).length > 3) {
        return fail(400, 'VALIDATION_FAILED', 'At most three fallback positions.');
      }
      for (const entry of routes as Array<{ provider_config_id?: string; role?: string; model_id?: string }>) {
        const cfg = ds.aiProviderConfigs.find((c) => c.id === entry.provider_config_id);
        if (!cfg || cfg.group_id !== p.groupId) {
          return fail(400, 'VALIDATION_FAILED', 'Unknown provider config for this Group.');
        }
        const existingIdx = ds.aiModelRoutes.findIndex(
          (r) => r.role === entry.role,
        );
        const row = {
          id: existingIdx >= 0 ? ds.aiModelRoutes[existingIdx]!.id : `amr_${crypto.randomUUID()}`,
          group_id: p.groupId,
          provider_config_id: String(entry.provider_config_id),
          role: entry.role as 'PRIMARY' | 'FALLBACK_1' | 'FALLBACK_2' | 'FALLBACK_3',
          model_id: String(entry.model_id),
          priority: entry.role === 'PRIMARY' ? 0 : Number(String(entry.role).slice(-1)),
          enabled: true,
          created_at: new Date().toISOString(),
        };
        if (existingIdx >= 0) ds.aiModelRoutes[existingIdx] = row;
        else ds.aiModelRoutes.push(row);
      }
      return ok({ ok: true, routes: ds.aiModelRoutes });
    }],

    ['POST', '/groups/:groupId/ai/providers/validate', (p, req) => {
      const body = (req.body ?? {}) as { provider?: unknown; api_key?: unknown };
      if (typeof body.provider !== 'string' || typeof body.api_key !== 'string' || body.api_key.length < 8) {
        return fail(400, 'VALIDATION_FAILED', 'provider and api_key are required.');
      }
      // §64 validate-before-store. Deterministic demo rule: any key containing
      // "invalid" is rejected exactly like a real provider auth failure.
      if (/invalid/i.test(body.api_key)) {
        return fail(400, 'VALIDATION_FAILED', 'Provider rejected this key.');
      }
      const config: AiProviderConfig = {
        id: `apc_${crypto.randomUUID()}`,
        group_id: p.groupId,
        kind: 'BYOK',
        provider: body.provider,
        credential_ref: `secret:enc_${body.api_key.length}`,
        key_last4: body.api_key.slice(-4).toUpperCase(),
        enabled: true,
        created_by: ds.currentUser.id,
        created_at: new Date().toISOString(),
      };
      ds.aiProviderConfigs.push(config);
      return ok({ config, models: demoModelsFor(body.provider) }, 201);
    }],

    ['POST', '/groups/:groupId/ai/providers/:id/models', (p) => {
      const config = ds.aiProviderConfigs.find((c) => c.id === p.id);
      if (!config || config.group_id !== p.groupId) {
        return fail(404, 'NOT_FOUND', 'Provider config not found.');
      }
      return ok({ provider: config.provider, models: demoModelsFor(config.provider) });
    }],

    /** §158 search-provider test — DEMO-PARITY ONLY route (no BE §113
     * endpoint exists yet; live mode 404s into an honest failure state).
     * Recorded in INTEGRATION_NOTES as an invented demo surface. */
    ['POST', '/groups/:groupId/search-provider/test', () =>
      ok({ ok: true, results_sampled: 8 })],

    // ── GitHub integration (BE §113 handlers/github.ts parity, P7) ─────────

    ['GET', '/groups/:groupId/github/status', (p) => {
      const connection = ds.githubConnections.find((c) => c.group_id === p.groupId) ?? null;
      const connected =
        !!connection && !connection.disconnected_at && connection.installation_id !== null;
      return ok({ connected, connection });
    }],

    ['POST', '/groups/:groupId/github/connect', (p, req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const installationId = Number(body.installation_id);
      const ownerLogin = body.owner_login;
      const repoName = body.repo_name;
      if (
        !Number.isInteger(installationId) ||
        installationId <= 0 ||
        typeof ownerLogin !== 'string' ||
        ownerLogin.length === 0 ||
        typeof repoName !== 'string' ||
        repoName.length === 0
      ) {
        return fail(400, 'VALIDATION_FAILED', 'Invalid connection body.');
      }
      let connection = ds.githubConnections.find((c) => c.group_id === p.groupId);
      const row = {
        id: connection?.id ?? `ghconn_${crypto.randomUUID()}`,
        group_id: p.groupId,
        installation_id: installationId,
        owner_login: ownerLogin,
        repo_name: repoName,
        repo_full_name: `${ownerLogin}/${repoName}`,
        default_branch:
          typeof body.default_branch === 'string' && body.default_branch.length > 0
            ? body.default_branch
            : null,
        permission_mode:
          body.permission_mode === 'READ_WRITE'
            ? ('READ_WRITE' as const)
            : ('READ_ONLY' as const),
        connected_at: new Date().toISOString(),
        disconnected_at: null,
      };
      if (connection) Object.assign(connection, row);
      else ds.githubConnections.push(row);
      getDemoHub().broadcast('github.connected', p.groupId, { repo_full_name: row.repo_full_name });
      return ok(row, 201);
    }],

    ['POST', '/groups/:groupId/github/disconnect', (p) => {
      const connection = ds.githubConnections.find((c) => c.group_id === p.groupId);
      if (connection) {
        connection.disconnected_at = new Date().toISOString();
        connection.installation_id = null; // §142 — invalidate cached installation
      }
      getDemoHub().broadcast('github.disconnected', p.groupId, {});
      return ok({ ok: true });
    }],

    ['GET', '/projects/:projectId/github/actions', (p) => {
      const items = ds.githubActions
        .filter((ga) => ga.project_id === p.projectId)
        .map((ga) => {
          // §78A.2 — status/risk join through ai_actions; payload/hash are NOT
          // part of this list row on the real backend either.
          const aiAction = ds.aiActions.find((a) => a.id === ga.ai_action_id);
          return { ...ga, status: aiAction?.status ?? ga.status, risk_level: aiAction?.risk_level ?? ga.risk_level };
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return ok({ items });
    }],

    ['POST', '/projects/:projectId/github/actions', async (p, req) => {
      const project = ds.projects.find((pr) => pr.id === p.projectId);
      if (!project) return fail(404, 'NOT_FOUND', 'Project not found.');
      const connection = ds.githubConnections.find((c) => c.group_id === project.group_id);
      if (!connection || !connection.installation_id || connection.disconnected_at) {
        return fail(409, 'CONFLICT', 'No GitHub repository is connected to this Group.');
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const actionType = body.action_type;
      const branchName = body.branch_name;
      const baseSha = body.base_sha;
      const headSha = body.head_sha;
      const changedFiles = body.changed_files;
      if (
        actionType !== 'create_branch' &&
        actionType !== 'apply_patch' &&
        actionType !== 'create_pr'
      ) {
        return fail(400, 'VALIDATION_FAILED', 'Invalid action body.');
      }
      if (
        typeof branchName !== 'string' ||
        branchName.length === 0 ||
        typeof baseSha !== 'string' ||
        typeof headSha !== 'string'
      ) {
        return fail(400, 'VALIDATION_FAILED', 'Invalid action body.');
      }
      if (
        !Array.isArray(changedFiles) ||
        changedFiles.length === 0 ||
        !changedFiles.every(
          (f) =>
            f &&
            typeof f === 'object' &&
            typeof (f as Record<string, unknown>).path === 'string' &&
            Number.isInteger((f as Record<string, unknown>).additions) &&
            Number.isInteger((f as Record<string, unknown>).deletions),
        )
      ) {
        return fail(400, 'VALIDATION_FAILED', 'Invalid action body.');
      }
      // §139 — the AI never writes the default branch.
      if (connection.default_branch && branchName.trim() === connection.default_branch) {
        return fail(
          403,
          'GROUP_PERMISSION_DENIED',
          'The default branch is protected; AI work flows through a branch + PR.',
        );
      }
      const files = changedFiles as Array<{ path: string; additions: number; deletions: number }>;
      const preview = buildDiffPreview({
        changed_files: files,
        branch_name: branchName,
        base_sha: baseSha,
        target_sha: headSha,
      });
      const payload = {
        ...preview,
        repo_full_name: connection.repo_full_name,
        installation_id: connection.installation_id,
      };
      const nowIso = new Date().toISOString();
      const actionId = `act_${crypto.randomUUID()}`;
      const action: AiAction = {
        id: actionId,
        group_id: project.group_id,
        project_id: project.id,
        action_kind: `github.${String(actionType)}`,
        risk_level: 'HIGH',
        payload,
        payload_hash: await hashPayload(payload),
        payload_version: 1,
        status: 'WAITING_APPROVAL',
        requested_by_user_id: ds.currentUser.id,
        created_at: nowIso,
        expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      };
      ds.aiActions.push(action);
      const githubAction = {
        id: `gha_${crypto.randomUUID()}`,
        ai_action_id: actionId,
        group_id: project.group_id,
        project_id: project.id,
        action_type: actionType as 'create_branch' | 'apply_patch' | 'create_pr',
        branch_name: branchName,
        target_sha: headSha,
        pr_number: null,
        preview_json: preview,
        created_at: nowIso,
        completed_at: null,
        status: 'WAITING_APPROVAL',
        risk_level: 'HIGH',
      } satisfies DemoDataset['githubActions'][number];
      ds.githubActions.push(githubAction);
      // Fan-out carries the FULL envelope so other clients can render an
      // approval card without a fetch-back (mirrors handlers/github.ts).
      getDemoHub().broadcast('github.action.proposed', project.group_id, {
        action_id: actionId,
        github_action_id: githubAction.id,
        action_kind: action.action_kind,
        payload_hash: action.payload_hash,
        payload_version: action.payload_version,
        preview,
      });
      getDemoHub().approvalRequested(project.group_id, {
        action_id: actionId,
        action_kind: action.action_kind,
        risk_level: action.risk_level,
      });
      await sleep(60);
      return ok({ action, github_action: githubAction }, 202);
    }],

    ['POST', '/github/actions/:actionId/approve', async (p, req) => {
      const action = ds.aiActions.find((a) => a.id === p.actionId);
      if (!action) return fail(404, 'NOT_FOUND', 'Action not found.');
      const member = ds.members.find((m) => m.user_id === ds.currentUser.id);
      if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
        return fail(403, 'GROUP_PERMISSION_DENIED', 'Only Owners/Admins can approve GitHub writes.');
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (
        typeof body.displayed_payload_hash !== 'string' ||
        typeof body.displayed_payload_version !== 'number'
      ) {
        return fail(400, 'VALIDATION_FAILED', 'Approval binding fields required.');
      }
      // §78A lifecycle — exact engine order mirrors ApprovalEngine.approve().
      if (action.status !== 'WAITING_APPROVAL') {
        return fail(409, 'CONFLICT', `Action is ${action.status}, not awaiting approval.`);
      }
      if (action.expires_at && new Date(action.expires_at).getTime() <= Date.now()) {
        action.status = 'EXPIRED';
        return fail(409, 'ACTION_EXPIRED', 'This action expired; a fresh proposal is required.');
      }
      if (
        action.payload_hash !== body.displayed_payload_hash ||
        action.payload_version !== body.displayed_payload_version
      ) {
        // §164A.2 integrity check failed server-side — the client must NOT
        // retry with the old hash; it re-fetches and re-reviews (§164A.4).
        return fail(
          409,
          'ACTION_EXPIRED',
          'The action changed since it was displayed. Review the latest version.',
        );
      }
      action.status = 'APPROVED';
      const gaRow = ds.githubActions.find((g) => g.ai_action_id === action.id);
      if (gaRow) gaRow.status = 'APPROVED';
      // Transparent execution state (§79): without App credentials the action
      // stays APPROVED for a later executor run — never silently dropped.
      return ok({
        executed: false,
        reason: 'github_credentials_not_configured',
        action,
      });
    }],

    ['POST', '/github/actions/:actionId/reject', (p) => {
      const action = ds.aiActions.find((a) => a.id === p.actionId);
      if (!action) return fail(404, 'NOT_FOUND', 'Action not found.');
      const member = ds.members.find((m) => m.user_id === ds.currentUser.id);
      if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
        return fail(403, 'GROUP_PERMISSION_DENIED', 'Only Owners/Admins can reject GitHub writes.');
      }
      if (action.status !== 'WAITING_APPROVAL' && action.status !== 'APPROVED') {
        return fail(409, 'CONFLICT', `Action is ${action.status}.`);
      }
      action.status = 'REJECTED';
      const gaRow = ds.githubActions.find((g) => g.ai_action_id === action.id);
      if (gaRow) gaRow.status = 'REJECTED';
      return ok({ ok: true });
    }],

    // ── Artifacts (P6): BE §109 parity over the dataset. ───────────────────

    ['GET', '/projects/:projectId/artifacts', (p) =>
      ok({ items: ds.artifacts
        .filter((a) => a.project_id === p.projectId && !a.deleted)
        .map((a) => toWireArtifact(ds, a)) })],

    ['GET', '/artifacts/:artifactId', (p) => {
      const artifact = ds.artifacts.find((a) => a.id === p.artifactId);
      if (!artifact || artifact.deleted) return fail(404, 'NOT_FOUND', 'Artifact not found.');
      return ok(toWireArtifact(ds, artifact));
    }],

    ['POST', '/artifacts/:artifactId/restore', (p, req) => {
      const body = (req.body ?? {}) as { version_number?: unknown };
      const versionNumber = Number(body.version_number);
      if (!Number.isInteger(versionNumber) || versionNumber < 1) {
        return fail(400, 'VALIDATION_FAILED', 'version_number must be a positive integer.');
      }
      const { row, artifact } = restoreInPlace(ds, p.artifactId, versionNumber);
      if (!row || !artifact) return fail(404, 'NOT_FOUND', 'Artifact or version not found.');
      // Fan out so other room members reconcile the new current version.
      getDemoHub().broadcast('artifact.event', artifact.group_id, {
        kind: 'version',
        artifact: row,
      });
      return ok(row);
    }],

    ['POST', '/artifacts/:artifactId/pin', (p, req) => {
      const artifact = ds.artifacts.find((a) => a.id === p.artifactId);
      if (!artifact || artifact.deleted) return fail(404, 'NOT_FOUND', 'Artifact not found.');
      const body = (req.body ?? {}) as { pinned?: unknown };
      if (typeof body.pinned !== 'boolean') {
        return fail(400, 'VALIDATION_FAILED', 'pinned must be a boolean.');
      }
      artifact.pinned = body.pinned;
      artifact.updated_at = new Date().toISOString();
      return ok(toWireArtifact(ds, artifact));
    }],

    ['DELETE', '/artifacts/:artifactId', (p) => {
      const artifact = ds.artifacts.find((a) => a.id === p.artifactId);
      if (!artifact) return fail(404, 'NOT_FOUND', 'Artifact not found.');
      // §256 — soft delete; permanent deletion happens server-side later.
      artifact.deleted = true;
      artifact.pinned = false;
      artifact.updated_at = new Date().toISOString();
      return ok({ id: artifact.id, deleted_at: artifact.updated_at });
    }],

    // ── Tasks (P8): BE §111 handlers/intel.ts parity over the dataset ───────

    ['GET', '/projects/:projectId/tasks', (p) => {
      const project = ds.projects.find((pr) => pr.id === p.projectId);
      if (!project) return fail(404, 'NOT_FOUND', 'Project not found.');
      const items = ds.tasks
        .filter((t) => t.project_id === p.projectId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return ok({ items });
    }],

    ['POST', '/projects/:projectId/tasks', (p, req) => {
      const project = ds.projects.find((pr) => pr.id === p.projectId);
      if (!project) return fail(404, 'NOT_FOUND', 'Project not found.');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (title.length < 1 || title.length > 300) {
        return fail(400, 'VALIDATION_FAILED', 'Invalid task body.');
      }
      if (
        body.description !== undefined &&
        body.description !== null &&
        typeof body.description !== 'string'
      ) {
        return fail(400, 'VALIDATION_FAILED', 'Invalid task body.');
      }
      const ownerUserId =
        typeof body.owner_user_id === 'string' && body.owner_user_id.length > 0
          ? body.owner_user_id
          : null;
      const nowIso = new Date().toISOString();
      // BE defaults: status TODO · priority MEDIUM · version 1.
      const task = {
        id: `task_${crypto.randomUUID()}`,
        project_id: project.id,
        title,
        description: (body.description as string | null) ?? null,
        owner_user_id: ownerUserId,
        status: 'TODO' as const,
        priority: 'MEDIUM' as const,
        due_at: null,
        version: 1,
        created_by_user_id: ds.currentUser.id,
        created_by_ai_id: null,
        created_at: nowIso,
        updated_at: nowIso,
        completed_at: null,
      };
      ds.tasks.push(task);
      getDemoHub().broadcast('task.created', project.group_id, { task });
      return ok(task, 201);
    }],

    ['GET', '/tasks/:taskId', (p) => {
      const task = ds.tasks.find((t) => t.id === p.taskId);
      if (!task) return fail(404, 'NOT_FOUND', 'Task not found.');
      return ok(task);
    }],

    ['PATCH', '/tasks/:taskId', (p, req) => {
      const task = ds.tasks.find((t) => t.id === p.taskId);
      if (!task) return fail(404, 'NOT_FOUND', 'Task not found.');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const expectedVersion = Number(body.expected_version);
      const patch = body.patch as Record<string, unknown> | undefined;
      if (!Number.isInteger(expectedVersion) || !patch || typeof patch !== 'object') {
        return fail(400, 'VALIDATION_FAILED', 'Invalid task patch.');
      }
      if (
        patch.status !== undefined &&
        !['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'].includes(String(patch.status))
      ) {
        return fail(400, 'VALIDATION_FAILED', 'Invalid status.');
      }
      if (
        patch.priority !== undefined &&
        !['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(String(patch.priority))
      ) {
        return fail(400, 'VALIDATION_FAILED', 'Invalid priority.');
      }
      if (
        patch.due_at !== undefined &&
        patch.due_at !== null &&
        typeof patch.due_at !== 'string'
      ) {
        return fail(400, 'VALIDATION_FAILED', 'Invalid due_at.');
      }
      // §21.2 optimistic concurrency — mirrors TaskService.update exactly.
      if (task.version !== expectedVersion || task.status === 'CANCELLED') {
        return fail(409, 'CONFLICT', 'Task changed elsewhere; reload and retry.');
      }
      if (typeof patch.title === 'string') task.title = patch.title;
      if (patch.description !== undefined) task.description = patch.description as string | null;
      if (patch.owner_user_id !== undefined) task.owner_user_id = patch.owner_user_id as string | null;
      if (patch.status !== undefined) task.status = patch.status as typeof task.status;
      if (patch.priority !== undefined) task.priority = patch.priority as typeof task.priority;
      if (patch.due_at !== undefined) task.due_at = patch.due_at as string | null;
      if (task.status === 'DONE' && !task.completed_at) task.completed_at = new Date().toISOString();
      task.version = expectedVersion + 1;
      task.updated_at = new Date().toISOString();
      getDemoHub().broadcast('task.updated', ds.projects.find((pr) => pr.id === task.project_id)?.group_id ?? '', { task });
      return ok(task);
    }],

    ['POST', '/tasks/:taskId/complete', (p, req) => {
      const task = ds.tasks.find((t) => t.id === p.taskId);
      if (!task) return fail(404, 'NOT_FOUND', 'Task not found.');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const expectedVersion = Number(body.expected_version);
      if (!Number.isInteger(expectedVersion)) {
        return fail(400, 'VALIDATION_FAILED', 'expected_version is required.');
      }
      if (task.version !== expectedVersion) {
        return fail(409, 'CONFLICT', 'Task changed elsewhere; reload and retry.');
      }
      task.status = 'DONE';
      task.completed_at = new Date().toISOString();
      task.version = expectedVersion + 1;
      task.updated_at = task.completed_at;
      getDemoHub().broadcast('task.completed', ds.projects.find((pr) => pr.id === task.project_id)?.group_id ?? '', { task });
      return ok(task);
    }],

    // ── Decisions (P8): BE §110 handlers/intel.ts parity ────────────────────

    ['GET', '/projects/:projectId/decisions', (p) => {
      const project = ds.projects.find((pr) => pr.id === p.projectId);
      if (!project) return fail(404, 'NOT_FOUND', 'Project not found.');
      const items = ds.decisions
        .filter((d) => d.project_id === p.projectId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return ok({ items });
    }],

    ['POST', '/projects/:projectId/decisions', (p, req) => {
      const project = ds.projects.find((pr) => pr.id === p.projectId);
      if (!project) return fail(404, 'NOT_FOUND', 'Project not found.');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (title.length < 1 || title.length > 300) {
        return fail(400, 'VALIDATION_FAILED', 'Invalid decision body.');
      }
      if (body.context !== undefined && body.context !== null && typeof body.context !== 'string') {
        return fail(400, 'VALIDATION_FAILED', 'Invalid decision body.');
      }
      // §122 options — jsonb column exists (§47); the real handler does not
      // parse this field yet, demo persists it as parity (D22).
      let options: Array<{ label: string }> | null = null;
      if (Array.isArray(body.options)) {
        options = (body.options as unknown[])
          .map((o) =>
            typeof o === 'string'
              ? { label: o }
              : (o as { label?: unknown })?.label != null
                ? { label: String((o as { label: unknown }).label) }
                : null,
          )
          .filter((o): o is { label: string } => o !== null);
      }
      const nowIso = new Date().toISOString();
      // §122 default — every proposal lands PROPOSED with version 1.
      const decision = {
        id: `dec_${crypto.randomUUID()}`,
        project_id: project.id,
        title,
        context: (body.context as string | null) ?? null,
        options,
        selected_option: null,
        rationale: null,
        status: 'PROPOSED' as const,
        version: 1,
        proposed_by: ds.currentUser.id,
        approved_by: null,
        approved_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      ds.decisions.push(decision);
      getDemoHub().broadcast('decision.proposed', project.group_id, { decision });
      return ok(decision, 201);
    }],

    ['GET', '/decisions/:decisionId', (p) => {
      const decision = ds.decisions.find((d) => d.id === p.decisionId);
      if (!decision) return fail(404, 'NOT_FOUND', 'Decision not found.');
      return ok(decision);
    }],

    ['POST', '/decisions/:decisionId/approve', (p, req) => {
      const decision = ds.decisions.find((d) => d.id === p.decisionId);
      if (!decision) return fail(404, 'NOT_FOUND', 'Decision not found.');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const expectedVersion = Number(body.expected_version);
      if (!Number.isInteger(expectedVersion)) {
        return fail(400, 'VALIDATION_FAILED', 'expected_version is required.');
      }
      // §21.2 CAS from PROPOSED — mirrors DecisionService.approve order.
      if (decision.version !== expectedVersion) {
        return fail(409, 'CONFLICT', 'Decision changed; reload and retry.');
      }
      if (decision.status !== 'PROPOSED') {
        return fail(409, 'CONFLICT', 'Decision changed; reload and retry.');
      }
      decision.status = 'APPROVED';
      decision.approved_by = ds.currentUser.id;
      decision.approved_at = new Date().toISOString();
      decision.version = expectedVersion + 1;
      decision.updated_at = decision.approved_at;
      // Approving supersedes this Project's other APPROVED decisions and
      // promotes the row to a high-priority memory candidate (BE §134).
      for (const other of ds.decisions) {
        if (other.project_id === decision.project_id && other.id !== decision.id && other.status === 'APPROVED') {
          other.status = 'SUPERSEDED';
          other.updated_at = decision.approved_at!;
        }
      }
      const groupId = ds.projects.find((pr) => pr.id === decision.project_id)?.group_id ?? '';
      getDemoHub().broadcast('decision.approved', groupId, { decision });
      return ok(decision);
    }],

    ['POST', '/decisions/:decisionId/reject', (p, req) => {
      const decision = ds.decisions.find((d) => d.id === p.decisionId);
      if (!decision) return fail(404, 'NOT_FOUND', 'Decision not found.');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const expectedVersion = Number(body.expected_version);
      if (!Number.isInteger(expectedVersion)) {
        return fail(400, 'VALIDATION_FAILED', 'expected_version is required.');
      }
      if (decision.version !== expectedVersion || decision.status !== 'PROPOSED') {
        return fail(409, 'CONFLICT', 'Decision changed; reload and retry.');
      }
      decision.status = 'REJECTED';
      decision.version = expectedVersion + 1;
      decision.updated_at = new Date().toISOString();
      getDemoHub().broadcast('decision.rejected', ds.projects.find((pr) => pr.id === decision.project_id)?.group_id ?? '', { decision });
      return ok({ ok: true });
    }],

    // ── Memory (P8): BE §108 handlers/memory.ts parity ──────────────────────

    ['GET', '/groups/:groupId/memory', (p) =>
      ok({ items: ds.memories.filter((m) => m.group_id === p.groupId && m.scope_type === 'GROUP') })],

    ['GET', '/projects/:projectId/memory', (p) =>
      ok({
        items: ds.memories.filter(
          (m) => m.project_id === p.projectId && m.scope_type === 'PROJECT',
        ),
      })],

    ['GET', '/groups/:groupId/memory/candidates', (p) =>
      ok({
        items: ds.memoryCandidates.filter(
          (c) => c.group_id === p.groupId && c.status === 'PENDING',
        ),
      })],

    ['POST', '/memory/:candidateId/accept', (p) => {
      const candidate = ds.memoryCandidates.find((c) => c.id === p.candidateId);
      if (!candidate || candidate.status !== 'PENDING') {
        return fail(404, 'NOT_FOUND', 'Candidate not found.');
      }
      candidate.status = 'ACCEPTED';
      const nowIso = new Date().toISOString();
      const memory = {
        id: `mem_${crypto.randomUUID()}`,
        scope_type: candidate.recommended_scope,
        group_id: candidate.group_id,
        project_id: candidate.project_id,
        user_id: candidate.user_id,
        memory_type: candidate.candidate_type,
        content: candidate.content,
        normalized_content: null,
        confidence: candidate.confidence,
        importance: 0.6,
        source_type: 'candidate_accepted',
        source_id: candidate.source_message_id,
        status: 'ACTIVE' as const,
        created_at: nowIso,
        updated_at: nowIso,
        last_used_at: null,
        archived_at: null,
      };
      ds.memories.push(memory);
      getDemoHub().broadcast('memory.approved', candidate.group_id, {
        memory,
        candidate_id: candidate.id,
      });
      return ok(memory, 201);
    }],

    ['POST', '/memory/:candidateId/reject', (p) => {
      const candidate = ds.memoryCandidates.find((c) => c.id === p.candidateId);
      if (!candidate || candidate.status !== 'PENDING') {
        return fail(404, 'NOT_FOUND', 'Candidate not found.');
      }
      candidate.status = 'REJECTED';
      return ok({ ok: true });
    }],

    ['PATCH', '/memory/:memoryId', (p, req) => {
      const memory = ds.memories.find((m) => m.id === p.memoryId);
      if (!memory) return fail(404, 'NOT_FOUND', 'Memory not found.');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const keys = Object.keys(body);
      if (keys.length === 0) {
        return fail(400, 'VALIDATION_FAILED', 'At least one field is required.');
      }
      if (body.content !== undefined && (typeof body.content !== 'string' || body.content.length < 1 || body.content.length > 2000)) {
        return fail(400, 'VALIDATION_FAILED', 'Invalid patch body.');
      }
      if (body.importance !== undefined && (typeof body.importance !== 'number' || body.importance < 0 || body.importance > 1)) {
        return fail(400, 'VALIDATION_FAILED', 'Invalid patch body.');
      }
      if (body.confidence !== undefined && (typeof body.confidence !== 'number' || body.confidence < 0 || body.confidence > 1)) {
        return fail(400, 'VALIDATION_FAILED', 'Invalid patch body.');
      }
      if (typeof body.content === 'string') memory.content = body.content;
      if (typeof body.importance === 'number') memory.importance = body.importance;
      if (typeof body.confidence === 'number') memory.confidence = body.confidence;
      memory.updated_at = new Date().toISOString();
      getDemoHub().broadcast('memory.updated', memory.group_id, { memory });
      return ok(memory);
    }],

    ['DELETE', '/memory/:memoryId', (p) => {
      const idx = ds.memories.findIndex((m) => m.id === p.memoryId);
      if (idx < 0) return fail(404, 'NOT_FOUND', 'Memory not found.');
      const [removed] = ds.memories.splice(idx, 1);
      getDemoHub().broadcast('memory.deleted', removed!.group_id, { memory_id: removed!.id });
      return ok({ ok: true });
    }],

    /**
     * §118 explicit memory create — DEMO-PARITY ONLY extension (no real
     * Worker route accepts user-authored memory yet; live mode answers the
     * honest NOT_FOUND). Recorded in INTEGRATION_NOTES D22.
     */
    ['POST', '/groups/:groupId/memory', (p, req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const content = typeof body.content === 'string' ? body.content.trim() : '';
      const scopeType = body.scope_type;
      const memoryType = body.memory_type;
      if (!content || content.length > 2000) {
        return fail(400, 'VALIDATION_FAILED', 'content is required (max 2000 chars).');
      }
      if (scopeType !== 'GROUP' && scopeType !== 'PROJECT' && scopeType !== 'USER_PRIVATE') {
        return fail(400, 'VALIDATION_FAILED', 'scope_type must be GROUP, PROJECT or USER_PRIVATE.');
      }
      const groupId =
        scopeType === 'USER_PRIVATE'
          ? String(body.group_id ?? p.groupId)
          : p.groupId;
      if (scopeType !== 'USER_PRIVATE' && !ds.groups.some((g) => g.id === groupId)) {
        return fail(404, 'NOT_FOUND', 'Group not found.');
      }
      const projectId = scopeType === 'PROJECT' ? (body.project_id as string | null) ?? null : null;
      const nowIso = new Date().toISOString();
      const memory = {
        id: `mem_${crypto.randomUUID()}`,
        scope_type: scopeType as 'GROUP' | 'PROJECT' | 'USER_PRIVATE',
        group_id: groupId,
        project_id: projectId,
        user_id: scopeType === 'USER_PRIVATE' ? ds.currentUser.id : null,
        memory_type: typeof memoryType === 'string' ? memoryType : 'FACT',
        content,
        normalized_content: null,
        confidence: 1,
        importance: 0.5,
        source_type: 'explicit',
        source_id: null,
        status: 'ACTIVE' as const,
        created_at: nowIso,
        updated_at: nowIso,
        last_used_at: null,
        archived_at: null,
      };
      ds.memories.push(memory);
      getDemoHub().broadcast('memory.approved', groupId, { memory });
      return ok(memory, 201);
    }],

    // ── Attachments (P4): BE §43 rows, §81 validation, §84 signing. ────────

    // §84 — mint a short-lived signed URL after "authorization".
    ['POST', '/attachments/:attachmentId/sign', (p) => {
      if (!demoObjects.has(p.attachmentId)) return fail(404, 'NOT_FOUND', 'File not found.');
      return ok({
        attachment_id: p.attachmentId,
        url: `/api/v1/attachments/${p.attachmentId}/download?token=${signDemoToken(p.attachmentId)}`,
        expires_in_seconds: SIGNED_URL_LIFETIME_SECONDS,
      });
    }],

    // Binary serving lands with the P6 file viewer; until then the demo
    // answers with the object metadata it stores for the signed round-trip.
    ['GET', '/attachments/:attachmentId/download', (p, req) => {
      const token = new URLSearchParams(req.path.split('?')[1] ?? '').get('token');
      if (!token || !verifyDemoToken(p.attachmentId, token)) {
        return fail(403, 'FORBIDDEN', 'This link is invalid or has expired.');
      }
      const obj = demoObjects.get(p.attachmentId);
      if (!obj) return fail(404, 'NOT_FOUND', 'File not found.');
      return ok({
        id: p.attachmentId,
        mime_type: obj.contentType,
        byte_size: obj.byteSize,
      });
    }],
  ];

  return {
    async send(req: TransportRequest): Promise<TransportResponse> {
      // Deterministic-ish latency so loading states are real.
      await sleep(90 + Math.random() * 160);

      const pathOnly = req.path.split('?')[0]!;
      const sessionGate = requireSession(req);
      if (sessionGate) return sessionGate;

      for (const [method, pattern, handler] of routes) {
        if (method !== req.method) continue;
        const params = matchPath(pattern, pathOnly.replace(/^\/api\/v1/, ''));
        if (!params) continue;
        try {
          return await handler(params, req, ds);
        } catch {
          return fail(500, 'INTERNAL');
        }
      }
      return fail(404, 'NOT_FOUND', `No demo handler for ${req.method} ${pathOnly}`);
    },

    /**
     * Multipart upload (BE §43/§104) — the only demo path needing the
     * `upload` capability. Simulates §50-style progress ticks, enforces the
     * §178 limits exactly like handlers/attachments.ts (mirroring its
     * VALIDATION_FAILED messages), and stores the object for §84 signing.
     *
     * Deterministic failure injection for E2E (bible P4 exit): a filename
     * starting with `fail` aborts mid-transfer with a BE §102 envelope.
     */
    async upload(req: TransportUploadRequest): Promise<TransportResponse> {
      await sleep(60);

      const gate = requireSession({ path: req.path });
      if (gate) return gate;

      const pathOnly = req.path.split('?')[0]!.replace(/^\/api\/v1/, '');
      const params = matchPath('/groups/:groupId/attachments', pathOnly);
      if (!params) return fail(404, 'NOT_FOUND', `No demo upload handler for ${req.path}`);

      if (!ds.groups.some((g) => g.id === params.groupId)) {
        return fail(404, 'NOT_FOUND', 'Group not found.');
      }

      const file = req.form.get('file');
      if (!(file instanceof File)) {
        return fail(400, 'VALIDATION_FAILED', "multipart 'file' field is required.");
      }

      // §178 limits — same messages as packages/domain validateUpload.
      if (file.size > ATTACHMENT_MAX_BYTES) {
        return fail(400, 'VALIDATION_FAILED', 'File exceeds the size limit.');
      }
      const messageId = (req.form.get('message_id') as string | null) ?? null;
      const linkedCount = messageId
        ? [...demoObjects.values()].filter((o) => o.messageId === messageId).length
        : 0;
      if (linkedCount >= ATTACHMENTS_PER_MESSAGE_MAX) {
        return fail(400, 'VALIDATION_FAILED', 'Too many attachments for one message.');
      }

      // Progress ticks — ~450ms of realistic transfer before the row lands.
      const steps = [0.06, 0.18, 0.34, 0.52, 0.71, 0.88, 1];
      for (const fraction of steps) {
        await sleep(file.name.startsWith('fail') ? 45 : 65);
        if (req.signal?.aborted) return fail(499, 'CANCELLED', 'Upload cancelled.');
        req.onProgress?.(fraction);
        if (file.name.startsWith('fail') && fraction >= 0.52) {
          // §51 exercise: storage-side failure AFTER bytes started moving.
          return fail(500, 'INTERNAL', 'Simulated storage failure.');
        }
      }

      const id = `att_${crypto.randomUUID()}`;
      const projectId = (req.form.get('project_id') as string | null) ?? null;
      const row = {
        id,
        group_id: params.groupId,
        project_id: projectId,
        owner_user_id: ds.currentUser.id,
        object_ref: `groups/${params.groupId}/objects/${id}/1`,
        object_storage: 'R2',
        mime_type: file.type || 'application/octet-stream',
        byte_size: file.size,
        checksum: null,
        original_name: file.name || 'unnamed',
        status: 'SYNCED',
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
      demoObjects.set(id, {
        contentType: row.mime_type,
        byteSize: row.byte_size,
        messageId,
      });
      return ok(row, 201);
    },
  };
}

/** Stored objects backing §84 sign/download round-trips in demo mode. */
const demoObjects = new Map<string, { contentType: string; byteSize: number; messageId: string | null }>();

/** Deterministic demo HMAC stand-in: token binds attachment id + expiry (§84 shape). */
function signDemoToken(attachmentId: string): string {
  const expiresAt = Date.now() + SIGNED_URL_LIFETIME_SECONDS * 1000;
  return `demo.${attachmentId}.${expiresAt}`;
}

function verifyDemoToken(attachmentId: string, token: string): boolean {
  const parts = token.split('.');
  return (
    parts.length === 3 &&
    parts[0] === 'demo' &&
    parts[1] === attachmentId &&
    Number(parts[2]) > Date.now()
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** §64 model discovery — deterministic per-provider catalogs (ModelDescriptor shape). */
function demoModelsFor(provider: string): Array<{ model_id: string; display_name: string; context_window: number | null }> {
  switch (provider) {
    case 'anthropic':
      return [
        { model_id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5', context_window: 200_000 },
        { model_id: 'claude-opus-4-1', display_name: 'Claude Opus 4.1', context_window: 200_000 },
        { model_id: 'claude-haiku-4-5', display_name: 'Claude Haiku 4.5', context_window: 200_000 },
      ];
    case 'openai':
      return [
        { model_id: 'gpt-5.2', display_name: 'GPT-5.2', context_window: 400_000 },
        { model_id: 'gpt-5.2-mini', display_name: 'GPT-5.2 mini', context_window: 400_000 },
      ];
    case 'google':
      return [{ model_id: 'gemini-3-pro', display_name: 'Gemini 3 Pro', context_window: 1_000_000 }];
    case 'openrouter':
      return [
        { model_id: 'anthropic/claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5 (OR)', context_window: 200_000 },
        { model_id: 'openai/gpt-5.2', display_name: 'GPT-5.2 (OR)', context_window: 400_000 },
      ];
    default:
      return [];
  }
}
