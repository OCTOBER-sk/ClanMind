/**
 * Demo REST transport — implements the documented `/api/v1` contract against
 * the in-memory dataset (BE §104–113 subset used by current phases), including
 * realistic latency and the BE §102 error envelope on unknown routes.
 */

import type { Transport, TransportRequest, TransportResponse, TransportUploadRequest } from '@/api/transport';
import type { DemoDataset } from './dataset';
import type { Message } from '@/types';
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

    ['GET', '/groups/:groupId/flags', (p) => {
      void p;
      return ok(ds.featureFlags);
    }],

    ['GET', '/github/status', () =>
      ok({
        connection_status: 'READ_WRITE',
        owner_login: 'clanmind-demo',
        repo_name: 'flight-controller',
        default_branch: 'main',
        last_synced_at: new Date(Date.now() - 15 * 60_000).toISOString(),
      })],

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
