import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, WifiOff, Check } from 'lucide-react';
import { useSyncStore } from '@/state/useSyncStore';

/**
 * §185 Sync Banner — standalone strip beneath the TopBar.
 *
 * Connected  → invisible (the calm default)
 * Reconnecting → "Reconnecting…"
 * Offline     → "Offline"
 * Syncing     → "Syncing N changes…" — N derived from real pending
 *               operation count (§186A.1), never a guess
 * Done        → brief "✓ Synced", then invisible
 */
export function SyncBanner() {
  const status = useSyncStore((s) => s.status);
  const pendingCount = useSyncStore((s) => s.pendingOperationsCount);
  const [justSynced, setJustSynced] = useState(false);
  const prevStatusRef = useRef(status);

  // Brief "✓ Synced" confirmation when a sync cycle completes
  useEffect(() => {
    if (prevStatusRef.current === 'syncing' && status === 'connected') {
      setJustSynced(true);
      const t = setTimeout(() => setJustSynced(false), 2000);
      prevStatusRef.current = status;
      return () => clearTimeout(t);
    }
    prevStatusRef.current = status;
  }, [status]);

  if (status === 'connected' && !justSynced) return null;

  const base =
    'h-7 px-3 text-[11px] font-medium flex items-center gap-1.5 border-b select-none';

  if (status === 'reconnecting') {
    return (
      <div
        role="status"
        className={`${base} border-[var(--color-border)]`}
        style={{ color: 'var(--color-warning)', background: 'var(--color-warning-bg)' }}
      >
        <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
        Reconnecting…
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div
        role="status"
        className={`${base} border-[var(--color-border)]`}
        style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface)' }}
      >
        <WifiOff className="w-3 h-3" aria-hidden="true" />
        Offline
      </div>
    );
  }

  if (status === 'syncing') {
    return (
      <div
        role="status"
        className={`${base} border-[var(--color-border)]`}
        style={{ color: 'var(--color-info)', background: 'var(--color-info-bg)' }}
      >
        <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
        Syncing {pendingCount} change{pendingCount === 1 ? '' : 's'}…
      </div>
    );
  }

  return (
    <div
      role="status"
      className={`${base} border-[var(--color-border)]`}
      style={{ color: 'var(--color-success)', background: 'var(--color-success-bg)' }}
    >
      <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
      Synced
    </div>
  );
}