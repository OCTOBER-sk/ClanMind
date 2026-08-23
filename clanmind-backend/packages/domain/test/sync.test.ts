import { describe, expect, it } from "vitest";
import type { RealtimeEnvelope } from "@clanmind/contracts";
import {
  SyncService,
  type SyncCheckpoint,
  type SyncConflict,
  type SyncOperation,
  type SyncRepository,
} from "../src/sync/sync.service";

function makeSyncRepo(events: RealtimeEnvelope[] | null = []) {
  const operations: SyncOperation[] = [];
  const conflicts: SyncConflict[] = [];
  const checkpoints: SyncCheckpoint[] = [];
  const r: SyncRepository = {
    async upsertCheckpoint(input) {
      const existing = checkpoints.find(
        (c) => c.device_id === input.device_id && c.group_id === input.group_id,
      );
      if (existing) {
        Object.assign(existing, input, { last_synced_at: new Date().toISOString() });
        return existing;
      }
      const row: SyncCheckpoint = { ...input, last_synced_at: new Date().toISOString() };
      checkpoints.push(row);
      return row;
    },
    async findCheckpoint(deviceId, groupId) {
      return checkpoints.find((c) => c.device_id === deviceId && c.group_id === groupId) ?? null;
    },
    async recordOperation(input) {
      const existing = operations.find(
        (o) =>
          o.device_id === input.device_id &&
          o.client_operation_id === input.client_operation_id,
      );
      if (existing) return { operation: existing, duplicate: true };
      const op: SyncOperation = {
        ...input,
        server_received_at: new Date().toISOString(),
        status: "PENDING",
        result_reference: null,
        id: crypto.randomUUID(),
      };
      operations.push(op);
      return { operation: op, duplicate: false };
    },
    async setStatus(id, status, resultReference) {
      const op = operations.find((o) => o.id === id);
      if (op) {
        op.status = status;
        op.result_reference = resultReference;
      }
    },
    async pendingOperations(groupId, deviceId) {
      return operations.filter(
        (o) => o.group_id === groupId && o.device_id === deviceId && o.status === "PENDING",
      );
    },
    async insertConflict(input) {
      const row: SyncConflict = {
        ...input,
        resolution_strategy: null,
        resolved_by: null,
        resolved_at: null,
        created_at: new Date().toISOString(),
        id: crypto.randomUUID(),
      };
      conflicts.push(row);
      return row;
    },
    async resolveConflict(id, strategy, resolvedBy) {
      const row = conflicts.find((c) => c.id === id);
      if (row) {
        row.resolution_strategy = strategy;
        row.resolved_by = resolvedBy;
        row.resolved_at = new Date().toISOString();
      }
    },
    async eventsSince(groupId, fromSequence) {
      if (fromSequence < 0) return null;
      return (events ?? []).filter((e) => e.sequence > fromSequence);
    },
  };
  return { operations, conflicts, checkpoints, r };
}

const DEVICE = "00000000-0000-4000-8000-0000000000d1";
const USER = "00000000-0000-4000-8000-000000000001";

describe("§19/§20A operation idempotency", () => {
  it("a retried offline operation reuses its id and creates one row", async () => {
    const s = makeSyncRepo();
    const svc = new SyncService(s.r);
    const first = await svc.pushOperation({
      device_id: DEVICE,
      user_id: USER,
      group_id: "g1",
      client_operation_id: "op_123",
      operation_type: "message.create",
      payload: { body: "hi" },
      client_created_at: new Date().toISOString(),
    });
    expect(first.duplicate).toBe(false);
    const retry = await svc.pushOperation({
      device_id: DEVICE,
      user_id: USER,
      group_id: "g1",
      client_operation_id: "op_123",
      operation_type: "message.create",
      payload: { body: "hi" },
      client_created_at: new Date().toISOString(),
    });
    expect(retry.duplicate).toBe(true);
    expect(retry.operation.id).toBe(first.operation.id);
    expect(s.operations).toHaveLength(1);
  });
});

describe("§20.2 reconnect flow", () => {
  it("exchanges the checkpoint, returns missing events, acks and conflicts", async () => {
    const s = makeSyncRepo([
      { sequence: 101, } as unknown as RealtimeEnvelope,
      { sequence: 102, } as unknown as RealtimeEnvelope,
    ]);
    const svc = new SyncService(s.r);
    await svc.pushOperation({
      device_id: DEVICE,
      user_id: USER,
      group_id: "g1",
      client_operation_id: "op_ok",
      operation_type: "message.create",
      payload: {},
      client_created_at: new Date().toISOString(),
    });
    await svc.pushOperation({
      device_id: DEVICE,
      user_id: USER,
      group_id: "g1",
      client_operation_id: "op_stale",
      operation_type: "task.update",
      payload: { version: 12 },
      client_created_at: new Date().toISOString(),
    });
    await svc.pushOperation({
      device_id: DEVICE,
      user_id: USER,
      group_id: "g1",
      client_operation_id: "op_deleted",
      operation_type: "task.update",
      payload: {},
      client_created_at: new Date().toISOString(),
    });

    const result = await svc.reconnect({
      device_id: DEVICE,
      user_id: USER,
      group_id: "g1",
      last_server_sequence: 100,
      applyOperation: async (op) => {
        if (op.client_operation_id === "op_ok") {
          return { kind: "APPLIED", result_reference: "msg-1" };
        }
        if (op.client_operation_id === "op_stale") {
          return {
            kind: "CONFLICT",
            conflict_type: "version_mismatch",
            server_payload: { version: 13 },
          };
        }
        return { kind: "REJECTED", reason: "revoked" };
      },
    });

    expect(result.events?.map((e) => e.sequence)).toEqual([101, 102]);
    expect(result.acks).toEqual([
      { client_operation_id: "op_ok", status: "APPLIED" },
      { client_operation_id: "op_stale", status: "CONFLICT" },
      { client_operation_id: "op_deleted", status: "REJECTED" },
    ]);
    expect(s.conflicts).toHaveLength(1);
    expect(s.conflicts[0]?.conflict_type).toBe("version_mismatch");
    expect(s.conflicts[0]?.server_payload).toEqual({ version: 13 });
    expect(result.checkpoint.last_server_sequence).toBe(100);
  });

  it("reports fallback when the event window is gone (§157)", async () => {
    const s = makeSyncRepo(null);
    const svc = new SyncService(s.r);
    const result = await svc.reconnect({
      device_id: DEVICE,
      user_id: USER,
      group_id: "g1",
      last_server_sequence: -1,
      applyOperation: async () => ({ kind: "APPLIED", result_reference: null }),
    });
    expect(result.events_fallback).toBe(true);
  });
});

describe("§21 conflict rules", () => {
  it("structured objects: stale versions conflict (§21.2)", () => {
    expect(SyncService.versionConflict({ version: 12 }, { version: 13 })).toEqual({
      conflict: true,
      conflict_type: "version_mismatch",
    });
    expect(SyncService.versionConflict({ version: 12 }, { version: 12 })).toEqual({ conflict: false });
  });

  it("artifacts: edits behind the current version conflict (§21.3)", () => {
    expect(SyncService.artifactConflict({ base_version: 1 }, { current_version: 3 })).toEqual({
      conflict: true,
      conflict_type: "concurrent_edit",
    });
    expect(SyncService.artifactConflict({ base_version: 3 }, { current_version: 3 })).toEqual({
      conflict: false,
    });
  });

  it("messages: cloud ordering always wins (§21.1)", () => {
    expect(SyncService.messageOrdering("2020-01-01T00:00:00Z", 4812)).toEqual({
      server_sequence: 4812,
    });
  });
});

describe("§186A.4 conflict resolution write-back", () => {
  it("resolutions update the same conflict row", async () => {
    const s = makeSyncRepo();
    const svc = new SyncService(s.r);
    await svc.pushOperation({
      device_id: DEVICE,
      user_id: USER,
      group_id: "g1",
      client_operation_id: "op_c",
      operation_type: "task.update",
      payload: {},
      client_created_at: new Date().toISOString(),
    });
    await svc.reconnect({
      device_id: DEVICE,
      user_id: USER,
      group_id: "g1",
      last_server_sequence: 0,
      applyOperation: async () => ({
        kind: "CONFLICT",
        conflict_type: "deleted_upstream",
        server_payload: {},
      }),
    });
    const conflict = s.conflicts[0]!;
    await svc.resolveConflict({
      conflict_id: conflict.id,
      strategy: "manual",
      resolved_by: USER,
    });
    expect(s.conflicts[0]?.resolution_strategy).toBe("manual");
    expect(s.conflicts[0]?.resolved_by).toBe(USER);
  });
});
