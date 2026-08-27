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
      className="p-4 rounded-lg border space-y-2.5 text-xs"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Bookmark className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
          <span className="font-bold text-xs truncate" style={{ color: 'var(--color-text)' }}>
            Decision #{ordinal}: {decision.title}
          </span>
        </div>
        <Badge variant={decisionStatusVariant(decision.status)} size="sm">
          {decision.status}
        </Badge>
      </div>

      {decision.context && (
        <div>
          <span className="text-[10px] font-bold uppercase block mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Context &amp; Problem
          </span>
          <p className="leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{decision.context}</p>
        </div>
      )}

      {/* §120 "Reason" — the §47 rationale column */}
      {decision.rationale && (
        <div>
          <span className="text-[10px] font-bold uppercase block mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Reason</span>
          <p className="leading-relaxed font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {decision.rationale}
          </p>
        </div>
      )}

      {decision.options != null && Array.isArray(decision.options) && decision.options.length > 0 && (
        <div>
          <span className="text-[10px] font-bold uppercase block mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Options</span>
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
                  className={selected ? 'font-semibold' : ''}
                  style={{ color: selected ? 'var(--color-success)' : 'var(--color-text-secondary)' }}
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
        <div className="pt-2 border-t text-[10px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}>
          <span>Sources: {decision.sources.join(' • ')}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
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
                className="flex items-center gap-1 px-2 py-1 rounded-md border font-semibold transition-colors cursor-pointer disabled:opacity-40"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-danger)' }}
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
                className="flex items-center gap-1 px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer disabled:opacity-40"
                style={{ background: 'var(--color-success)', color: '#fff' }}
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
