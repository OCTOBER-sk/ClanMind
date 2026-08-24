/**
 * Decisions view (FE §82 project section + §120). Numbered decision cards —
 *
 *   Decision #N · title · Status · Reason · Sources · Approved by
 *
 * with propose/approve/reject per the server's outcomes (the UI never
 * gates on client-side permission assumptions — FE rule 25; errors surface
 * verbatim from the §102 envelope).
 */

import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { DecisionCard } from './DecisionCard';
import { Button } from '@/design-system/components/Button';
import type { Decision, GroupMember } from '@/types';

export interface DecisionsViewProps {
  decisions: Decision[];
  members: GroupMember[];
  isLoading?: boolean;
  error?: string | null;
  onPropose: () => void;
  onApprove: (decision: Decision) => void;
  onReject: (decision: Decision) => void;
}

export function DecisionsView({
  decisions,
  members,
  isLoading,
  error,
  onPropose,
  onApprove,
  onReject,
}: DecisionsViewProps) {
  // §120 numbering — chronological position in this Project's log.
  const ordered = useMemo(
    () =>
      [...decisions].sort((a, b) =>
        a.created_at === b.created_at
          ? a.id.localeCompare(b.id)
          : a.created_at.localeCompare(b.created_at),
      ),
    [decisions],
  );
  const ordinals = useMemo(() => {
    const map = new Map<string, number>();
    ordered.forEach((d, i) => map.set(d.id, i + 1));
    return map;
  }, [ordered]);

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-raised)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Decisions</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            The project&apos;s decision log — approved choices and open proposals.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={onPropose}
        >
          Propose Decision
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="px-6 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900"
        >
          {error}
        </div>
      )}

      {/* Decisions List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4" aria-busy={isLoading}>
        {isLoading && ordered.length === 0 ? (
          <p className="text-center py-12 text-gray-400 text-xs">Loading decisions…</p>
        ) : ordered.length === 0 ? (
          <div className="text-center py-12 space-y-1" data-testid="decisions-empty">
            <p className="text-sm font-semibold text-[var(--color-text)]">No decisions recorded yet.</p>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto leading-relaxed">
              Recording what the team chose — and why — keeps future work honest. Propose one or ask Odin to.
            </p>
          </div>
        ) : (
          ordered.map((dec) => (
            <DecisionCard
              key={dec.id}
              decision={dec}
              ordinal={ordinals.get(dec.id) ?? 0}
              members={members}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))
        )}
      </div>
    </div>
  );
}
