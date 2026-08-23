import React, { useState } from 'react';
import {
  ShieldAlert,
  Check,
  X,
  Clock,
  GitPullRequest,
  Trash2,
  Users,
  RotateCcw,
  BookOpen,
  Loader2,
  AlertCircle,
  FilePlus2,
  FileMinus2,
  FileEdit,
} from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import type { AiAction } from '@/types';

/**
 * §164A Generalized Approval UX — one ApprovalCard driven by the generic
 * ai_actions shape: action_kind, risk_level, payload (with hash/version).
 * GitHub is one specialization, not a parallel implementation.
 */

export interface ApprovalCardProps {
  action: AiAction;
  /** §164A.2 — submit exact payload_hash + payload_version, never a boolean */
  onApprove: (actionId: string, payloadHash: string, payloadVersion: number) => void;
  onReject: (actionId: string) => void;
  onReviewLatest?: (actionId: string) => void;
  onViewDiff?: () => void;
}

// ─── §164A.1 human-readable action labels ───
const ACTION_LABELS: Record<string, string> = {
  MODIFY_GITHUB_FILES: 'Odin wants to change GitHub',
  CREATE_GITHUB_BRANCH: 'Odin wants to create a branch',
  OPEN_GITHUB_PR: 'Odin wants to open a pull request',
  MERGE_GITHUB_PR: 'Odin wants to merge a pull request',
  BULK_DELETE_ARTIFACTS: 'Odin wants to delete artifacts',
  REASSIGN_TASKS: 'Odin wants to reassign tasks',
  MEMORY_PURGE: 'Odin wants to archive memory entries',
};

function actionLabel(action_kind: string): string {
  return (
    ACTION_LABELS[action_kind] ??
    action_kind.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
  );
}

// ─── §164A.5 payload summary renderers — driven by action.payload, never mock ───
function PayloadSummary({ action }: { action: AiAction }) {
  const p = action.payload as Record<string, unknown>;
  const kind = action.action_kind;

  if (kind.includes('GITHUB')) {
    const files = (p.files as Array<{ path: string; change: string; additions?: number; deletions?: number }>) ?? [];
    return (
      <div className="font-mono text-[11px] space-y-1">
        {typeof p.branch === 'string' && (
          <div className="font-sans font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Branch: <span className="font-mono" style={{ color: 'var(--color-info)' }}>{p.branch}</span>
          </div>
        )}
        {files.map((f, i) => {
          const Icon = f.change === 'A' ? FilePlus2 : f.change === 'D' ? FileMinus2 : FileEdit;
          return (
            <div key={i} className="flex items-center gap-1.5">
              <Icon className="w-3 h-3" style={{ color: f.change === 'D' ? 'var(--color-danger)' : 'var(--color-success)' }} aria-hidden="true" />
              <span className="truncate" style={{ color: 'var(--color-text)' }}>{f.path}</span>
            </div>
          );
        })}
        {files.length === 0 && (
          <pre className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
            {JSON.stringify(action.payload, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (kind.includes('DELETE') || kind.includes('PURGE')) {
    const items = (p.items as string[]) ?? [];
    return (
      <div className="space-y-1" style={{ color: 'var(--color-text)' }}>
        {typeof p.reason === 'string' && (
          <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
            Reason: {p.reason}
          </p>
        )}
        {items.map((it, i) => (
          <p key={i}>• {it}</p>
        ))}
        {items.length === 0 && (
          <p>{String(p.count ?? 0)} items</p>
        )}
      </div>
    );
  }

  if (kind.includes('REASSIGN')) {
    return (
      <div className="space-y-1" style={{ color: 'var(--color-text)' }}>
        <p>
          From: <span className="font-semibold">{String(p.from_name ?? '—')}</span>
        </p>
        <p>
          To: <span className="font-semibold">{String(p.to_name ?? '—')}</span>
        </p>
        {typeof p.count === 'number' && (
          <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
            {p.count} tasks affected
          </p>
        )}
      </div>
    );
  }

  return (
    <pre className="font-mono text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
      {JSON.stringify(action.payload, null, 2)}
    </pre>
  );
}

function ActionIcon({ kind }: { kind: string }) {
  if (kind.includes('GITHUB')) return <GitPullRequest className="w-4 h-4" style={{ color: 'var(--color-info)' }} aria-hidden="true" />;
  if (kind.includes('DELETE')) return <Trash2 className="w-4 h-4" style={{ color: 'var(--color-danger)' }} aria-hidden="true" />;
  if (kind.includes('REASSIGN')) return <Users className="w-4 h-4" style={{ color: 'var(--color-info)' }} aria-hidden="true" />;
  if (kind.includes('MEMORY')) return <BookOpen className="w-4 h-4" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />;
  return <ShieldAlert className="w-4 h-4" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />;
}

function riskBadge(action: AiAction) {
  if (action.risk_level === 'CRITICAL' || action.risk_level === 'HIGH') return 'danger' as const;
  if (action.risk_level === 'MEDIUM') return 'warning' as const;
  return 'neutral' as const;
}

export function ApprovalCard({
  action,
  onApprove,
  onReject,
  onReviewLatest,
  onViewDiff,
}: ApprovalCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // §164A.2 — never send `approved: true`; submit exact hash + version
  const handleApprove = () => {
    setIsApproving(true);
    onApprove(action.id, action.payload_hash, action.payload_version);
  };

  const handleReject = () => {
    setIsRejecting(true);
    onReject(action.id);
  };

  // ─── §164A.4 EXPIRED: payload changed since the card was rendered ───
  if (action.status === 'EXPIRED') {
    return (
      <div
        className="p-4 rounded-xl border text-xs space-y-3"
        style={{ borderColor: 'var(--color-warning)', background: 'var(--color-warning-bg)' }}
      >
        <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--color-warning)' }}>
          <Clock className="w-4 h-4" aria-hidden="true" />
          <span>This action changed since you last saw it.</span>
        </div>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Review the latest version before approving.
        </p>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          onClick={() => onReviewLatest?.(action.id)}
        >
          Review latest
        </Button>
      </div>
    );
  }

  // ─── §164A.3 APPROVED (brief) / SUCCEEDED (collapsed result) ───
  if (action.status === 'APPROVED') {
    return (
      <div
        className="p-3.5 rounded-xl border text-xs flex items-center justify-between"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-info-bg)' }}
      >
        <span className="font-semibold" style={{ color: 'var(--color-info)' }}>
          Approved — starting…
        </span>
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (action.status === 'SUCCEEDED') {
    return (
      <div
        className="p-3.5 rounded-xl border text-xs flex items-center justify-between"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-success-bg)' }}
      >
        <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--color-success)' }}>
          <Check className="w-4 h-4" aria-hidden="true" />
          <span>Completed</span>
        </div>
        <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
          hash: {action.payload_hash.slice(0, 8)}…
        </span>
      </div>
    );
  }

  // ─── §164A.3 REJECTED — collapsed, no further action ───
  if (action.status === 'REJECTED') {
    return (
      <div
        className="p-3.5 rounded-xl border text-xs flex items-center gap-2"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <X className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
        <span style={{ color: 'var(--color-text-secondary)' }}>
          Rejected by {action.rejected_by_name || 'Admin'}
        </span>
      </div>
    );
  }

  // ─── §164A.3 FAILED — error card with retry-eligibility note ───
  if (action.status === 'FAILED') {
    return (
      <div
        className="p-4 rounded-xl border text-xs space-y-2"
        style={{ borderColor: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}
      >
        <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--color-danger)' }}>
          <AlertCircle className="w-4 h-4" aria-hidden="true" />
          <span>This action failed to execute.</span>
        </div>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Retry eligibility depends on the backend response.
        </p>
        <Button size="sm" variant="outline" onClick={handleApprove}>
          Retry
        </Button>
      </div>
    );
  }

  // ─── §164A.3 EXECUTING — progress state, no Approve/Reject ───
  if (action.status === 'EXECUTING') {
    return (
      <div
        className="p-4 rounded-xl border text-xs"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--color-text)' }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--color-info)' }} aria-hidden="true" />
          Executing…
        </div>
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {actionLabel(action.action_kind)}
        </p>
      </div>
    );
  }

  // ─── §164A.3 PROPOSED (rare/transient) & WAITING_APPROVAL (active card) ───
  const isActive = action.status === 'WAITING_APPROVAL';

  return (
    <div
      className="p-4 rounded-xl border shadow-[var(--shadow-sm)] text-xs space-y-3"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ActionIcon kind={action.action_kind} />
          <span className="font-bold truncate" style={{ color: 'var(--color-text)' }}>
            {action.status === 'PROPOSED' ? 'Odin is preparing this action' : actionLabel(action.action_kind)}
          </span>
        </div>
        <Badge variant={riskBadge(action)} size="sm">
          Risk: {action.risk_level}
        </Badge>
      </div>

      {/* Payload summary (§164A.1) */}
      <div
        className="p-3 rounded-lg border space-y-1.5 text-xs"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <PayloadSummary action={action} />
      </div>

      {/* Request provenance (§164A.1) */}
      {action.requested_by_user_id && (
        <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
          Requested via AI run {action.requested_by_run_id ? action.requested_by_run_id.slice(0, 8) : ''}
        </p>
      )}

      {/* Hash & Verification Footer — §164A.2 snapshot validity */}
      <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
        <span>Payload Hash: {action.payload_hash.slice(0, 12)}…</span>
        <span>Version: v{action.payload_version}</span>
      </div>

      {/* Actions */}
      {isActive && (
        <div className="flex items-center gap-2 pt-1">
          {action.action_kind.includes('GITHUB') && onViewDiff && (
            <Button size="sm" variant="outline" onClick={onViewDiff}>
              Review Changes
            </Button>
          )}
          <div className="flex-1" />
          <Button size="sm" variant="ghost" disabled={isRejecting} onClick={handleReject}>
            Reject
          </Button>
          <Button size="sm" variant="primary" isLoading={isApproving} onClick={handleApprove}>
            Approve
          </Button>
        </div>
      )}
    </div>
  );
}