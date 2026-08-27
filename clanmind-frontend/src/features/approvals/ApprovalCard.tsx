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
  /**
   * §164A.2 — submit exact payload_hash + payload_version, never a boolean.
   * May return a promise; the card keeps its busy state until it settles and
   * resets (instead of sticking) when the submission fails.
   */
  onApprove: (actionId: string, payloadHash: string, payloadVersion: number) => void | Promise<void>;
  onReject: (actionId: string) => void | Promise<void>;
  onReviewLatest?: (actionId: string) => void;
  onViewDiff?: () => void;
}

// ─── §164A.1 human-readable action labels ───
// Covers BOTH vocabularies: the BE generic engine kinds (`github.apply_patch`,
// `artifact.bulk_delete`…) and legacy FE-style kinds.
const ACTION_LABELS: Record<string, string> = {
  'github.apply_patch': 'Odin wants to change GitHub',
  'github.create_branch': 'Odin wants to create a branch',
  'github.create_pr': 'Odin wants to open a pull request',
  'github.merge_pr': 'Odin wants to merge a pull request',
  MODIFY_GITHUB_FILES: 'Odin wants to change GitHub',
  CREATE_GITHUB_BRANCH: 'Odin wants to create a branch',
  OPEN_GITHUB_PR: 'Odin wants to open a pull request',
  MERGE_GITHUB_PR: 'Odin wants to merge a pull request',
  BULK_DELETE_ARTIFACTS: 'Odin wants to delete artifacts',
  REASSIGN_TASKS: 'Odin wants to reassign tasks',
  MEMORY_PURGE: 'Odin wants to archive memory entries',
};

/** Case-insensitive domain check — BE kinds are dotted-lowercase. */
export function isGithubAction(action: Pick<AiAction, 'action_kind'>): boolean {
  return action.action_kind.toLowerCase().includes('github');
}

function actionLabel(action_kind: string): string {
  return (
    ACTION_LABELS[action_kind] ??
    ACTION_LABELS[action_kind.toLowerCase()] ??
    action_kind.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  );
}

interface SummaryFile {
  path: string;
  additions: number;
  deletions: number;
}

/**
 * Tolerant file-list reader: the BE approval payload carries
 * `changed_files:[{path,additions,deletions}]` (§140 buildDiffPreview); demo
 * fixtures may still use `files`. A/M/D is DERIVED when not explicit.
 */
function readPayloadFiles(payload: Record<string, unknown>): SummaryFile[] {
  const raw = (payload.changed_files ?? payload.files) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const e = entry as Record<string, unknown>;
    if (typeof e.path !== 'string') return [];
    return [
      {
        path: e.path,
        additions: typeof e.additions === 'number' ? e.additions : 0,
        deletions: typeof e.deletions === 'number' ? e.deletions : 0,
      },
    ];
  });
}

function changeLetter(f: { additions: number; deletions: number }): 'A' | 'D' | 'M' {
  if (f.additions > 0 && f.deletions === 0) return 'A';
  if (f.deletions > 0 && f.additions === 0) return 'D';
  return 'M';
}

// ─── §164A.5 payload summary renderers — driven by action.payload, never mock ───
function PayloadSummary({ action }: { action: AiAction }) {
  const p = action.payload as Record<string, unknown>;
  const kind = action.action_kind.toLowerCase();

  if (kind.includes('github')) {
    const files = readPayloadFiles(p);
    return (
      <div className="font-mono text-[11px] space-y-1">
        {typeof p.repo_full_name === 'string' && (
          <div className="font-sans font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Repo: <span className="font-mono" style={{ color: 'var(--color-text)' }}>{p.repo_full_name}</span>
          </div>
        )}
        {typeof p.branch === 'string' && (
          <div className="font-sans font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Branch: <span className="font-mono" style={{ color: 'var(--color-info)' }}>{p.branch}</span>
          </div>
        )}
        {files.map((f) => {
          const letter = changeLetter(f);
          const Icon = letter === 'A' ? FilePlus2 : letter === 'D' ? FileMinus2 : FileEdit;
          return (
            <div key={f.path} className="flex items-center gap-1.5">
              <Icon className="w-3 h-3 shrink-0" style={{ color: letter === 'D' ? 'var(--color-danger)' : 'var(--color-success)' }} aria-hidden="true" />
              <span className="truncate" style={{ color: 'var(--color-text)' }}>{f.path}</span>
              <span className="ml-auto shrink-0" style={{ color: 'var(--color-success)' }}>+{f.additions}</span>
              <span className="shrink-0" style={{ color: 'var(--color-danger)' }}>−{f.deletions}</span>
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

  if (kind.includes('delete') || kind.includes('purge')) {
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

  if (kind.includes('reassign')) {
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
  const k = kind.toLowerCase();
  if (k.includes('github')) return <GitPullRequest className="w-4 h-4" style={{ color: 'var(--color-info)' }} aria-hidden="true" />;
  if (k.includes('delete')) return <Trash2 className="w-4 h-4" style={{ color: 'var(--color-danger)' }} aria-hidden="true" />;
  if (k.includes('reassign')) return <Users className="w-4 h-4" style={{ color: 'var(--color-info)' }} aria-hidden="true" />;
  if (k.includes('memory')) return <BookOpen className="w-4 h-4" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />;
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

  // §164A.2 — never send `approved: true`; submit exact hash + version.
  const handleApprove = () => {
    setIsApproving(true);
    Promise.resolve(onApprove(action.id, action.payload_hash, action.payload_version))
      .catch(() => undefined) // error surfaces via toast/status; reset busy state
      .finally(() => setIsApproving(false));
  };

  const handleReject = () => {
    setIsRejecting(true);
    Promise.resolve(onReject(action.id))
      .catch(() => undefined)
      .finally(() => setIsRejecting(false));
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

  // §164A.1 — risk-tiered border emphasis: CRITICAL/HIGH get a stronger
  // border to communicate severity without making every approve button red.
  const riskBorderColor =
    action.risk_level === 'CRITICAL' ? 'var(--color-danger)' :
    action.risk_level === 'HIGH' ? 'var(--color-warning)' :
    'var(--color-border)';

  return (
    <div
      className="p-4 rounded-xl border shadow-[var(--shadow-sm)] text-xs space-y-3"
      style={{ borderColor: riskBorderColor, background: 'var(--color-surface-raised)' }}
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

      {/* Request provenance + lifecycle timestamps (§164A.1) */}
      <div className="space-y-0.5 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
        {action.requested_by_run_id && (
          <p>
            Requested via AI run{' '}
            <span className="font-mono">{action.requested_by_run_id.slice(0, 8)}</span>
            {action.requested_by_user_id ? ' · by a teammate request' : ''}
          </p>
        )}
        <p>Created {formatTimestamp(action.created_at)}</p>
        {typeof action.expires_at === 'string' && (
          <p>Approval window closes {formatTimestamp(action.expires_at)}</p>
        )}
      </div>

      {/* Hash & Verification Footer — §164A.2 snapshot validity */}
      <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
        <span>Payload Hash: {action.payload_hash.slice(0, 12)}…</span>
        <span>Version: v{action.payload_version}</span>
      </div>

      {/* Actions */}
      {isActive && (
        <div className="flex items-center gap-2 pt-1">
          {isGithubAction(action) && onViewDiff && (
            <Button size="sm" variant="outline" onClick={onViewDiff} aria-label="Review GitHub changes">
              Review Changes
            </Button>
          )}
          <div className="flex-1" />
          <Button size="sm" variant="ghost" disabled={isRejecting} onClick={handleReject} aria-label={`Reject ${actionLabel(action.action_kind)}`}>
            Reject
          </Button>
          <Button
            size="sm"
            variant={action.risk_level === 'CRITICAL' ? 'danger' : 'primary'}
            isLoading={isApproving}
            onClick={handleApprove}
            aria-label={`Approve ${actionLabel(action.action_kind)}`}
          >
            Approve
          </Button>
        </div>
      )}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}