/**
 * §218/§65 — Global live-region announcer for sync, conflict, and status
 * changes that screen readers must hear but that are NOT tied to a specific
 * UI component's own live region.
 *
 * Pattern: one hidden <span role="status" aria-live="polite"> element; the
 * text is swapped only on meaningful transitions (connected→offline,
 * offline→syncing, conflict resolved, etc.). Per-token streaming content
 * and AI streaming tokens are never announced here — those are handled by
 * AiStreamAnnouncer (§218) and the composer's own live region.
 */

import { useEffect, useRef, useState } from 'react';
import { useSyncStore, type SyncStateStatus } from '@/state/useSyncStore';

/** Human-readable label for each sync status transition. */
function statusLabel(status: SyncStateStatus, pendingCount: number): string {
  switch (status) {
    case 'offline':
      return 'Offline — changes will be saved locally';
    case 'reconnecting':
      return 'Reconnecting to the server';
    case 'syncing':
      return `Syncing ${pendingCount} change${pendingCount === 1 ? '' : 's'}`;
    case 'connected':
      return 'Connected — all changes synced';
  }
}

export function LiveAnnouncer() {
  const status = useSyncStore((s) => s.status);
  const pendingCount = useSyncStore((s) => s.pendingOperationsCount);
  const [announcement, setAnnouncement] = useState('');
  const prevStatusRef = useRef(status);
  const prevPendingRef = useRef(pendingCount);

  useEffect(() => {
    // Only announce on meaningful status transitions — not every render.
    const statusChanged = prevStatusRef.current !== status;
    const pendingChanged = prevPendingRef.current !== pendingCount && status === 'syncing';

    if (statusChanged || pendingChanged) {
      setAnnouncement(statusLabel(status, pendingCount));
    }

    prevStatusRef.current = status;
    prevPendingRef.current = pendingCount;
  }, [status, pendingCount]);

  return (
    <span
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {announcement}
    </span>
  );
}
