import type { SyncConflictType, SyncResolutionStrategy } from "@clanmind/contracts";
import { AppError } from "@clanmind/shared";
import type { RealtimeEnvelope } from "@clanmind/contracts";

/** §20A rows. */
export interface SyncOperation {
  id: string;
  device_id: string;
  user_id: string;
  group_id: string;
  client_operation_id: string;
  operation_type: string;
  payload: Record<string, unknown>;
  client_created_at: string;
  server_received_at: string | null;
  status: "PENDING" | "APPLIED" | "REJECTED" | "CONFLICT";
  result_reference: string | null;
}

export interface SyncConflict {
  id: string;
  sync_operation_id: string;
  conflict_type: SyncConflictType;
  local_payload: Record<string, unknown>;
  server_payload: Record<string, unknown>;
  resolution_strategy: SyncResolutionStrategy | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface SyncCheckpoint {
  device_id: string;
  user_id: string;
  group_id: string;
  last_server_sequence: number;
  last_synced_at: string;
}

export interface SyncRepository {
  upsertCheckpoint(input: Omit<SyncCheckpoint, "last_synced_at">): Promise<SyncCheckpoint>;
  findCheckpoint(deviceId: string, groupId: string): Promise<SyncCheckpoint | null>;
  recordOperation(input: {
    device_id: string;
    user_id: string;
    group_id: string;
    client_operation_id: string;
    operation_type: string;
    payload: Record<string, unknown>;
    client_created_at: string;
  }): Promise<{ operation: SyncOperation; duplicate: boolean }>;
  setStatus(id: string, status: SyncOperation["status"], resultReference: string | null): Promise<void>;
  pendingOperations(groupId: string, deviceId: string): Promise<SyncOperation[]>;
  insertConflict(input: {
    sync_operation_id: string;
    conflict_type: SyncConflictType;
    local_payload: Record<string, unknown>;
    server_payload: Record<string, unknown>;
  }): Promise<SyncConflict>;
  resolveConflict(id: string, strategy: SyncResolutionStrategy, resolvedBy: string): Promise<void>;
  eventsSince(groupId: string, fromSequence: number, limit: number): Promise<RealtimeEnvelope[] | null>;
}

/**
 * §20/§20A Sync Service: push local operations, pull remote operations,
 * resume from checkpoint, detect + resolve conflicts. `client_operation_id`
 * is the idempotency identity — a retried offline operation reuses it
 * verbatim (§19/§186A.2) and produces one logical operation.
 */
export class SyncService {
  constructor(private readonly sync: SyncRepository) {}

  /**
   * §20.2 reconnect flow: checkpoint exchange → missing events → pending ops
   * apply → acks/conflicts. Events beyond the retention window return null
   * and the client falls back to the Postgres history API (§157).
   */
  async reconnect(input: {
    device_id: string;
    user_id: string;
    group_id: string;
    last_server_sequence: number;
    applyOperation: (
      op: SyncOperation,
    ) => Promise<
      | { kind: "APPLIED"; result_reference: string | null }
      | { kind: "REJECTED"; reason: string }
      | { kind: "CONFLICT"; conflict_type: SyncConflictType; server_payload: Record<string, unknown> }
    >;
  }): Promise<{
    checkpoint: SyncCheckpoint;
    events: RealtimeEnvelope[] | null;
    events_fallback: boolean;
    acks: { client_operation_id: string; status: SyncOperation["status"] }[];
  }> {
    const checkpoint = await this.sync.upsertCheckpoint({
      device_id: input.device_id,
      user_id: input.user_id,
      group_id: input.group_id,
      last_server_sequence: input.last_server_sequence,
    });
    const events = await this.sync.eventsSince(
      input.group_id,
      input.last_server_sequence,
      100,
    );

    const acks: { client_operation_id: string; status: SyncOperation["status"] }[] = [];
    for (const op of await this.sync.pendingOperations(input.group_id, input.device_id)) {
      const outcome = await input.applyOperation(op);
      if (outcome.kind === "APPLIED") {
        await this.sync.setStatus(op.id, "APPLIED", outcome.result_reference);
        acks.push({ client_operation_id: op.client_operation_id, status: "APPLIED" });
      } else if (outcome.kind === "REJECTED") {
        await this.sync.setStatus(op.id, "REJECTED", null);
        acks.push({ client_operation_id: op.client_operation_id, status: "REJECTED" });
      } else {
        await this.sync.setStatus(op.id, "CONFLICT", null);
        await this.sync.insertConflict({
          sync_operation_id: op.id,
          conflict_type: outcome.conflict_type,
          local_payload: op.payload,
          server_payload: outcome.server_payload,
        });
        acks.push({ client_operation_id: op.client_operation_id, status: "CONFLICT" });
      }
    }

    return {
      checkpoint,
      events,
      events_fallback: events === null,
      acks,
    };
  }

  /**
   * §21.2 optimistic concurrency outcome for structured objects: a stale
   * client version yields 409 semantics materialized as a version_mismatch
   * conflict row.
   */
  static versionConflict(
    local: { version: number },
    server: { version: number },
  ): { conflict: false } | { conflict: true; conflict_type: "version_mismatch" } {
    return local.version !== server.version
      ? { conflict: true, conflict_type: "version_mismatch" }
      : { conflict: false };
  }

  /**
   * §21.3 artifacts: concurrent edits create separate versions; an unsafe
   * text merge (overlapping changed regions) is surfaced as concurrent_edit
   * rather than silently merged.
   */
  static artifactConflict(
    local: { base_version: number },
    server: { current_version: number },
  ): { conflict: false } | { conflict: true; conflict_type: "concurrent_edit" } {
    return local.base_version < server.current_version
      ? { conflict: true, conflict_type: "concurrent_edit" }
      : { conflict: false };
  }

  /** §21.1: cloud ordering wins — client clocks never reorder messages. */
  static messageOrdering(
    _clientCreatedAt: string,
    serverSequence: number,
  ): { server_sequence: number } {
    return { server_sequence: serverSequence };
  }

  /** §186A.4: resolutions write back through the same conflict row. */
  async resolveConflict(input: {
    conflict_id: string;
    strategy: SyncResolutionStrategy;
    resolved_by: string;
  }): Promise<void> {
    await this.sync.resolveConflict(input.conflict_id, input.strategy, input.resolved_by);
  }

  async pushOperation(input: Parameters<SyncRepository["recordOperation"]>[0]): Promise<{
    operation: SyncOperation;
    duplicate: boolean;
  }> {
    if (!input.client_operation_id || input.client_operation_id.length < 1) {
      throw new AppError("VALIDATION_FAILED", "client_operation_id is required.");
    }
    return this.sync.recordOperation(input);
  }
}
