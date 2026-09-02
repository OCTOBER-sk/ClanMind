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
 *
 * M3 calm card: surface-container tone + subtle outline/left-edge accent,
 * NOT alarm fill. Buttons keep existing variants, state-layer safe.
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
          <div className="font-sans font-semibold text-xs text-on-surface-variant">
            Repo: <span className="font-mono text-on-surface">{p.repo_full_name}</span>
          </div>
        )}
        {typeof p.branch === 'string' && (
          <div className="font-sans font-semibold text-xs text-on-surface-variant">
            Branch: <span className="font-mono text-tertiary">{p.branch}</span>
          </div>
        )}
        {files.map((f) => {
          const letter = changeLetter(f);
          const Icon = letter === 'A' ? FilePlus2 : letter === 'D' ? FileMinus2 : FileEdit;
          return (
            <div key={f.path} className="flex items-center gap-1.5">
              <Icon className={letter === 'D' ? 'w-3 h-3 shrink-0 text-error' : letter === 'A' ? 'w-3 h-3 shrink-0 text-success' : 'w-3 h-3 shrink-0 text-warning'} aria-hidden="true" />
              <span className="truncate text-on-surface">{f.path}</span>
              <span className="ml-auto shrink-0 font-mono text-success">+{f.additions}</span>
              <span className="shrink-0 font-mono text-error">−{f.deletions}</span>
            </div>
          );
        })}
        {files.length === 0 && (
          <pre className="text-[10px] font-mono text-on-surface-variant whitespace-pre-wrap break-all">{JSON.stringify(action.payload, null, 2)}</pre>
        )}
      </div>
    );
  }

  if (kind.includes('delete') || kind.includes('purge')) {
    const items = (p.items as string[]) ?? [];
    return (
      <div className="space-y-1 text-on-surface">
        {typeof p.reason === 'string' && <p className="text-[11px] text-on-surface-variant">Reason: {p.reason}</p>}
        {items.map((it, i) => (
          <p key={i}>• {it}</p>
        ))}
        {items.length === 0 && <p>{String(p.count ?? 0)} items</p>}
      </div>
    );
  }

  if (kind.includes('reassign')) {
    return (
      <div className="space-y-1 text-on-surface">
        <p>
          From: <span className="font-semibold">{String(p.from_name ?? '—')}</span>
        </p>
        <p>
          To: <span className="font-semibold">{String(p.to_name ?? '—')}</span>
        </p>
        {typeof p.count === 'number' && <p className="text-[11px] text-on-surface-variant">{p.count} tasks affected</p>}
      </div>
    );
  }

  return (
    <pre className="font-mono text-[10px] text-on-surface-variant whitespace-pre-wrap break-all">{JSON.stringify(action.payload, null, 2)}</pre>
  );
}

function ActionIcon({ kind }: { kind: string }) {
  const k = kind.toLowerCase();
  if (k.includes('github')) return <GitPullRequest className="w-4 h-4 text-tertiary" aria-hidden="true" />;
  if (k.includes('delete')) return <Trash2 className="w-4 h-4 text-error" aria-hidden="true" />;
  if (k.includes('reassign')) return <Users className="w-4 h-4 text-tertiary" aria-hidden="true" />;
  if (k.includes('memory')) return <BookOpen className="w-4 h-4 text-warning" aria-hidden="true" />;
  return <ShieldAlert className="w-4 h-4 text-warning" aria-hidden="true" />;
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
      <div className="p-4 rounded-md border border-outline-variant bg-surface-container border-l-[3px] border-l-warning text-xs space-y-3 motion-reduce:transition-none">
        <div className="flex items-center gap-2 font-semibold text-warning">
          <Clock className="w-4 h-4" aria-hidden="true" />
          <span>This action changed since you last saw it.</span>
        </div>
        <p className="text-on-surface-variant">Review the latest version before approving.</p>
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
      <div className="p-3.5 rounded-md border border-outline-variant bg-surface-container border-l-[3px] border-l-tertiary text-xs flex items-center justify-between motion-reduce:transition-none">
        <span className="font-semibold text-tertiary">Approved — starting…</span>
        <Loader2 className="w-3.5 h-3.5 animate-spin text-tertiary" aria-hidden="true" />
      </div>
    );
  }

  if (action.status === 'SUCCEEDED') {
    return (
      <div className="p-3.5 rounded-md border border-outline-variant bg-surface-container border-l-[3px] border-l-success text-xs flex items-center justify-between motion-reduce:transition-none">
        <div className="flex items-center gap-2 font-semibold text-success">
          <Check className="w-4 h-4" aria-hidden="true" />
          <span>Completed</span>
        </div>
        <span className="text-[11px] font-mono text-on-surface-variant">hash: {action.payload_hash.slice(0, 8)}…</span>
      </div>
    );
  }

  // ─── §164A.3 REJECTED — collapsed, no further action ───
  if (action.status === 'REJECTED') {
    return (
      <div className="p-3.5 rounded-md border border-outline-variant bg-surface-container-low text-xs flex items-center gap-2 motion-reduce:transition-none">
        <X className="w-4 h-4 text-on-surface-variant" aria-hidden="true" />
        <span className="text-on-surface-variant">Rejected by {action.rejected_by_name || 'Admin'}</span>
      </div>
    );
  }

  // ─── §164A.3 FAILED — error card with retry-eligibility note ───
  if (action.status === 'FAILED') {
    return (
      <div className="p-4 rounded-md border border-outline-variant bg-surface-container border-l-[3px] border-l-error text-xs space-y-2 motion-reduce:transition-none">
        <div className="flex items-center gap-2 font-semibold text-error">
          <AlertCircle className="w-4 h-4" aria-hidden="true" />
          <span>This action failed to execute.</span>
        </div>
        <p className="text-on-surface-variant">Retry eligibility depends on the backend response.</p>
        <Button size="sm" variant="outline" onClick={handleApprove}>
          Retry
        </Button>
      </div>
    );
  }

  // ─── §164A.3 EXECUTING — progress state, no Approve/Reject ───
  if (action.status === 'EXECUTING') {
    return (
      <div className="p-4 rounded-md border border-outline-variant bg-surface-container text-xs motion-reduce:transition-none">
        <div className="flex items-center gap-2 font-semibold text-on-surface">
          <Loader2 className="w-4 h-4 animate-spin text-tertiary" aria-hidden="true" />
          Executing…
        </div>
        <p className="mt-1 text-on-surface-variant">{actionLabel(action.action_kind)}</p>
      </div>
    );
  }

  // ─── §164A.3 PROPOSED (rare/transient) & WAITING_APPROVAL (active card) ───
  const isActive = action.status === 'WAITING_APPROVAL';

  // §164A.1 — subtle left-edge outline accent by risk (calm high-attention, NOT alarm fill)
  const riskAccent =
    action.risk_level === 'CRITICAL'
      ? 'border-l-error'
      : action.risk_level === 'HIGH'
        ? 'border-l-warning'
        : action.risk_level === 'MEDIUM'
          ? 'border-l-outline'
          : 'border-l-outline-variant';

  return (
    <div
      className={`p-4 rounded-md border border-outline-variant bg-surface-container shadow-sm text-xs space-y-3 border-l-[3px] ${riskAccent} motion-reduce:transition-none`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ActionIcon kind={action.action_kind} />
          <span className="font-bold truncate text-on-surface">
            {action.status === 'PROPOSED' ? 'Odin is preparing this action' : actionLabel(action.action_kind)}
          </span>
        </div>
        <Badge variant={riskBadge(action)} size="sm">
          Risk: {action.risk_level}
        </Badge>
      </div>

      {/* Payload summary (§164A.1) — surface-container-lowest for depth */}
      <div className="p-3 rounded-sm border border-outline-variant bg-surface-container-lowest space-y-1.5 text-xs motion-reduce:transition-none">
        <PayloadSummary action={action} />
      </div>

      {/* Request provenance + lifecycle timestamps (§164A.1) */}
      <div className="space-y-0.5 text-[10px] text-on-surface-variant">
        {action.requested_by_run_id && (
          <p>
            Requested via AI run <span className="font-mono text-on-surface">{action.requested_by_run_id.slice(0, 8)}</span>
            {action.requested_by_user_id ? ' · by a teammate request' : ''}
          </p>
        )}
        <p>Created {formatTimestamp(action.created_at)}</p>
        {typeof action.expires_at === 'string' && <p>Approval window closes {formatTimestamp(action.expires_at)}</p>}
      </div>

      {/* Hash & Verification Footer — §164A.2 snapshot validity — mono token */}
      <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant">
        <span>Payload Hash: {action.payload_hash.slice(0, 12)}…</span>
        <span>Version: v{action.payload_version}</span>
      </div>

      {/* Actions — variants unchanged */}
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
