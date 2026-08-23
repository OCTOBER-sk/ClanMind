/**
 * Demo REST transport — implements the documented `/api/v1` contract against
 * the in-memory dataset (BE §104–113 subset used by current phases), including
 * realistic latency and the BE §102 error envelope on unknown routes.
 */

import type { Transport, TransportRequest, TransportResponse } from '@/api/transport';
import type { DemoDataset } from './dataset';
import { getDemoHub } from './wsHub';

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
 * Demo session-expiry injection (FE §197 testing). Once tripped, every
 * authenticated domain call answers 401 AUTH_SESSION_EXPIRED until the next
 * successful login "refreshes" the demo session. Auth routes are exempt —
 * signing in must stay possible while expired.
 */
let sessionExpired = false;

export function expireDemoSession(): void {
  sessionExpired = true;
}

function requireSession(req: TransportRequest): TransportResponse | null {
  if (!sessionExpired) return null;
  const path = req.path.split('?')[0]!.replace(/^\/api\/v1/, '');
  if (path.startsWith('/auth/')) return null;
  return fail(401, 'AUTH_SESSION_EXPIRED', 'Your session has expired.');
}

export function createDemoTransport(ds: DemoDataset): Transport {
  let cursorBase = [...ds.messages];

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

    ['GET', '/groups', () => ok(ds.groups)],

    ['GET', '/groups/:groupId/projects', (p) =>
      ok(ds.projects.filter((proj) => proj.group_id === p.groupId))],

    ['GET', '/groups/:groupId/messages', (p, req) => {
      const limit = Number(req.query?.limit ?? 50);
      const before = req.query?.before as string | undefined;
      const all = cursorBase.filter((m) => m.group_id === p.groupId);
      const ordered = [...all].sort((a, b) => a.created_at.localeCompare(b.created_at));
      let endIdx = ordered.length;
      if (before) {
        const idx = ordered.findIndex((m) => m.id === before);
        if (idx > 0) endIdx = idx;
      }
      const start = Math.max(0, endIdx - limit);
      const data = ordered.slice(start, endIdx);
      return ok({ data, next_before: start > 0 ? data[0]?.id ?? null : null });
    }],

    ['POST', '/groups/:groupId/messages', async (p, req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const message = {
        id: `msg_srv_${serverSequence}`,
        group_id: p.groupId,
        project_id: (body.project_id as string | null) ?? null,
        sender_type: 'USER',
        sender_user_id: ds.currentUser.id,
        visibility: String(body.visibility ?? 'GROUP'),
        body: String(body.body ?? ''),
        reply_to_id: (body.reply_to_message_id as string | null) ?? null,
        client_message_id: String(body.client_message_id ?? `op_${serverSequence}`),
        server_sequence: ++serverSequence,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
      };
      cursorBase.push(message as never);
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

    ['POST', '/ai/runs', (_p, req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const runId = `run_${Date.now()}`;
      getDemoHub().startAiRun({
        runId,
        messageId: String(body.message_id ?? ''),
        groupId: String(body.group_id ?? ''),
        projectId: (body.project_id as string | null) ?? null,
        prompt: String(body.prompt ?? ''),
        aiName: String(body.ai_name ?? 'Odin'),
      });
      return ok(
        {
          id: runId,
          group_id: body.group_id,
          project_id: body.project_id ?? null,
          mode: String(body.mode ?? 'ASSIST'),
          status: 'QUEUED',
          created_at: new Date().toISOString(),
        },
        201,
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
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
