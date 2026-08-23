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
