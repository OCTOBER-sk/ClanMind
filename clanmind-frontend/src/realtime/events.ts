/**
 * Realtime wire contracts — event envelope (BE §17) and the C→S / S→C
 * protocol vocabularies (BE §114). Runtime-validated on every inbound frame.
 *
 * C→S frames mirror `@clanmind/contracts` clientMessageSchema exactly:
 * every command carries a §19 `client_operation_id` (≥ 8 chars, reused
 * verbatim on retry), `connection.hello` additionally carries the stable
 * per-device `device_id`, and `presence.update` accepts ONLINE/IDLE/AWAY —
 * OFFLINE is server-derived from the disconnect grace period (BE §16/§96),
 * never client-asserted.
 */

import { z } from 'zod';

/** Bump only when the client intentionally speaks a newer protocol. */
export const CLIENT_PROTOCOL_VERSION = 1;

export const RealtimeEnvelopeSchema = z
  .object({
    protocol_version: z.number(),
    event_id: z.string(),
    event_type: z.string(),
    sequence: z.number(),
    group_id: z.string(),
    project_id: z.string().nullable().optional(),
    actor_id: z.string().nullable().optional(),
    visibility: z.string().optional(),
    occurred_at: z.string(),
    payload: z.unknown().optional(),
    request_id: z.string().nullable().optional(),
  })
  .passthrough();

export type RealtimeEvent = z.infer<typeof RealtimeEnvelopeSchema> & {
  event_type: string;
  payload?: unknown;
};

// ─── Server → Client vocabulary (BE §114) ───────────────────────────────────

export const SERVER_EVENT_TYPES = [
  'connection.ready',
  'message.created',
  'message.updated',
  'message.edited',
  'message.deleted',
  'message.pinned',
  'message.unpinned',
  'reaction.updated',
  'presence.updated',
  'typing.updated',
  'ai.started',
  'ai.status',
  'ai.tool',
  'ai.delta',
  'ai.completed',
  'ai.failed',
  'artifact.event',
  'approval.requested',
  'task.updated',
  'decision.updated',
  'github.updated',
  'meeting.event',
  'sync.events',
  'sync.conflict',
  'error',
] as const;

export type ServerEventType = (typeof SERVER_EVENT_TYPES)[number];

/**
 * Payload of `connection.ready` — version metadata per BE §165.
 * Fields are optional: the real room sends `protocol_version` (+ presence
 * snapshot after room.subscribe); full version metadata also arrives via
 * REST `GET /api/v1/client-versions`.
 */
export const ConnectionReadyPayloadSchema = z
  .object({
    user_id: z.string().optional(),
    minimum_client_version: z.string().optional(),
    recommended_client_version: z.string().optional(),
    protocol_version: z.number().optional(),
    /** Room allocator position at ready (real room control frames). */
    sequence: z.number().optional(),
  })
  .passthrough();

export type ConnectionReadyPayload = z.infer<typeof ConnectionReadyPayloadSchema>;

/** Payload of the terminal `error` server frame. */
export const ServerErrorPayloadSchema = z
  .object({
    code: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

// ─── Client → Server builders (BE §114 + @clanmind/contracts schemas) ───────

export interface ClientEventFrame {
  type: string;
  /** §19 idempotency identity — ≥ 8 chars, reused verbatim on retry. */
  request_id: string;
  client_operation_id: string;
  [key: string]: unknown;
}

function frame(type: string, body: Record<string, unknown>): ClientEventFrame {
  return {
    type,
    request_id: `req_${crypto.randomUUID()}`,
    client_operation_id: `op_${crypto.randomUUID()}`,
    ...body,
  };
}

/**
 * Stable per-device identifier (BE contracts: `device_id: uuid`). Persisted
 * in localStorage so reconnects present the same device identity; used for
 * §20A sync checkpoints as well.
 */
export function getDeviceId(): string {
  const KEY = 'cm_device_id';
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // localStorage unavailable (private mode) — ephemeral identity still
    // satisfies the wire contract for this session.
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `dt_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }
}

export const clientEvents = {
  hello: (opts?: { lastServerSequence?: number }) =>
    frame('connection.hello', {
      protocol_version: CLIENT_PROTOCOL_VERSION,
      client_version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
      device_id: getDeviceId(),
      ...(typeof opts?.lastServerSequence === 'number'
        ? { last_server_sequence: opts.lastServerSequence }
        : {}),
    }),
  roomSubscribe: (groupId: string) => frame('room.subscribe', { group_id: groupId }),
  /**
   * WS message.send mirrors `messageSendSchema`: body, project_id,
   * reply_to_id, mention_user_ids. Private scope is NOT addressable over WS
   * (the room is group-scoped); REST POST /messages owns private sends.
   */
  messageSend: (payload: {
    project_id?: string | null;
    client_message_id: string;
    body: string;
    reply_to_id?: string | null;
    mention_user_ids?: string[];
  }) =>
    frame('message.send', {
      client_operation_id: payload.client_message_id,
      project_id: payload.project_id ?? null,
      body: payload.body,
      reply_to_id: payload.reply_to_id ?? null,
      mention_user_ids: payload.mention_user_ids ?? [],
    }),
  typingStart: () => frame('typing.start', {}),
  typingStop: () => frame('typing.stop', {}),
  /** OFFLINE is never sent — the server derives it (BE §16 disconnect debounce). */
  presenceUpdate: (state: 'ONLINE' | 'IDLE' | 'AWAY') => frame('presence.update', { state }),
  aiCancel: (runId: string) => frame('ai.cancel', { run_id: runId }),
  syncRequest: (groupId: string, fromSequence: number, limit?: number) =>
    frame('sync.request', { group_id: groupId, from_sequence: fromSequence, limit }),
  syncAck: (groupId: string, upToSequence: number) =>
    frame('sync.ack', { group_id: groupId, up_to_sequence: upToSequence }),
} as const;
