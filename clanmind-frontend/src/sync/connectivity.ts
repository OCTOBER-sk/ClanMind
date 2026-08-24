/**
 * Connectivity → SyncBanner truth (FE §185).
 *
 * The banner states are derived from REAL signals only:
 *   offline      — navigator reports no network
 *   reconnecting — socket connecting/backoff, or network restored but not ready
 *   connected    — realtime handshake complete and idle
 *   syncing      — connected with queued operations still replaying
 *
 * The offline→connected transition additionally kicks the outbox replay
 * (§183 "when connection returns: reconcile" / §186A.2) via src/sync/outbox.
 */

import { useSyncStore, type SyncStateStatus } from '@/state/useSyncStore';
import type { RealtimeClient, RealtimeStatus } from '@/realtime/connection';
import { outboxPendingCount, replayPendingOperations } from '@/sync/outbox';

/** Pure §185 truth table — trivially testable, no DOM or sockets involved. */
export function deriveSyncStatus(
  online: boolean,
  realtimeStatus: RealtimeStatus,
  pendingCount: number,
): SyncStateStatus {
  if (!online) return 'offline';
  switch (realtimeStatus) {
    case 'connected':
      return pendingCount > 0 ? 'syncing' : 'connected';
    case 'idle':
    case 'connecting':
    case 'reconnecting':
      return 'reconnecting';
    case 'offline':
      return 'offline';
  }
}

let detach: (() => void) | null = null;

function apply(next: SyncStateStatus): boolean {
  const store = useSyncStore.getState();
  const changed = store.status !== next;
  if (changed) store.setStatus(next);
  return changed;
}

function recompute(realtimeStatus: RealtimeStatus): void {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  const next = deriveSyncStatus(online, realtimeStatus, Math.max(
    useSyncStore.getState().pendingOperationsCount,
    outboxPendingCount(),
  ));
  const changed = apply(next);

  // §183/§186A.2 — the moment we are back online AND the socket is usable,
  // drain whatever queued while offline. Only a genuine transition into
  // 'connected' triggers this; steady-state connected does not re-replay.
  if (changed && next === 'connected') {
    void replayPendingOperations();
  }
}

/** Wire realtime status + browser connectivity into the sync store. */
export function initConnectivity(realtime: RealtimeClient): void {
  // Idempotent by design: StrictMode double-invokes effects and the async
  // module import in App.tsx can resolve out of order with cleanup.
  shutdownConnectivity();

  recompute(realtime.status);

  const unsubscribe = realtime.onStatusChange((status) => {
    // When a queued op is confirmed while connected, flip syncing → connected.
    recompute(status);
  });

  const onOnline = () => recompute(realtime.status);
  const onOffline = () => apply('offline');
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  detach = () => {
    unsubscribe();
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

export function shutdownConnectivity(): void {
  detach?.();
  detach = null;
}

/**
 * FE §309A.2 — the server refused our protocol/version (CLIENT_UPDATE_REQUIRED).
 * RealtimeClient has already hard-stopped; surface the blocking update state
 * instead of a lying "Reconnecting…" banner. Wired as onProtocolRequired at
 * boot (demo hub today, live socket from P1 onward — same contract).
 */
export function markProtocolUpdateRequired(info: {
  code: string;
  message?: string;
  recommendedVersion?: string;
  minimumVersion?: string;
}): void {
  useSyncStore.getState().setProtocolMismatch({
    isOutdated: true,
    isRequired: info.code === 'CLIENT_UPDATE_REQUIRED',
    recommendedVersion: info.recommendedVersion,
    minimumVersion: info.minimumVersion,
  });
}
