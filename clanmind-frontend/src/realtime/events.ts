/**
 * Realtime wire contracts — event envelope (BE §17) and the C→S / S→C
 * protocol vocabularies (BE §114). Runtime-validated on every inbound frame.
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
  'message.deleted',
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

/** Payload of `connection.ready` — version metadata per BE §165. */
export const ConnectionReadyPayloadSchema = z
  .object({
    user_id: z.string().optional(),
    minimum_client_version: z.string().optional(),
    recommended_client_version: z.string().optional(),
    protocol_version: z.number().optional(),
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

// ─── Client → Server builders (BE §114) ─────────────────────────────────────

export interface ClientEventFrame {
  type: string;
  request_id: string;
  [key: string]: unknown;
}

function frame(type: string, body: Record<string, unknown>): ClientEventFrame {
  return { type, request_id: `req_${crypto.randomUUID()}`, ...body };
}

export const clientEvents = {
  hello: () =>
    frame('connection.hello', {
      protocol_version: CLIENT_PROTOCOL_VERSION,
      client_version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
    }),
  roomSubscribe: (groupId: string) => frame('room.subscribe', { group_id: groupId }),
  messageSend: (payload: {
    group_id: string;
    project_id?: string | null;
    client_message_id: string;
    body: string;
    visibility: string;
    reply_to_message_id?: string | null;
    recipient_id?: string | null;
    attachment_ids?: string[];
  }) => frame('message.send', { ...payload }),
  typingStart: (groupId: string) => frame('typing.start', { group_id: groupId }),
  typingStop: (groupId: string) => frame('typing.stop', { group_id: groupId }),
  presenceUpdate: (state: 'ONLINE' | 'IDLE' | 'AWAY' | 'OFFLINE') =>
    frame('presence.update', { state }),
  aiCancel: (runId: string) => frame('ai.cancel', { run_id: runId }),
  syncRequest: (groupId: string, fromSequence: number) =>
    frame('sync.request', { group_id: groupId, from_sequence: fromSequence }),
  syncAck: (groupId: string, throughSequence: number) =>
    frame('sync.ack', { group_id: groupId, through_sequence: throughSequence }),
} as const;
