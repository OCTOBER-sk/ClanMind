import { z } from "zod";

/**
 * §114 WebSocket protocol messages.
 * Client → server and server → client message names are closed sets; the
 * backend is authoritative for command parsing (§14.2).
 */

export const CLIENT_TO_SERVER = [
  "connection.hello",
  "room.subscribe",
  "message.send",
  "message.edit",
  "message.delete",
  "message.react",
  "typing.start",
  "typing.stop",
  "presence.update",
  "ai.run",
  "ai.cancel",
  "artifact.interaction",
  "meeting.start",
  "meeting.end",
  "sync.ack",
  "sync.request",
] as const;

export const SERVER_TO_CLIENT = [
  "connection.ready",
  "message.created",
  "message.updated",
  "message.deleted",
  "reaction.updated",
  "presence.updated",
  "typing.updated",
  "ai.started",
  "ai.status",
  "ai.tool",
  "ai.delta",
  "ai.completed",
  "ai.failed",
  "artifact.event",
  "approval.requested",
  "task.updated",
  "decision.updated",
  "github.updated",
  "meeting.event",
  "sync.events",
  "sync.conflict",
  "error",
] as const;

export type ClientToServer = (typeof CLIENT_TO_SERVER)[number];
export type ServerToClient = (typeof SERVER_TO_CLIENT)[number];

const clientMessageBase = z.object({
  /** §19 idempotency: the client-generated operation id, reused verbatim on retry. */
  client_operation_id: z.string().min(8).max(128),
});

export const connectionHelloSchema = clientMessageBase.extend({
  type: z.literal("connection.hello"),
  protocol_version: z.number().int().positive(),
  client_version: z.string().min(1),
  device_id: z.string().uuid(),
  last_server_sequence: z.number().int().nonnegative().optional(),
});

export const roomSubscribeSchema = clientMessageBase.extend({
  type: z.literal("room.subscribe"),
  group_id: z.string().uuid(),
});

export const typingSchema = clientMessageBase.extend({
  type: z.enum(["typing.start", "typing.stop"]),
});

export const presenceUpdateSchema = clientMessageBase.extend({
  type: z.literal("presence.update"),
  state: z.enum(["ONLINE", "IDLE", "AWAY"]),
  /** §97 viewing signal: what the user is looking at right now. */
  viewing_subject_type: z.string().min(1).max(40).nullable().optional(),
  viewing_subject_id: z.string().min(1).max(80).nullable().optional(),
});

export const syncRequestSchema = clientMessageBase.extend({
  type: z.literal("sync.request"),
  from_sequence: z.number().int().nonnegative(),
  limit: z.number().int().positive().max(500).optional(),
});

/** §105/§114 — WS send persists through the same atomic RPC as REST. */
export const messageSendSchema = clientMessageBase.extend({
  type: z.literal("message.send"),
  body: z.string().min(1).max(8000),
  project_id: z.string().uuid().nullable().optional(),
  reply_to_id: z.string().uuid().nullable().optional(),
  mention_user_ids: z.array(z.string().uuid()).max(50).optional(),
});

export const messageEditSchema = clientMessageBase.extend({
  type: z.literal("message.edit"),
  message_id: z.string().uuid(),
  body: z.string().min(1).max(8000),
});

export const messageDeleteSchema = clientMessageBase.extend({
  type: z.literal("message.delete"),
  message_id: z.string().uuid(),
});

export const messageReactSchema = clientMessageBase.extend({
  type: z.literal("message.react"),
  message_id: z.string().uuid(),
  emoji: z.string().min(1).max(32),
  action: z.enum(["add", "remove"]),
});

/** §157: client acknowledges it has durably applied events up to a sequence. */
export const syncAckSchema = clientMessageBase.extend({
  type: z.literal("sync.ack"),
  up_to_sequence: z.number().int().nonnegative(),
});

export const meetingStartSchema = clientMessageBase.extend({
  type: z.literal("meeting.start"),
  project_id: z.string().uuid().nullable().optional(),
});

export const meetingEndSchema = clientMessageBase.extend({
  type: z.literal("meeting.end"),
  meeting_session_id: z.string().uuid(),
  summary_text: z.string().min(1),
});

export const artifactInteractionSchema = clientMessageBase.extend({
  type: z.literal("artifact.interaction"),
  artifact_id: z.string().uuid(),
  interaction: z.string().min(1).max(40),
});

export const aiRunSchema = clientMessageBase.extend({
  type: z.literal("ai.run"),
  message: z.string().min(1),
  project_id: z.string().uuid().nullable().optional(),
  mode: z.enum(["ASSIST", "FACILITATE", "ACT"]).optional(),
  visibility: z.enum(["GROUP", "PRIVATE_PAIR", "PRIVATE_AI"]).optional(),
});

export const aiCancelSchema = clientMessageBase.extend({
  type: z.literal("ai.cancel"),
  run_id: z.string().uuid(),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  connectionHelloSchema,
  roomSubscribeSchema,
  typingSchema,
  presenceUpdateSchema,
  syncRequestSchema,
  messageSendSchema,
  messageEditSchema,
  messageDeleteSchema,
  messageReactSchema,
  syncAckSchema,
  meetingStartSchema,
  meetingEndSchema,
  artifactInteractionSchema,
  aiRunSchema,
  aiCancelSchema,
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
