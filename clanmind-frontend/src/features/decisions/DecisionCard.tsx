/**
 * §120 Decision card — numbered log entry with status, reason (rationale),
 * sources, approved-by, plus context and options when the row carries them.
 * Approve/Reject appear only on PROPOSED rows; every transition is a
 * server round-trip the UI reports verbatim.
 */

import { Bookmark, Check, X } from 'lucide-react';
import { Badge } from '@/design-system/components/Badge';
import type { Decision, GroupMember, DecisionStatus } from '@/types';

export interface DecisionCardProps {
  decision: Decision;
  /** 1-based position in the Project's chronological log. */
  ordinal: number;
  members: GroupMember[];
  onApprove?: (decision: Decision) => void;
  onReject?: (decision: Decision) => void;
  disabled?: boolean;
}

/** §120 status → badge variant (render vocabulary; unknown = neutral). */
function decisionStatusVariant(
  status: DecisionStatus,
): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'PROPOSED':
      return 'warning';
    case 'REJECTED':
      return 'danger';
    default:
      return 'neutral'; // SUPERSEDED
  }
}

function memberName(userId: string | null | undefined, members: GroupMember[]): string | null {
  if (!userId) return null;
  if (userId === 'odin_ai') return 'Odin';
  const member = members.find((m) => m.user_id === userId);
  return member?.nickname ?? member?.user.name ?? null;
}

export function DecisionCard({
  decision,
  ordinal,
  members,
  onApprove,
  onReject,
  disabled,
}: DecisionCardProps) {
  const approvedByName = memberName(decision.approved_by, members);
  const proposedByName = memberName(decision.proposed_by, members);

  return (
    <div
      data-testid="decision-card"
      className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-xs space-y-3 text-xs"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Bookmark className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
          <span className="font-bold text-sm text-[var(--color-text)] truncate">
            Decision #{ordinal}: {decision.title}
          </span>
        </div>
        <Badge variant={decisionStatusVariant(decision.status)} size="sm">
          {decision.status}
        </Badge>
      </div>

      {decision.context && (
        <div>
          <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">
            Context &amp; Problem
          </span>
          <p className="text-[var(--color-text-secondary)] leading-relaxed">{decision.context}</p>
        </div>
      )}

      {/* §120 "Reason" — the §47 rationale column */}
      {decision.rationale && (
        <div>
          <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Reason</span>
          <p className="text-[var(--color-text-secondary)] leading-relaxed font-medium">
            {decision.rationale}
          </p>
        </div>
      )}

      {decision.options != null && Array.isArray(decision.options) && decision.options.length > 0 && (
        <div>
          <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Options</span>
          <ul className="space-y-0.5">
            {(decision.options as Array<Record<string, unknown>>).map((opt, i) => {
              const label = typeof opt === 'string' ? opt : String(opt.label ?? `Option ${i + 1}`);
              const selected =
                decision.selected_option != null &&
                typeof decision.selected_option === 'object' &&
                String((decision.selected_option as Record<string, unknown>).label ?? '') === label;
              return (
                <li
                  key={`${label}-${i}`}
                  className={selected ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-[var(--color-text-secondary)]'}
                >
                  {selected ? '✓ ' : '· '}
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* §120 "Sources" — rendered only when data provides them (no §47
          column yet; live rows show an honest absence instead of fake cites) */}
      {decision.sources && decision.sources.length > 0 && (
        <div className="pt-2 border-t border-[var(--color-border)] text-[10px] text-gray-400">
          <span>Sources: {decision.sources.join(' • ')}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-[10px] text-gray-400">
          {decision.status === 'APPROVED'
            ? `Approved by ${approvedByName ?? 'the team'}${decision.approved_at ? ` · ${new Date(decision.approved_at).toLocaleDateString()}` : ''}`
            : proposedByName
              ? `Proposed by ${proposedByName}`
              : new Date(decision.created_at).toLocaleDateString()}
        </span>

        {decision.status === 'PROPOSED' && (onApprove || onReject) && (
          <span className="flex items-center gap-1.5 shrink-0">
            {onReject && (
              <button
                type="button"
                onClick={() => onReject(decision)}
                disabled={disabled}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-semibold hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer disabled:opacity-40"
                aria-label={`Reject ${decision.title}`}
              >
                <X className="w-3 h-3" aria-hidden="true" /> Reject
              </button>
            )}
            {onApprove && (
              <button
                type="button"
                onClick={() => onApprove(decision)}
                disabled={disabled}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer disabled:opacity-40"
                aria-label={`Approve ${decision.title}`}
              >
                <Check className="w-3 h-3" aria-hidden="true" /> Approve
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
