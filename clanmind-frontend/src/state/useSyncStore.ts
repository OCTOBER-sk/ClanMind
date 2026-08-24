import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  SyncCheckpoint,
  SyncOperation,
  SyncConflict,
  SyncResolutionStrategy,
} from '@/types';

export type SyncStateStatus = 'connected' | 'reconnecting' | 'offline' | 'syncing';

export interface SyncState {
  status: SyncStateStatus;
  /**
   * §186A.1 — "Syncing N changes…" derives from the count of local
   * sync_operations rows still in PENDING status, never from the total
   * queue length (REJECTED/CONFLICT rows are parked, not in flight).
   */
  pendingOperationsCount: number;
  /** Every non-dismissed queued operation, any §186A.2 status. */
  pendingOperations: SyncOperation[];
  conflicts: SyncConflict[];
  activeConflict: SyncConflict | null;
  checkpoint: SyncCheckpoint | null;
  protocolMismatch: {
    isOutdated: boolean;
    isRequired: boolean; // CLIENT_UPDATE_REQUIRED
    recommendedVersion?: string;
    minimumVersion?: string;
  } | null;
  /** §309A.1 — recommended-but-not-required update (non-blocking, once per session) */
  recommendedUpdate: { available: boolean; version?: string; dismissed: boolean };

  setStatus: (status: SyncStateStatus) => void;
  setPendingOperations: (ops: SyncOperation[]) => void;
  /** Idempotent by client_operation_id — re-enqueueing a retry is a no-op. */
  addOperation: (op: SyncOperation) => void;
  removeOperation: (clientOperationId: string) => void;
  updateOperation: (
    clientOperationId: string,
    patch: Partial<Pick<SyncOperation, 'status' | 'error_message' | 'result_reference'>>,
  ) => void;
  /** §186A.2 — REJECTED rows stay visible until dismissed, never silently dropped. */
  dismissOperation: (clientOperationId: string) => void;
  setConflicts: (conflicts: SyncConflict[]) => void;
  upsertConflict: (conflict: SyncConflict) => void;
  setActiveConflict: (conflict: SyncConflict | null) => void;
  resolveConflict: (
    conflictId: string,
    strategy: SyncResolutionStrategy,
    resolvedBy: string,
  ) => void;
  setCheckpoint: (checkpoint: SyncCheckpoint) => void;
  setProtocolMismatch: (mismatch: SyncState['protocolMismatch']) => void;
  setRecommendedUpdate: (update: { available: boolean; version?: string }) => void;
  dismissRecommendedUpdate: () => void;
}

/** §186A.1 — only PENDING rows count as changes still syncing. */
function countPending(ops: SyncOperation[]): number {
  return ops.filter((o) => o.status === 'PENDING').length;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      status: 'connected',
      pendingOperationsCount: 0,
      pendingOperations: [],
      conflicts: [],
      activeConflict: null,
      // §186A.1 — per-device checkpoint is created on first real sync
      // (BE §20A); demo hydration seeds one under VITE_DEMO_MODE.
      checkpoint: null,
      protocolMismatch: null,
      recommendedUpdate: { available: false, dismissed: false },

      setStatus: (status) => set({ status }),
      setPendingOperations: (pendingOperations) =>
        set({
          pendingOperations,
          pendingOperationsCount: countPending(pendingOperations),
        }),
      addOperation: (op) =>
        set((state) => {
          if (
            state.pendingOperations.some(
              (o) => o.client_operation_id === op.client_operation_id,
            )
          ) {
            return state;
          }
          const nextOps = [...state.pendingOperations, op];
          return {
            pendingOperations: nextOps,
            pendingOperationsCount: countPending(nextOps),
          };
        }),
      removeOperation: (clientOperationId) =>
        set((state) => {
          const nextOps = state.pendingOperations.filter(
            (o) => o.client_operation_id !== clientOperationId,
          );
          return {
            pendingOperations: nextOps,
            pendingOperationsCount: countPending(nextOps),
          };
        }),
      updateOperation: (clientOperationId, patch) =>
        set((state) => {
          const nextOps = state.pendingOperations.map((o) =>
            o.client_operation_id === clientOperationId ? { ...o, ...patch } : o,
          );
          return {
            pendingOperations: nextOps,
            pendingOperationsCount: countPending(nextOps),
          };
        }),
      dismissOperation: (clientOperationId) =>
        set((state) => {
          const nextOps = state.pendingOperations.filter(
            (o) => o.client_operation_id !== clientOperationId,
          );
          return {
            pendingOperations: nextOps,
            pendingOperationsCount: countPending(nextOps),
          };
        }),
      setConflicts: (conflicts) => set({ conflicts }),
      upsertConflict: (conflict) =>
        set((state) => {
          const existing = state.conflicts.find((c) => c.id === conflict.id);
          const conflicts = existing
            ? state.conflicts.map((c) => (c.id === conflict.id ? { ...c, ...conflict } : c))
            : [...state.conflicts, conflict];
          return { conflicts };
        }),
      setActiveConflict: (activeConflict) => set({ activeConflict }),
      // §186A.4: resolution writes back through the same conflict row
      // (resolution_strategy / resolved_by / resolved_at), not a new operation.
      resolveConflict: (conflictId, strategy, resolvedBy) =>
        set((state) => {
          const updated = state.conflicts.map((c) =>
            c.id === conflictId
              ? {
                  ...c,
                  resolution_strategy: strategy,
                  resolved_by: resolvedBy,
                  resolved_at: new Date().toISOString(),
                }
              : c
          );
          return {
            conflicts: updated,
            activeConflict:
              state.activeConflict?.id === conflictId ? null : state.activeConflict,
          };
        }),
      setCheckpoint: (checkpoint) => set({ checkpoint }),
      setProtocolMismatch: (protocolMismatch) => set({ protocolMismatch }),
      setRecommendedUpdate: (recommendedUpdate) =>
        set((state) => ({
          recommendedUpdate: { ...state.recommendedUpdate, ...recommendedUpdate },
        })),
      dismissRecommendedUpdate: () =>
        set((state) => ({ recommendedUpdate: { ...state.recommendedUpdate, dismissed: true } })),
    }),
    {
      name: 'cm_sync',
      // §186A.1: per-device checkpoint is local persistent state
      partialize: (state) => ({ checkpoint: state.checkpoint }),
    },
  ),
);
