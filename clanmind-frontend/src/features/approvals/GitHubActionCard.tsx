import React, { useState } from 'react';
import { GitBranch, FilePlus2, FileMinus2, FileEdit } from 'lucide-react';
import { ApprovalCard, isGithubAction } from './ApprovalCard';
import { Dialog } from '@/design-system/components/Dialog';
import { Button } from '@/design-system/components/Button';
import type { AiAction } from '@/types';

/**
 * §161 GitHubActionCard — ONE specialization of the generic §164A
 * ApprovalCard shell (never a parallel implementation). Adds the GitHub-domain
 * summary (branch + changed-file markers + risk) and gates Approve behind the
 * §163 confirmation dialog listing exactly what will happen:
 *
 *   Approve this action?
 *   Create branch / Modify N files / Create commit / Open PR
 *   [Approve] [Reject]
 *
 * The actual approve still submits the exact displayed payload_hash +
 * payload_version through the generic onApprove binding (§164A.2).
 */

export interface GitHubActionCardProps {
  action: AiAction;
  /** §164A.2 — submit exact payload_hash + payload_version, never a boolean */
  onApprove: (actionId: string, payloadHash: string, payloadVersion: number) => void;
  onReject: (actionId: string) => void;
  onReviewLatest?: (actionId: string) => void;
  onViewDiff?: () => void;
}

interface SummaryFile {
  path: string;
  additions: number;
  deletions: number;
}

function readFiles(payload: Record<string, unknown>): SummaryFile[] {
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

function fileMarker(f: SummaryFile): '+' | '~' | '-' {
  if (f.deletions === 0 && f.additions > 0) return '+';
  if (f.additions === 0 && f.deletions > 0) return '-';
  return '~';
}

/** §163 dialog step list — built from the action payload, never invented. */
function ApprovalSteps({ action }: { action: AiAction }) {
  const p = action.payload as Record<string, unknown>;
  const files = readFiles(p);
  const branch = typeof p.branch === 'string' ? p.branch : null;
  const steps: string[] = [];
  if (branch) steps.push(`Create branch ${branch}`);
  if (files.length > 0) steps.push(`Modify ${files.length} file${files.length === 1 ? '' : 's'}`);
  steps.push('Create commit');
  steps.push('Open PR');
  return (
    <ul className="space-y-1.5 text-xs" style={{ color: 'var(--color-text)' }}>
      {steps.map((s) => (
        <li key={s} className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--color-info)' }} aria-hidden="true" />
          {s}
        </li>
      ))}
    </ul>
  );
}

export function GitHubActionCard({
  action,
  onApprove,
  onReject,
  onReviewLatest,
  onViewDiff,
}: GitHubActionCardProps) {
  // §163 — Approve first asks "Approve this action?" with concrete steps.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isGithubAction(action)) return null;

  const p = action.payload as Record<string, unknown>;
  const files = readFiles(p);
  void p;

  return (
    <>
      {/* §161 example card anatomy: title, branch, changed-file summary, risk */}
      <div data-testid="github-action-card">
        <GitHubSummaryStrip action={action} />
        <ApprovalCard
          action={action}
          onApprove={(id, hash, version) => {
            // Intercept: show the §163 dialog instead of approving directly.
            void id;
            void hash;
            void version;
            setConfirmOpen(true);
          }}
          onReject={onReject}
          onReviewLatest={onReviewLatest}
          onViewDiff={onViewDiff}
        />
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
        }}
        title="Approve this action?"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(false)}>
              Reject
            </Button>
            <Button
              size="sm"
              variant="primary"
              isLoading={isSubmitting}
              onClick={() => {
                setIsSubmitting(true);
                // §164A.2 — the exact snapshot currently displayed.
                Promise.resolve(onApprove(action.id, action.payload_hash, action.payload_version))
                  .catch(() => undefined)
                  .finally(() => {
                    setIsSubmitting(false);
                    setConfirmOpen(false);
                  });
              }}
              aria-label="Confirm approval of this GitHub action"
            >
              Approve
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ApprovalSteps action={action} />
          {files.length > 0 && (
            <div className="font-mono text-[10px] space-y-0.5 pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
              {files.map((f) => {
                const marker = fileMarker(f);
                const color =
                  marker === '+' ? 'var(--color-success)' : marker === '-' ? 'var(--color-danger)' : 'var(--color-warning)';
                const Icon = marker === '+' ? FilePlus2 : marker === '-' ? FileMinus2 : FileEdit;
                return (
                  <div key={f.path} className="flex items-center gap-1.5">
                    <Icon className="w-3 h-3 shrink-0" style={{ color }} aria-hidden="true" />
                    <span className="truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {marker} {f.path}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}

/** Thin strip above the generic card carrying the §161 domain context. */
function GitHubSummaryStrip({ action }: { action: AiAction }) {
  const p = action.payload as Record<string, unknown>;
  const branch = typeof p.branch === 'string' ? p.branch : null;
  if (!branch) return null;
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-mono pb-1" style={{ color: 'var(--color-info)' }}>
      <GitBranch className="w-3.5 h-3.5" aria-hidden="true" />
      {branch}
    </p>
  );
}
