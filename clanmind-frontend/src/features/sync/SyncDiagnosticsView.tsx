import React, { useState } from 'react';
import { Activity, XCircle } from 'lucide-react';
import { Badge } from '@/design-system/components/Badge';
import { Button } from '@/design-system/components/Button';
import { CLIENT_PROTOCOL_VERSION } from '@/realtime/events';
import { SyncConflictCard } from './SyncConflictCard';
import type {
  SyncCheckpoint,
  SyncOperation,
  SyncConflict,
  SyncStateStatus,
  SyncResolutionStrategy,
  Notification,
} from '@/types';

export interface SyncDiagnosticsViewProps {
  status: SyncStateStatus;
  checkpoint: SyncCheckpoint | null;
  pendingOperations: SyncOperation[];
  conflicts: SyncConflict[];
  /** §285 Protocol version — the REAL negotiated value, never a fixture. */
  protocolVersion?: string;
  /** §171A — recent §95A rows; delivery_state renders VERBATIM. */
  notifications?: Notification[];
  onResolveConflict: (conflictId: string, strategy: SyncResolutionStrategy) => void;
  /** §186A.2 — dismiss a REJECTED row's error once acknowledged. */
  onDismissOperation?: (clientOperationId: string) => void;
}

/** Relative "x ago" for the §285 Last sync metric; null-safe. */
function lastSyncLabel(iso?: string): string {
  if (!iso) return 'Never';
  const deltaMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return 'Just now';
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/**
 * §285 — advanced settings diagnostics: connection, protocol version, last
 * sequence, last sync, pending operations and conflicts. Everything shown is
 * derived from real client state (§186A mirrors of the §20A tables).
 */
export function SyncDiagnosticsView({
  status,
  checkpoint,
  pendingOperations,
  conflicts,
  protocolVersion = String(CLIENT_PROTOCOL_VERSION),
  notifications = [],
  onResolveConflict,
  onDismissOperation,
}: SyncDiagnosticsViewProps) {
  const [, setRefreshTick] = useState(0);
  // Keep the relative Last sync label honest without a timer per second.
  React.useEffect(() => {
    const t = setInterval(() => setRefreshTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const rejectedOps = pendingOperations.filter((o) => o.status === 'REJECTED');
  const activeOps = pendingOperations.filter((o) => o.status !== 'REJECTED');

  const metricCard = (label: string, value: React.ReactNode) => (
    <div
      className="p-3.5 rounded-xl border"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
    >
      <span className="text-[10px] uppercase font-bold block mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
        {label}
      </span>
      {value}
    </div>
  );

  return (
    <div className="space-y-6 text-xs" style={{ color: 'var(--color-text)' }}>
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Activity className="w-5 h-5" style={{ color: 'var(--color-info)' }} aria-hidden="true" />
          <span>Sync &amp; Network Diagnostics</span>
        </h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Realtime telemetry of connection state, offline queue states, and sequence checkpoints.
        </p>
      </div>

      {/* §285 — Connection / Protocol version / Last sequence / Pending+Conflicts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="group" aria-label="Connection metrics">
        {metricCard(
          'Connection',
          <p className="font-semibold capitalize flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: status === 'connected' ? 'var(--color-success)' : 'var(--color-warning)' }}
              aria-hidden="true"
            />
            {status}
          </p>
        )}
        {metricCard(
          'Protocol Version',
          <p className="font-semibold font-mono">v{protocolVersion}</p>
        )}
        {metricCard('Last Sequence', <p className="font-semibold font-mono">#{checkpoint?.last_server_sequence || 0}</p>)}
        {metricCard('Last Sync', <p className="font-semibold">{lastSyncLabel(checkpoint?.last_synced_at)}</p>)}
      </div>

      {/* §186A.2 pending queue — every non-dismissed row, any status */}
      <div
        className="p-4 rounded-xl border space-y-3"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
      >
        <h3 className="font-bold flex items-center justify-between">
          <span>Pending Local Operations Queue</span>
          <Badge variant={rejectedOps.length > 0 ? 'danger' : 'neutral'} size="sm">
            {activeOps.length} Queued · {conflicts.length} Conflicts
          </Badge>
        </h3>
        {pendingOperations.length === 0 ? (
          <p className="italic py-2" style={{ color: 'var(--color-text-tertiary)' }}>
            No pending offline operations.
          </p>
        ) : (
          <div className="space-y-1.5 font-mono text-[11px]">
            {pendingOperations.map((op) => (
              <div key={op.id}>
                <div
                  className="flex items-center justify-between p-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                >
                  <span style={{ color: 'var(--color-text)' }}>
                    {op.operation_type} ({op.entity_id})
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge
                      variant={
                        op.status === 'PENDING'
                          ? 'warning'
                          : op.status === 'CONFLICT'
                            ? 'danger'
                            : op.status === 'REJECTED'
                              ? 'danger'
                              : 'success'
                      }
                      size="sm"
                    >
                      {op.status}
                    </Badge>
                    {op.status === 'REJECTED' && onDismissOperation && (
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<XCircle className="w-3 h-3" />}
                        aria-label={`Dismiss rejected ${op.operation_type} ${op.entity_id}`}
                        onClick={() => onDismissOperation(op.client_operation_id)}
                      >
                        Dismiss
                      </Button>
                    )}
                  </span>
                </div>
                {op.status === 'REJECTED' && op.error_message && (
                  <p
                    className="mt-1 px-2 py-1 rounded text-[10px] font-sans"
                    style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}
                  >
                    {op.error_message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* §285 conflicts */}
      <div className="space-y-3">
        <h3 className="font-bold">Conflicts</h3>
        {conflicts.length === 0 ? (
          <p className="italic" style={{ color: 'var(--color-text-tertiary)' }}>
            No unresolved conflicts.
          </p>
        ) : (
          conflicts.map((c) => (
            <SyncConflictCard key={c.id} conflict={c} onResolve={onResolveConflict} />
          ))
        )}
      </div>

      {/* §171A — delivery_state exposed VERBATIM: SUPPRESSED_BY_PREFERENCE
          ("check your settings") vs FAILED ("this is a bug") is a distinction
          only the backend knows; never re-derived client-side. */}
      {notifications.length > 0 && (
        <div
          className="p-4 rounded-xl border space-y-3"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
        >
          <h3 className="font-bold flex items-center justify-between">
            <span>Notification Delivery States</span>
            <Badge variant="neutral" size="sm">
              verbatim · §95A
            </Badge>
          </h3>
          <div className="space-y-1.5 font-mono text-[11px]" data-testid="delivery-state-list">
            {notifications.slice(0, 12).map((n) => (
              <div
                key={n.id}
                className="flex items-center justify-between gap-3 p-2 rounded-lg border"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <span className="truncate" style={{ color: 'var(--color-text)' }}>
                  [{n.category}] {n.title}
                </span>
                <span
                  className="shrink-0 font-bold"
                  style={{
                    color:
                      n.delivery_state === 'FAILED'
                        ? 'var(--color-danger)'
                        : n.delivery_state === 'SUPPRESSED_BY_PREFERENCE'
                          ? 'var(--color-warning)'
                          : 'var(--color-success)',
                  }}
                >
                  {n.delivery_state}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
