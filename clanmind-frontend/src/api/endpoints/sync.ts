/**
 * Sync endpoints — offline queue reconciliation (FE §186A / BE §20–§20A).
 *
 * CONTRACT STATUS (honest, see INTEGRATION_NOTES D25): the backend has the
 * §20A tables but NO sync REST routes yet (backend audit H3). These modules
 * implement the client contract derived from BE §20's protocol obligations
 * ("push local operations … server validates + applies … returns acks /
 * conflicts") and the exact §20A row shapes. The demo transport reproduces
 * them over the dataset; live mode surfaces honest NOT_FOUND until Zeus
 * ships the routes — nothing is faked in live.
 *
 * `message.create` replays do NOT go through this module: they reuse the
 * real, idempotent POST /groups/:id/messages path (D9 — Idempotency-Key +
 * client_message_id), which exists in both modes today. Same for
 * `task.update` CAS PATCHes. This batch surface is for everything else.
 */

import { z } from 'zod';
import { api } from '@/api/client';
import type { SyncConflict, SyncOperation, SyncResolutionStrategy } from '@/types';

// ─── Wire schemas (BE §20A row shapes) ──────────────────────────────────────

export const SyncConflictSchema = z.object({
  id: z.string(),
  group_id: z.string(),
  entity_type: z.string(),
  entity_id: z.string(),
  conflict_type: z.enum(['version_mismatch', 'concurrent_edit', 'deleted_upstream']),
  local_payload: z.record(z.string(), z.unknown()),
  server_payload: z.record(z.string(), z.unknown()),
  resolution_strategy: z.enum(['server_wins', 'client_wins', 'merged', 'manual']).nullish(),
  resolved_by: z.string().nullish(),
  resolved_at: z.string().nullish(),
  created_at: z.string().optional(),
});

export type SyncConflictRow = z.infer<typeof SyncConflictSchema>;

const PushResultStatusSchema = z.enum(['APPLIED', 'REJECTED', 'CONFLICT']);

export const SyncPushResultSchema = z.object({
  client_operation_id: z.string(),
  status: PushResultStatusSchema,
  /** BE §20A result_reference — id of the resulting row once applied. */
  result_reference: z.string().nullish(),
  error_message: z.string().optional(),
  /** Present when status === CONFLICT — a full §20A sync_conflicts row. */
  conflict: SyncConflictSchema.optional(),
});

export type SyncPushResult = z.infer<typeof SyncPushResultSchema>;

/** One queued operation as it travels on the wire (BE §20A column set). */
export interface SyncWireOperation {
  client_operation_id: string;
  operation_type: string;
  entity_type: string;
  entity_id: string;
  action: SyncOperation['action'];
  payload: Record<string, unknown>;
  created_at: string;
}

/** Serialize a local queue row to its wire shape. */
export function toWireOperation(op: SyncOperation): SyncWireOperation {
  return {
    client_operation_id: op.client_operation_id,
    operation_type: op.operation_type,
    entity_type: op.entity_type,
    entity_id: op.entity_id,
    action: op.action,
    payload: op.payload,
    created_at: op.created_at,
  };
}

function conflictFromRow(row: SyncConflictRow): SyncConflict {
  return {
    id: row.id,
    group_id: row.group_id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    conflict_type: row.conflict_type,
    local_payload: row.local_payload,
    server_payload: row.server_payload,
    ...(row.resolution_strategy ? { resolution_strategy: row.resolution_strategy } : {}),
    ...(row.resolved_by ? { resolved_by: row.resolved_by } : {}),
    ...(row.resolved_at ? { resolved_at: row.resolved_at } : {}),
    ...(row.created_at ? { created_at: row.created_at } : {}),
  };
}

export function conflictRowOf(conflict: SyncConflict): SyncConflictRow {
  return {
    id: conflict.id,
    group_id: conflict.group_id,
    entity_type: conflict.entity_type,
    entity_id: conflict.entity_id,
    conflict_type: conflict.conflict_type,
    local_payload: conflict.local_payload,
    server_payload: conflict.server_payload,
    resolution_strategy: conflict.resolution_strategy ?? null,
    resolved_by: conflict.resolved_by ?? null,
    resolved_at: conflict.resolved_at ?? null,
    ...(conflict.created_at ? { created_at: conflict.created_at } : {}),
  };
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

/**
 * BE §20 "push local operations" — one ordered batch of queued writes.
 * The server validates + applies each entry IN ORDER and answers per-op
 * acks/conflicts; a batch that cannot be fully processed is never retried
 * wholesale by the caller (the engine re-pushes only what stays PENDING).
 */
export async function pushSyncOperations(
  groupId: string,
  operations: SyncWireOperation[],
): Promise<SyncPushResult[]> {
  const res = await api.post<{ results?: unknown }>(
    `/groups/${groupId}/sync/operations`,
    { operations },
    { idempotencyKey: `syncbatch_${crypto.randomUUID()}` },
  );
  const results = Array.isArray(res?.results) ? res.results : [];
  const parsed = z.array(SyncPushResultSchema).safeParse(results);
  if (!parsed.success) {
    throw new Error('[sync] pushSyncOperations: malformed results payload');
  }
  return parsed.data;
}

/** Unresolved conflicts recorded against this Group's queued writes. */
export async function fetchSyncConflicts(groupId: string): Promise<SyncConflict[]> {
  const res = await api.get<{ items?: unknown }>(`/groups/${groupId}/sync/conflicts`);
  const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
  const parsed = z.array(SyncConflictSchema).safeParse(items);
  if (!parsed.success) return [];
  return parsed.data.map(conflictFromRow);
}

/**
 * §186A.4 — resolution writes back through the SAME sync_conflicts row
 * (resolution_strategy / resolved_by / resolved_at), never a new flow.
 */
export async function resolveSyncConflict(
  conflictId: string,
  strategy: SyncResolutionStrategy,
  resolvedBy: string,
): Promise<SyncConflict | null> {
  const res = await api.post<{ conflict?: unknown }>(
    `/sync/conflicts/${conflictId}/resolve`,
    { resolution_strategy: strategy, resolved_by: resolvedBy },
    { idempotencyKey: `resolve_${conflictId}_${strategy}` },
  );
  const parsed = z.object({ conflict: SyncConflictSchema }).safeParse(res);
  return parsed.success ? conflictFromRow(parsed.data.conflict) : null;
}
