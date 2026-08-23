import { z } from "zod";

/**
 * §17 realtime event envelope + §18 event taxonomy.
 * Every realtime message shares this versioned envelope. Sequence numbers are
 * per-Group and strictly increasing so clients can detect gaps (§17.1).
 */

export const EVENT_PROTOCOL_VERSION = 1;

export const realtimeEnvelopeSchema = z.object({
  protocol_version: z.literal(EVENT_PROTOCOL_VERSION),
  event_id: z.string().min(1),
  event_type: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  group_id: z.string().uuid(),
  project_id: z.string().uuid().nullable(),
  actor_id: z.string().uuid().nullable(),
  visibility: z.enum(["GROUP", "PRIVATE_PAIR", "PRIVATE_AI"]),
  occurred_at: z.string().datetime(),
  payload: z.record(z.unknown()),
  request_id: z.string().nullable(),
});
export type RealtimeEnvelope = z.infer<typeof realtimeEnvelopeSchema>;

/** §18 domain event taxonomy — the closed set of event types. */
export const EVENT_TYPES = [
  // Group
  "group.created",
  "group.updated",
  "group.deleted",
  "group.owner.transferred",
  "member.invited",
  "member.joined",
  "member.removed",
  "member.role.changed",
  // Presence
  "presence.online",
  "presence.away",
  "presence.offline",
  "presence.typing.started",
  "presence.typing.stopped",
  "presence.viewing.changed",
  // Message
  "message.created",
  "message.edited",
  "message.deleted",
  "message.reaction.added",
  "message.reaction.removed",
  "message.pinned",
  "message.unpinned",
  // AI
  "ai.requested",
  "ai.run.started",
  "ai.status.updated",
  "ai.tool.started",
  "ai.tool.progress",
  "ai.tool.completed",
  "ai.response.delta",
  "ai.response.completed",
  "ai.response.failed",
  "ai.action.proposed",
  "ai.action.approved",
  "ai.action.rejected",
  // Artifact
  "artifact.created",
  "artifact.updated",
  "artifact.version.created",
  "artifact.version.restored",
  "artifact.deleted",
  "artifact.restored",
  "artifact.pinned",
  // Decision
  "decision.proposed",
  "decision.approved",
  "decision.rejected",
  "decision.updated",
  // Task
  "task.created",
  "task.updated",
  "task.assigned",
  "task.completed",
  "task.cancelled",
  // Memory
  "memory.candidate.created",
  "memory.approved",
  "memory.updated",
  "memory.archived",
  "memory.deleted",
  // GitHub
  "github.connected",
  "github.disconnected",
  "github.action.proposed",
  "github.action.approved",
  "github.action.rejected",
  "github.branch.created",
  "github.commit.created",
  "github.pr.created",
  "github.pr.updated",
  "github.pr.merged",
  "github.webhook.received",
  // Meeting
  "meeting.started",
  "meeting.summary.updated",
  "meeting.decision.detected",
  "meeting.task.detected",
  "meeting.ended",
  "meeting.artifacts.created",
  // Sync
  "sync.client.connected",
  "sync.client.reconciled",
  "sync.conflict.detected",
  "sync.conflict.resolved",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const eventTypeSchema = z.enum(EVENT_TYPES);
