/**
 * Decision-log ordinals. The §47 table carries no `decision_number` column —
 * FE §120 renders "Decision #14" from the log's chronological position
 * (oldest = #1) within a Project. One derivation, shared by the Decisions
 * view, the Overview and the command palette so numbers never disagree.
 */

import type { Decision } from '@/types';

/** Oldest-first copy of the log (created_at asc, id as tiebreaker). */
export function orderedDecisions(decisions: Decision[]): Decision[] {
  return [...decisions].sort((a, b) =>
    a.created_at === b.created_at
      ? a.id.localeCompare(b.id)
      : a.created_at.localeCompare(b.created_at),
  );
}

/** Map decision id → 1-based log ordinal. */
export function decisionOrdinals(decisions: Decision[]): Map<string, number> {
  const map = new Map<string, number>();
  orderedDecisions(decisions).forEach((d, index) => map.set(d.id, index + 1));
  return map;
}
