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

export const clientMessageSchema = z.discriminatedUnion("type", [
  connectionHelloSchema,
  roomSubscribeSchema,
  typingSchema,
  presenceUpdateSchema,
  syncRequestSchema,
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
