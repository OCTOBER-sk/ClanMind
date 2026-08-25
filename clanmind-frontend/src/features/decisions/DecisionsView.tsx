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
import { Plus, Bookmark } from 'lucide-react';
import { DecisionCard } from './DecisionCard';
import { Button } from '@/design-system/components/Button';
import { EmptyState } from '@/design-system/components/EmptyState';
import { Skeleton } from '@/design-system/components/Skeleton';
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
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 border-b px-6 py-4"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div>
          <h1 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>
            Decisions
          </h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            The project&apos;s decision log — approved choices and open proposals.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={onPropose}
        >
          Propose
        </Button>
      </div>

      {/* Error — §64: what happened, what is safe, next action */}
      {error && (
        <div
          role="alert"
          className="px-6 py-2.5 text-xs border-b"
          style={{ color: 'var(--color-danger)', background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          {error}
        </div>
      )}

      {/* Decisions List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3" aria-busy={isLoading}>
        {/* §64 — skeleton loading */}
        {isLoading && ordered.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-lg border space-y-2"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
              >
                <div className="flex items-center gap-2">
                  <Skeleton variant="text" className="h-3.5 w-48" />
                  <Skeleton variant="text" className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton variant="text" className="h-2.5 w-full" />
                <Skeleton variant="text" className="h-2.5 w-3/4" />
              </div>
            ))}
          </div>
        ) : ordered.length === 0 ? (
          <div data-testid="decisions-empty">
            <EmptyState
              icon={<Bookmark className="w-8 h-8" />}
              title="No decisions recorded yet."
              description="Recording what the team chose — and why — keeps future work honest. Propose one or ask Odin to."
              actions={
                <Button size="sm" variant="ghost" onClick={onPropose}>
                  Propose Decision
                </Button>
              }
            />
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
