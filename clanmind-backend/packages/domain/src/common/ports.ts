import type { EventType } from "@clanmind/contracts";

/**
 * Ports shared by domain services. The outbox port (§123) lets services
 * publish events inside the same logical write; the concrete implementation
 * lands with the outbox task (A8) and is injected from the worker.
 */
export interface OutboxEventInput {
  event_type: EventType;
  aggregate_type: string;
  aggregate_id: string;
  group_id: string | null;
  actor_id: string | null;
  payload: Record<string, unknown>;
}

export interface EventOutbox {
  publish(event: OutboxEventInput): Promise<void>;
}

export const NOOP_OUTBOX: EventOutbox = {
  async publish() {
    /* wired in A8 */
  },
};

/** §99 audit port — append-only writes for sensitive actions. */
export interface AuditEventInput {
  group_id: string | null;
  actor_user_id: string | null;
  action_type: string;
  subject_type: string;
  subject_id: string;
  payload: Record<string, unknown>;
  request_id: string | null;
}

export interface AuditLog {
  append(event: AuditEventInput): Promise<void>;
}

export const NOOP_AUDIT: AuditLog = {
  async append() {
    /* wired in A8 */
  },
};
