/**
 * Offline mutation queue ("outbox") — FE §182/§183/§186A, BE §20/§20A.
 *
 * Every offline-capable write that cannot reach the server is enqueued as a
 * local mirror of a BE §20A `sync_operations` row and replayed IN ORDER on
 * reconnect (BE §20.2: client sends pending ops → server validates +
 * applies → acks/conflicts). Hard guarantees:
 *
 *  • Identity   — retries reuse the IDENTICAL client_operation_id (§19 /
 *                 §186A.2); minting a new id would turn a legitimate retry
 *                 into a duplicate write.
 *  • Ordering   — strictly sequential FIFO by created_at; a TRANSIENT
 *                 failure (network/5xx/429) halts the whole cycle so later
 *                 operations never overtake an unsent earlier one.
 *  • Outcomes   — §186A.2 statuses drive distinct handling:
 *                   APPLIED  → bubble reconciled, row removed
 *                   REJECTED → terminal refusal (e.g. permission revoked
 *                              while offline); dismissible error, NEVER
 *                              silently dropped, later ops still proceed
 *                   CONFLICT → §20A sync_conflicts row + §186 card; human
 *                              resolution writes back through the SAME row
 *                              (§186A.4)
 *  • Durability — queued rows persist in the account-scoped IndexedDB
 *                 (`sync_ops`, FE §283/§284) so an app restart can never
 *                 silently drop user work; environments without IndexedDB
 *                 fall back to memory-only (progressive enhancement, same
 *                 contract as drafts/cache).
 */

import { api } from '@/api/client';
import { ApiError, NetworkError } from '@/api/errors';
import { TimeoutError } from '@/api/transport';
import {
  pushSyncOperations,
  resolveSyncConflict,
  toWireOperation,
} from '@/api/endpoints/sync';
import { useChatStore } from '@/state/useChatStore';
import { useSyncStore } from '@/state/useSyncStore';
import { openAccountDb, type IDBPDatabase } from '@/local/db';
import type { SyncConflict, SyncConflictType, SyncOperation, SyncResolutionStrategy } from '@/types';

// ─── Persistence seam ────────────────────────────────────────────────────────

interface OutboxPersistence {
  put(op: SyncOperation): Promise<void>;
  remove(clientOperationId: string): Promise<void>;
  list(): Promise<SyncOperation[]>;
}

class MemoryOutbox implements OutboxPersistence {
  private rows = new Map<string, SyncOperation>();
  async put(op: SyncOperation): Promise<void> {
    this.rows.set(op.client_operation_id, op);
  }
  async remove(id: string): Promise<void> {
    this.rows.delete(id);
  }
  async list(): Promise<SyncOperation[]> {
    return [...this.rows.values()];
  }
}

/** Account-scoped IndexedDB mirror (`cm_<userId>` → sync_ops, §283/§284). */
class IdbOutbox implements OutboxPersistence {
  constructor(private readonly open: () => Promise<IDBPDatabase>) {}
  async put(op: SyncOperation): Promise<void> {
    const db = await this.open();
    await db.put('sync_ops', op);
  }
  async remove(id: string): Promise<void> {
    const db = await this.open();
    await db.delete('sync_ops', id);
  }
  async list(): Promise<SyncOperation[]> {
    const db = await this.open();
    return (await db.getAll('sync_ops')) as SyncOperation[];
  }
}

let persistence: OutboxPersistence = new MemoryOutbox();

/**
 * Point the durable mirror at the signed-in account's IndexedDB. Called at
 * session establishment; signing out clears the queue through the normal
 * account lifecycle (clearDomainStores) and the mirror dies with the DB.
 */
export function setOutboxAccount(userId: string | null): void {
  persistence =
    userId && typeof globalThis.indexedDB !== 'undefined'
      ? new IdbOutbox(() => openAccountDb(userId))
      : new MemoryOutbox();
}

async function persistOp(op: SyncOperation): Promise<void> {
  try {
    await persistence.put(op);
  } catch {
    // Persistence is progressive enhancement — the in-memory queue still
    // replays within this session even if the DB write fails.
  }
}

async function unpersistOp(clientOperationId: string): Promise<void> {
  try {
    await persistence.remove(clientOperationId);
  } catch {
    /* same tolerance */
  }
}

// ─── Enqueue / hydrate ───────────────────────────────────────────────────────

/** Queue an offline-capable write durably + visibly (§183/§186A.2). */
export async function enqueueSyncOperation(op: SyncOperation): Promise<void> {
  useSyncStore.getState().addOperation(op);
  await persistOp(op);
}

/**
 * Restore the durable queue after boot / sign-in. Merged with whatever the
 * session already holds (idempotent by client_operation_id via addOperation).
 */
export async function hydrateOutbox(): Promise<number> {
  let rows: SyncOperation[] = [];
  try {
    rows = await persistence.list();
  } catch {
    return 0;
  }
  const store = useSyncStore.getState();
  for (const row of rows) {
    if (!store.pendingOperations.some((o) => o.client_operation_id === row.client_operation_id)) {
      store.addOperation(row);
    }
  }
  return rows.length;
}

// ─── Replay engine (BE §20.2 bottom half) ────────────────────────────────────

let replayInFlight = false;

function sortedPending(): SyncOperation[] {
  return useSyncStore
    .getState()
    .pendingOperations.filter((o) => o.status === 'PENDING')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function outboxPendingCount(): number {
  return sortedPending().length;
}

function stampCheckpointSynced(): void {
  const { checkpoint, setCheckpoint } = useSyncStore.getState();
  if (!checkpoint) return;
  setCheckpoint({ ...checkpoint, last_synced_at: new Date().toISOString() });
}

/** Message-body reconciliation for a queue row backed by an optimistic bubble. */
function reconcileBubble(op: SyncOperation, outcome: 'applied' | 'rejected'): void {
  if (op.operation_type !== 'message.create') return;
  const chat = useChatStore.getState();
  if (outcome === 'applied') {
    chat.confirmPendingMessage(op.client_operation_id);
    chat.updateMessage(op.entity_id, { is_pending: false });
  } else {
    chat.failPendingMessage(op.client_operation_id);
    chat.updateMessage(op.entity_id, { is_pending: false, is_failed: true });
  }
}

async function markApplied(op: SyncOperation, resultReference?: string | null): Promise<void> {
  reconcileBubble(op, 'applied');
  useSyncStore.getState().updateOperation(op.client_operation_id, {
    status: 'APPLIED',
    ...(resultReference ? { result_reference: resultReference } : {}),
  });
  // Applied rows leave the local queue — their durable record is the
  // server's sync_operations row (BE §20A), not our outbox.
  useSyncStore.getState().removeOperation(op.client_operation_id);
  await unpersistOp(op.client_operation_id);
  stampCheckpointSynced();
}

async function markRejected(op: SyncOperation, errorMessage: string): Promise<void> {
  // §186A.2 — REJECTED is terminal and VISIBLE: the row stays in the
  // diagnostics queue (dismissible) instead of being silently dropped.
  reconcileBubble(op, 'rejected');
  useSyncStore.getState().updateOperation(op.client_operation_id, {
    status: 'REJECTED',
    error_message: errorMessage,
  });
  await persistOp({
    ...op,
    status: 'REJECTED',
    error_message: errorMessage,
  });
}

async function markConflicted(
  op: SyncOperation,
  conflictType: SyncConflictType,
  serverPayload: Record<string, unknown>,
  conflictId?: string,
): Promise<void> {
  const existing = useSyncStore
    .getState()
    .conflicts.find((c) => c.sync_operation_id === op.client_operation_id);
  const conflict: SyncConflict = {
    ...(existing ?? { id: conflictId ?? `sc_${op.client_operation_id}` }),
    id: existing?.id ?? conflictId ?? `sc_${op.client_operation_id}`,
    group_id: op.group_id,
    entity_type: op.entity_type,
    entity_id: op.entity_id,
    conflict_type: existing?.conflict_type ?? conflictType,
    local_payload: (op.payload.patch as Record<string, unknown> | undefined) ?? op.payload,
    server_payload: Object.keys(serverPayload).length > 0 ? serverPayload : (existing?.server_payload ?? {}),
    sync_operation_id: op.client_operation_id,
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
  useSyncStore.getState().updateOperation(op.client_operation_id, { status: 'CONFLICT' });
  useSyncStore.getState().upsertConflict(conflict);
  await persistOp({ ...op, status: 'CONFLICT' });
}

function isTransient(err: unknown): boolean {
  if (err instanceof NetworkError || err instanceof TimeoutError || err instanceof TypeError) {
    return true;
  }
  if (err instanceof ApiError) {
    return err.status >= 500 || err.status === 429 || err.status === 0;
  }
  return false;
}

/** Extract the server row from a §102 CONFLICT envelope's details, best-effort. */
function serverPayloadOf(err: ApiError): Record<string, unknown> {
  const details = err.details as
    | { error?: { details?: Record<string, unknown> } }
    | undefined;
  const candidate =
    (details?.error?.details?.server_row as Record<string, unknown> | undefined) ??
    (details?.error?.details?.current as Record<string, unknown> | undefined);
  return candidate && typeof candidate === 'object' ? candidate : {};
}

async function replayOne(op: SyncOperation): Promise<'applied' | 'parked' | 'halt'> {
  try {
    switch (op.operation_type) {
      case 'message.create': {
        // Real, already-idempotent write path (D9): identical
        // client_message_id + Idempotency-Key on every retry.
        const p = op.payload as {
          project_id?: string | null;
          body?: string;
          reply_to_id?: string | null;
          visibility?: string;
          recipient_id?: string | null;
          attachment_ids?: string[];
        };
        const isPrivateAi = p.visibility === 'PRIVATE_AI';
        const isPrivatePair = p.visibility === 'PRIVATE_PAIR';
        const res = await api.post<{ id?: string }>(
          `/groups/${op.group_id}/messages`,
          {
            project_id: p.project_id ?? null,
            client_message_id: op.client_operation_id,
            body: p.body ?? '',
            reply_to_id: p.reply_to_id ?? null,
            ...(p.attachment_ids && p.attachment_ids.length > 0
              ? { attachment_ids: p.attachment_ids }
              : {}),
            ...(isPrivateAi ? { private_to: 'ai' as const } : {}),
            ...(isPrivatePair && p.recipient_id ? { private_to: p.recipient_id } : {}),
          },
          { idempotencyKey: op.client_operation_id },
        );
        await markApplied(op, typeof res?.id === 'string' ? res.id : null);
        return 'applied';
      }

      case 'task.update': {
        // §21.2 optimistic concurrency — a stale expected_version answers
        // 409 CONFLICT, which becomes a version_mismatch sync_conflicts row.
        const p = op.payload as { expected_version?: number; patch?: Record<string, unknown> };
        await api.patch(
          `/tasks/${op.entity_id}`,
          { expected_version: p.expected_version, patch: p.patch ?? {} },
          { idempotencyKey: op.client_operation_id },
        );
        await markApplied(op, op.entity_id);
        return 'applied';
      }

      default: {
        // Everything else travels through the §20 batch-push surface
        // (demo-parity routes today — see the endpoint module header).
        const results = await pushSyncOperations(op.group_id, [toWireOperation(op)]);
        const result = results[0];
        if (!result) throw new NetworkError('[sync] empty push result');
        if (result.status === 'APPLIED') {
          await markApplied(op, result.result_reference ?? null);
          return 'applied';
        }
        if (result.status === 'CONFLICT') {
          await markConflicted(
            op,
            (result.conflict?.conflict_type as SyncConflictType | undefined) ?? 'version_mismatch',
            (result.conflict?.server_payload as Record<string, unknown> | undefined) ?? {},
            result.conflict?.id,
          );
          return 'parked';
        }
        await markRejected(
          op,
          result.error_message ?? 'The server refused this operation.',
        );
        return 'parked';
      }
    }
  } catch (err) {
    if (isTransient(err)) {
      // Ordering rule: halt the cycle — later ops must never jump ahead of
      // an unsent earlier one. The row stays PENDING for the next trigger.
      return 'halt';
    }
    if (err instanceof ApiError && (err.status === 409 || err.code === 'CONFLICT')) {
      await markConflicted(op, 'version_mismatch', serverPayloadOf(err));
      return 'parked';
    }
    if (err instanceof ApiError) {
      // Permanent refusal — e.g. permission revoked while offline
      // (§186A.2 REJECTED). Terminal, visible, dismissible.
      await markRejected(op, err.message);
      return 'parked';
    }
    return 'halt';
  }
}

/**
 * Replay queued operations in order. Safe to call concurrently — the first
 * invocation wins and the rest no-op. Returns the number of operations that
 * reached a terminal outcome this cycle.
 */
export async function replayPendingOperations(): Promise<number> {
  if (replayInFlight) return 0;
  const pending = sortedPending();
  if (pending.length === 0) return 0;

  replayInFlight = true;
  let settled = 0;
  try {
    for (const original of pending) {
      // Re-read each row: earlier outcomes this cycle may have changed it
      // (resolution, dismissal) — replay what is CURRENTLY pending.
      const current = useSyncStore
        .getState()
        .pendingOperations.find(
          (o) =>
            o.client_operation_id === original.client_operation_id &&
            o.status === 'PENDING',
        );
      if (!current) continue;

      const outcome = await replayOne(current);
      if (outcome === 'halt') break;
      if (outcome === 'applied') settled += 1;
    }
  } finally {
    replayInFlight = false;
  }

  // Cycle finished with the queue fully drained → release the §185 banner
  // from "Syncing…" back to calm. Never lies about connectivity: only runs
  // when the browser reports a live network.
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  const store = useSyncStore.getState();
  if (
    online &&
    store.status === 'syncing' &&
    outboxPendingCount() === 0
  ) {
    store.setStatus('connected');
  }
  return settled;
}

// ─── Conflict resolution (§186A.3/§186A.4) ──────────────────────────────────

/**
 * Resolve a sync conflict: record the strategy on the SAME conflict row
 * (server write-back where the backend route exists; honest local-only
 * otherwise, see D25), then apply the strategy's effect on the blocked
 * operation:
 *   client_wins → the operation re-enters the queue UNCHANGED (same
 *                 client_operation_id) and replays; task CAS rows refresh
 *                 expected_version from the server first so "keep mine"
 *                 reapplies cleanly on top of the remote state.
 *   server_wins → my local write is dropped (bubble removed for messages).
 *   merged/manual → resolution is recorded; no automatic re-application.
 */
export async function resolveConflictThroughSync(
  conflictId: string,
  strategy: SyncResolutionStrategy,
  resolvedBy: string,
): Promise<void> {
  const conflict = useSyncStore.getState().conflicts.find((c) => c.id === conflictId);
  if (!conflict) return;

  // Server write-back (§20A sync_conflicts row). In live mode the route may
  // not exist yet (audit H3) — the resolution still records locally and the
  // gap is documented, never papered over with a fake success.
  try {
    await resolveSyncConflict(conflictId, strategy, resolvedBy);
  } catch {
    /* route-missing / transient — the local record below is authoritative
       for this device until the backend surface exists (D25). */
  }

  const store = useSyncStore.getState();
  store.resolveConflict(conflictId, strategy, resolvedBy);

  const opClientId = conflict.sync_operation_id;
  if (!opClientId) return;

  if (strategy === 'client_wins') {
    let op = store.pendingOperations.find((o) => o.client_operation_id === opClientId);
    if (op && op.operation_type === 'task.update') {
      // Refresh the optimistic-concurrency basis from the server's current
      // row so the re-applied write targets the latest version (§21.2).
      try {
        const fresh = await api.get<{ version?: number }>(`/tasks/${op.entity_id}`);
        if (typeof fresh?.version === 'number') {
          op = {
            ...op,
            payload: { ...op.payload, expected_version: fresh.version },
          };
          useSyncStore.getState().setPendingOperations(
            useSyncStore
              .getState()
              .pendingOperations.map((o) =>
                o.client_operation_id === op!.client_operation_id ? op! : o,
              ),
          );
          await persistOp(op);
        }
      } catch {
        /* version stays as captured offline; the replay may re-conflict */
      }
    }
    if (op) {
      useSyncStore.getState().updateOperation(opClientId, { status: 'PENDING' });
      await persistOp({ ...op, status: 'PENDING' });
      // Awaited so callers (and tests) observe the queue fully re-drained.
      await replayPendingOperations();
    }
    return;
  }

  // server_wins / merged / manual — the local write does not auto-reapply.
  if (strategy === 'server_wins' && conflict.entity_type === 'message') {
    useChatStore.getState().deleteMessage(conflict.entity_id);
  }
  const parked = useSyncStore
    .getState()
    .pendingOperations.find((o) => o.client_operation_id === opClientId);
  if (parked) {
    useSyncStore.getState().removeOperation(opClientId);
    await unpersistOp(opClientId);
  }
}

/**
 * Test seam — clears the in-memory mirror and any in-flight replay marker.
 * Production never calls this; durability lives in IndexedDB.
 */
export function resetOutboxForTesting(): void {
  replayInFlight = false;
  persistence = new MemoryOutbox();
}
