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
  pendingOperationsCount: number;
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
  addOperation: (op: SyncOperation) => void;
  removeOperation: (clientOperationId: string) => void;
  setConflicts: (conflicts: SyncConflict[]) => void;
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
          pendingOperationsCount: pendingOperations.length,
        }),
      addOperation: (op) =>
        set((state) => ({
          pendingOperations: [...state.pendingOperations, op],
          pendingOperationsCount: state.pendingOperations.length + 1,
        })),
      removeOperation: (clientOperationId) =>
        set((state) => {
          const nextOps = state.pendingOperations.filter(
            (o) => o.client_operation_id !== clientOperationId
          );
          return {
            pendingOperations: nextOps,
            pendingOperationsCount: nextOps.length,
          };
        }),
      setConflicts: (conflicts) => set({ conflicts }),
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