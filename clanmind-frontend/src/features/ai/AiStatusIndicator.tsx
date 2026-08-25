/**
 * AiStatusIndicator — §130-132
 *
 * Shows the AI's current operational status with a concise activity label.
 * Seven states: Available, Working, Researching, Building, Waiting for approval,
 * Limited (quota), Offline.
 *
 * Uses the spectral gradient ONLY for Odin-active states, per §3.2.
 * Fully supports prefers-reduced-motion via CSS (§6).
 */
import React, { memo } from 'react';
import {
  WifiOff,
  Loader2,
  Globe,
  Hammer,
  ShieldAlert,
  AlertTriangle,
  Circle,
} from 'lucide-react';
import { cn } from '@/design-system/utils';
import type { AiRunStatus } from '@/types';

// ─── Public types ───────────────────────────────────────────────────────────

export type AiStatusKind =
  | 'available'
  | 'working'
  | 'researching'
  | 'building'
  | 'waiting_approval'
  | 'limited'
  | 'offline';

export interface AiStatusIndicatorProps {
  /** Current AI status — derived from AiRunStatus or explicit override */
  status: AiStatusKind;
  /** Human-readable activity label shown next to the indicator (§132) */
  activityLabel?: string;
  /** The AI name shown as prefix (default "Odin") */
  aiName?: string;
  /** Compact variant — just the pulsing dot, no text */
  compact?: boolean;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map AiRunStatus → AiStatusKind for callers that only have a run status.
 *
 * §134A canonical mapping — do NOT invent intermediate UI-only states:
 *   QUEUED        → working   ("Odin is starting…")
 *   RUNNING       → working   ("Odin is working…" — pre-tool planning)
 *   WAITING_TOOL  → working   (tool activity visible via AiToolTimeline;
 *                              this is NOT waiting for human approval —
 *                              tool-call-level APPROVED gating handles that)
 *   STREAMING     → working   (incremental Markdown rendering)
 *   COMPLETED     → available
 *   FAILED        → offline   (error card handles recovery UI)
 *   CANCELLED     → available (AiStoppedStrip handles partial-content state)
 */
export function aiRunStatusToKind(runStatus: AiRunStatus | null): AiStatusKind {
  if (!runStatus) return 'available';
  switch (runStatus) {
    case 'QUEUED':
    case 'RUNNING':
    case 'WAITING_TOOL':
    case 'STREAMING':
      return 'working';
    case 'COMPLETED':
    case 'CANCELLED':
      return 'available';
    case 'FAILED':
      return 'offline';
    default:
      return 'available';
  }
}

// ─── Internal config ─────────────────────────────────────────────────────────

interface StatusConfig {
  label: string;
  colorVar: string;
  spectral: boolean;
  spin: boolean;
  Icon: React.ComponentType<{ className?: string }>;
}

const STATUS_CONFIG: Record<AiStatusKind, StatusConfig> = {
  available: {
    label: 'Available',
    colorVar: 'var(--color-success)',
    spectral: false,
    spin: false,
    Icon: Circle,
  },
  working: {
    label: 'Working\u2026',
    colorVar: 'var(--color-warning)',
    spectral: true,
    spin: true,
    Icon: Loader2,
  },
  researching: {
    label: 'Researching\u2026',
    colorVar: 'var(--color-info)',
    spectral: true,
    spin: false,
    Icon: Globe,
  },
  building: {
    label: 'Building\u2026',
    colorVar: 'var(--color-warning)',
    spectral: true,
    spin: false,
    Icon: Hammer,
  },
  waiting_approval: {
    label: 'Waiting for approval',
    colorVar: 'var(--color-warning)',
    spectral: false,
    spin: false,
    Icon: ShieldAlert,
  },
  limited: {
    label: 'Limited',
    colorVar: 'var(--color-warning)',
    spectral: false,
    spin: false,
    Icon: AlertTriangle,
  },
  offline: {
    label: 'Offline',
    colorVar: 'var(--color-text-tertiary)',
    spectral: false,
    spin: false,
    Icon: WifiOff,
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export const AiStatusIndicator = memo(function AiStatusIndicator({
  status,
  activityLabel,
  aiName = 'Odin',
  compact = false,
  className,
}: AiStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const { Icon, colorVar, spectral, spin } = config;
  const displayLabel = activityLabel ?? config.label;
  const isActive = status === 'working' || status === 'researching' || status === 'building';

  // Compact dot-only variant
  if (compact) {
    return (
      <span
        role="status"
        aria-label={`${aiName} \u00b7 ${displayLabel}`}
        title={`${aiName} \u00b7 ${displayLabel}`}
        className={cn('inline-flex items-center justify-center', className)}
      >
        <span
          aria-hidden="true"
          className={cn(
            'w-2 h-2 rounded-full inline-block',
            // spectral-active uses CSS animation that gets disabled by prefers-reduced-motion
            spectral ? 'odin-working' : '',
            !spectral && status === 'available' ? 'animate-pulse' : '',
          )}
          style={
            !spectral
              ? { backgroundColor: colorVar }
              : { background: 'var(--spectral-gradient)', backgroundSize: '200% 200%' }
          }
        />
      </span>
    );
  }

  return (
    <div
      role="status"
      aria-label={`${aiName} \u00b7 ${displayLabel}`}
      className={cn('inline-flex items-center gap-1.5 select-none', className)}
    >
      {/* Status icon — spectral for active states */}
      <span className="inline-flex shrink-0" style={{ color: spectral ? undefined : colorVar }}>
        {spectral ? (
          <span
            className="inline-flex"
            style={{
              background: 'var(--spectral-gradient)',
              backgroundSize: '200% 200%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            <Icon className={cn('w-3.5 h-3.5', spin && 'animate-spin')} />
          </span>
        ) : (
          <Icon className="w-3.5 h-3.5" />
        )}
      </span>

      {/* Labels: "Odin · Working…" */}
      <span
        className="text-[11px] font-medium leading-none"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <span style={{ color: 'var(--color-text-tertiary)' }}>{aiName}</span>
        <span aria-hidden="true"> \u00b7 </span>
        {/* spectral-text animation is suppressed by prefers-reduced-motion CSS */}
        <span className={isActive ? 'spectral-text' : undefined} style={!isActive ? { color: colorVar } : undefined}>
          {displayLabel}
        </span>
      </span>

      {/* Available: subtle living dot */}
      {status === 'available' && (
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
          style={{ backgroundColor: 'var(--color-success)' }}
        />
      )}
    </div>
  );
});
