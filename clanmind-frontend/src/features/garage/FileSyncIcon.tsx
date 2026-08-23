import React from 'react';
import { Tooltip } from '@/design-system/components/Tooltip';
import { Loader2, Sparkles, AlertTriangle, Circle, ArrowDown, ArrowUp, AlertOctagon, Trash2, RotateCcw, Clock3, Cloud } from 'lucide-react';
import type { FileSyncState, FileIndexState } from '@/types';

/**
 * §189 File Sync States — the authoritative nine-value set; each state is
 * distinct (QUEUED ≠ UPLOADING, REMOTE_CHANGED ≠ SYNCED, LOCAL_CHANGED ≠ Local).
 * Tooltips explain each state in plain language.
 */
const SYNC_CONFIG: Record<
  FileSyncState,
  { label: string; tooltip: string; icon: React.ReactNode; color: string }
> = {
  LOCAL_ONLY: {
    label: 'Local',
    tooltip: 'Exists only on this machine, not yet shared.',
    icon: <Circle className="w-3 h-3" aria-hidden="true" />,
    color: 'var(--color-text-tertiary)',
  },
  QUEUED: {
    label: 'Queued',
    tooltip: 'Share requested, waiting on connectivity.',
    icon: <Clock3 className="w-3 h-3" aria-hidden="true" />,
    color: 'var(--color-warning)',
  },
  UPLOADING: {
    label: 'Uploading',
    tooltip: 'Actively transferring to cloud.',
    icon: <Cloud className="w-3 h-3 animate-pulse" aria-hidden="true" />,
    color: 'var(--color-info)',
  },
  SYNCED: {
    label: 'Synced',
    tooltip: 'Local and cloud copies match.',
    icon: <Cloud className="w-3 h-3" aria-hidden="true" />,
    color: 'var(--color-success)',
  },
  REMOTE_CHANGED: {
    label: 'Update available',
    tooltip: 'Someone updated this file. Click to get the latest version.',
    icon: <ArrowDown className="w-3 h-3" aria-hidden="true" />,
    color: 'var(--color-info)',
  },
  LOCAL_CHANGED: {
    label: 'Local changes',
    tooltip: 'Local version is newer than cloud; not yet uploaded.',
    icon: <ArrowUp className="w-3 h-3" aria-hidden="true" />,
    color: 'var(--color-info)',
  },
  CONFLICT: {
    label: 'Conflict',
    tooltip: 'Both changed; routes to the conflict card.',
    icon: <AlertOctagon className="w-3 h-3" aria-hidden="true" />,
    color: 'var(--color-danger)',
  },
  DELETED: {
    label: 'Deleted',
    tooltip: 'Removed, tombstoned per retention policy.',
    icon: <Trash2 className="w-3 h-3" aria-hidden="true" />,
    color: 'var(--color-text-tertiary)',
  },
  RESTORABLE: {
    label: 'Restorable',
    tooltip: 'Deleted but within the recovery window; restore available.',
    icon: <RotateCcw className="w-3 h-3" aria-hidden="true" />,
    color: 'var(--color-warning)',
  },
};

export function FileSyncIcon({ state }: { state: FileSyncState }) {
  const cfg = SYNC_CONFIG[state];
  return (
    <Tooltip content={cfg.tooltip}>
      <span
        className="inline-flex items-center gap-1 font-mono text-[10px]"
        style={{ color: cfg.color }}
        aria-label={cfg.label}
      >
        {cfg.icon}
        {cfg.label}
      </span>
    </Tooltip>
  );
}

/**
 * §212 — index state is orthogonal to sync state; STALE is visually distinct
 * from INDEXING (usable but AI works from outdated content).
 */
const INDEX_CONFIG: Record<FileIndexState, { label: string; tooltip?: string }> = {
  INDEXING: { label: 'Preparing for Odin…' },
  READY: { label: 'AI Ready' },
  STALE: { label: 'Stale index', tooltip: 'Source changed since indexing; AI context may be outdated.' },
  FAILED: { label: 'Index failed' },
  DELETED: { label: '' },
};

export function FileIndexChip({ state }: { state: FileIndexState }) {
  const cfg = INDEX_CONFIG[state];
  if (!cfg.label) return null;
  const content = (
    <span
      className="inline-flex items-center gap-1 text-[10px]"
      style={{
        color:
          state === 'READY'
            ? 'var(--color-success)'
            : state === 'STALE' || state === 'FAILED'
              ? 'var(--color-warning)'
              : 'var(--color-text-tertiary)',
      }}
      aria-label={cfg.label}
    >
      {state === 'INDEXING' ? (
        <Loader2 className="w-2.5 h-2.5 animate-spin" aria-hidden="true" />
      ) : state === 'READY' ? (
        <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
      ) : state === 'STALE' ? (
        <AlertTriangle className="w-2.5 h-2.5" aria-hidden="true" />
      ) : null}
      {cfg.label}
    </span>
  );
  return cfg.tooltip ? <Tooltip content={cfg.tooltip}>{content}</Tooltip> : content;
}