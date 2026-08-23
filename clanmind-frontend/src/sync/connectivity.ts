/**
 * Connectivity → SyncBanner truth (FE §185).
 *
 * The banner states are derived from REAL signals only:
 *   offline      — navigator reports no network
 *   reconnecting — socket connecting/backoff, or network restored but not ready
 *   connected    — realtime handshake complete and idle
 *   syncing      — connected with queued operations still replaying
 */

import { useSyncStore, type SyncStateStatus } from '@/state/useSyncStore';
import type { RealtimeClient, RealtimeStatus } from '@/realtime/connection';

let detach: (() => void) | null = null;

function apply(next: SyncStateStatus): void {
  const store = useSyncStore.getState();
  if (store.status !== next) store.setStatus(next);
}

function recompute(realtimeStatus: RealtimeStatus): void {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  if (!online) return apply('offline');

  switch (realtimeStatus) {
    case 'connected': {
      const pending = useSyncStore.getState().pendingOperationsCount > 0;
      apply(pending ? 'syncing' : 'connected');
      break;
    }
    case 'idle':
    case 'connecting':
    case 'reconnecting':
      apply('reconnecting');
      break;
    case 'offline':
      apply('offline');
      break;
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
