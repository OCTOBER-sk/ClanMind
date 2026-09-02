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
  aiName?: string;
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

function memberName(userId: string | null | undefined, members: GroupMember[], aiName: string): string | null {
  if (!userId) return null;
  if (userId === 'odin_ai') return aiName;
  const member = members.find((m) => m.user_id === userId);
  return member?.nickname ?? member?.user.name ?? null;
}

export function DecisionCard({
  decision,
  ordinal,
  members,
  aiName = 'AI',
  onApprove,
  onReject,
  disabled,
}: DecisionCardProps) {
  const approvedByName = memberName(decision.approved_by, members, aiName);
  const proposedByName = memberName(decision.proposed_by, members, aiName);

  return (
    <div
      data-testid="decision-card"
      className="p-4 rounded-md border border-outline-variant bg-surface-container-low space-y-2.5 text-xs transition-colors duration-micro ease-emphasized motion-reduce:transition-none hover:bg-surface-container hover:border-outline-variant relative isolate overflow-hidden before:absolute before:inset-0 before:bg-current before:opacity-0 hover:before:opacity-[0.04] before:transition-opacity before:duration-micro motion-reduce:before:transition-none"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Bookmark className="w-3.5 h-3.5 shrink-0 text-on-surface-variant" aria-hidden="true" />
          <span className="font-bold text-xs truncate text-on-surface">
            Decision #{ordinal}: {decision.title}
          </span>
        </div>
        <Badge variant={decisionStatusVariant(decision.status)} size="sm">
          {decision.status}
        </Badge>
      </div>

      {decision.context && (
        <div>
          <span className="text-[10px] font-bold uppercase block mb-0.5 text-on-surface-variant">
            Context &amp; Problem
          </span>
          <p className="leading-relaxed text-on-surface-variant">{decision.context}</p>
        </div>
      )}

      {/* §120 "Reason" — the §47 rationale column */}
      {decision.rationale && (
        <div>
          <span className="text-[10px] font-bold uppercase block mb-0.5 text-on-surface-variant">Reason</span>
          <p className="leading-relaxed font-medium text-on-surface-variant">
            {decision.rationale}
          </p>
        </div>
      )}

      {decision.options != null && Array.isArray(decision.options) && decision.options.length > 0 && (
        <div>
          <span className="text-[10px] font-bold uppercase block mb-0.5 text-on-surface-variant">Options</span>
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
                  className={selected ? 'font-semibold text-success' : 'text-on-surface-variant'}
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
        <div className="pt-2 border-t border-outline-variant text-[10px] text-on-surface-variant motion-reduce:transition-none">
          <span>Sources: {decision.sources.join(' • ')}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-[10px] text-on-surface-variant">
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
                className="flex items-center gap-1 px-2 py-1 rounded-full border border-outline text-[11px] font-semibold text-error transition-colors duration-micro ease-emphasized hover:bg-error-container hover:text-on-error-container hover:border-transparent focus-visible:shadow-[var(--md-focus-ring)] focus-visible:outline-none relative isolate overflow-hidden before:absolute before:inset-0 before:bg-current before:opacity-0 hover:before:opacity-[0.08] before:transition-opacity motion-reduce:transition-none motion-reduce:before:transition-none cursor-pointer disabled:opacity-40"
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
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-success text-on-success transition-colors duration-micro ease-emphasized hover:opacity-90 focus-visible:shadow-[var(--md-focus-ring)] focus-visible:outline-none relative isolate overflow-hidden before:absolute before:inset-0 before:bg-current before:opacity-0 hover:before:opacity-[0.08] before:transition-opacity motion-reduce:transition-none motion-reduce:before:transition-none cursor-pointer disabled:opacity-40"
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
