import React from 'react';
import { Activity } from 'lucide-react';
import { Badge } from '@/design-system/components/Badge';
import { SyncConflictCard } from './SyncConflictCard';
import type { SyncCheckpoint, SyncOperation, SyncConflict, SyncStateStatus, SyncResolutionStrategy, Notification } from '@/types';

export interface SyncDiagnosticsViewProps {
  status: SyncStateStatus;
  checkpoint: SyncCheckpoint | null;
  pendingOperations: SyncOperation[];
  conflicts: SyncConflict[];
  protocolVersion?: string;
  /** §171A — recent §95A rows; delivery_state renders VERBATIM. */
  notifications?: Notification[];
  onResolveConflict: (conflictId: string, strategy: SyncResolutionStrategy) => void;
}

/** §285 — advanced settings diagnostics: connection, protocol, sequence, queue, conflicts */
export function SyncDiagnosticsView({
  status,
  checkpoint,
  pendingOperations,
  conflicts,
  protocolVersion = '2.4.0',
  notifications = [],
  onResolveConflict,
}: SyncDiagnosticsViewProps) {
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metricCard(
          'Connection State',
          <p className="font-semibold capitalize flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: status === 'connected' ? 'var(--color-success)' : 'var(--color-warning)' }}
            />
            {status}
          </p>
        )}
        {metricCard(
          'Protocol Version',
          <p className="font-semibold font-mono">v{protocolVersion}</p>
        )}
        {metricCard('Last Sequence', <p className="font-semibold font-mono">#{checkpoint?.last_server_sequence || 0}</p>)}
        {metricCard('Pending Ops / Conflicts', <p className="font-semibold">{pendingOperations.length} ops · {conflicts.length} conflicts</p>)}
      </div>

      {/* §186A.2 pending queue */}
      <div
        className="p-4 rounded-xl border space-y-3"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
      >
        <h3 className="font-bold flex items-center justify-between">
          <span>Pending Local Operations Queue</span>
          <Badge variant="neutral" size="sm">
            {pendingOperations.length} Queued
          </Badge>
        </h3>
        {pendingOperations.length === 0 ? (
          <p className="italic py-2" style={{ color: 'var(--color-text-tertiary)' }}>
            No pending offline operations.
          </p>
        ) : (
          <div className="space-y-1.5 font-mono text-[11px]">
            {pendingOperations.map((op) => (
              <div
                key={op.id}
                className="flex items-center justify-between p-2 rounded-lg border"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <span style={{ color: 'var(--color-text)' }}>
                  {op.action} {op.entity_type} (#{op.entity_id})
                </span>
                <Badge variant={op.status === 'PENDING' ? 'warning' : 'success'} size="sm">
                  {op.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* §285 conflicts (previously not rendered) */}
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