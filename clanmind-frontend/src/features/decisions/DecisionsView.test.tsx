/**
 * P8 — DecisionsView + §120 DecisionCard.
 *
 * Numbering derives from chronological log position (the §47 table has no
 * decision_number column); cards show status/reason/sources/approved-by;
 * approve/reject appear only on PROPOSED rows and report server outcomes.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecisionsView } from '@/features/decisions/DecisionsView';
import { decisionOrdinals } from '@/features/decisions/decisionOrdinal';
import type { Decision, GroupMember } from '@/types';

const MEMBERS: GroupMember[] = [
  {
    user_id: 'user_a',
    group_id: 'g1',
    role: 'OWNER',
    nickname: 'Arun (Lead)',
    joined_at: new Date().toISOString(),
    user: { id: 'user_a', email: 'a@x.io', name: 'Arun Kumar', created_at: new Date().toISOString() },
  },
];

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: 'dec_1',
    project_id: 'proj_1',
    title: 'Use PostgreSQL for all new services',
    context: 'We needed one relational store.',
    rationale: 'Team already knows Postgres ops.',
    status: 'PROPOSED',
    version: 1,
    proposed_by: 'user_a',
    approved_by: null,
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
    updated_at: new Date().toISOString(),
    approved_at: null,
    ...overrides,
  };
}

function setup(decisions: Decision[], props: Partial<Parameters<typeof DecisionsView>[0]> = {}) {
  const handlers = {
    onPropose: vi.fn(),
    onApprove: vi.fn(),
    onReject: vi.fn(),
  };
  const user = userEvent.setup();
  render(
    <DecisionsView decisions={decisions} members={MEMBERS} {...handlers} {...props} />,
  );
  return { user, ...handlers };
}

describe('DecisionsView — §120 card anatomy', () => {
  it('numbers cards by chronological log position (oldest = #1)', () => {
    const older = makeDecision({ id: 'a', title: 'Older choice', created_at: new Date(2026, 0, 1).toISOString() });
    const newer = makeDecision({ id: 'b', title: 'Newer choice', created_at: new Date(2026, 0, 2).toISOString() });
    setup([newer, older]); // deliberately unsorted input

    const cards = screen.getAllByTestId('decision-card');
    expect(within(cards[0]!).getByText('Decision #1: Older choice')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('Decision #2: Newer choice'));
  });

  it('shows Status badge, Context, Reason, Sources and Approved-by', () => {
    setup([
      makeDecision({
        status: 'APPROVED',
        approved_by: 'user_a',
        approved_at: new Date().toISOString(),
        sources: ['ADR-007', 'Bench log #12'],
      }),
    ]);
    const card = screen.getByTestId('decision-card');
    expect(within(card).getByText('APPROVED')).toBeInTheDocument();
    expect(within(card).getByText('We needed one relational store.')).toBeInTheDocument();
    expect(within(card).getByText('Team already knows Postgres ops.')).toBeInTheDocument();
    expect(within(card).getByText(/Sources: ADR-007 • Bench log #12/)).toBeInTheDocument();
    expect(within(card).getByText(/Approved by Arun \(Lead\)/)).toBeInTheDocument();
  });

  it('renders an honest absence when a live row carries no sources', () => {
    setup([makeDecision({ status: 'APPROVED', sources: undefined })]);
    expect(screen.queryByText(/^Sources:/)).not.toBeInTheDocument();
  });

  it('proposed rows show proposer and keep the PROPOSED badge', () => {
    setup([makeDecision()]);
    const card = screen.getByTestId('decision-card');
    expect(within(card).getByText('PROPOSED')).toBeInTheDocument();
    expect(within(card).getByText(/Proposed by Arun \(Lead\)/)).toBeInTheDocument();
  });
});

describe('DecisionsView — approve/reject affordances', () => {
  it('PROPOSED rows expose Approve/Reject; terminal rows expose neither', async () => {
    const proposed = makeDecision({ id: 'p1' });
    const approved = makeDecision({ id: 'a1', status: 'APPROVED', approved_by: 'user_a' });
    const { user, onApprove } = setup([proposed, approved]);

    await user.click(screen.getByRole('button', { name: /approve use postgresql/i }));
    expect(onApprove).toHaveBeenCalledWith(proposed);

    // Terminal rows expose no approve affordance at all.
    const card = screen
      .getAllByTestId('decision-card')
      .find((el) => el.textContent?.includes('approved') || el.textContent?.includes('APPROVED'));
    if (card) {
      expect(within(card).queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
      expect(within(card).queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    }
    // Only one reject button exists overall (for the PROPOSED row).
    expect(screen.getAllByRole('button', { name: /^reject/i })).toHaveLength(1);
  });

  it('empty state explains what/why/next (§179)', () => {
    setup([]);
    expect(screen.getByTestId('decisions-empty')).toHaveTextContent(/no decisions recorded yet/i);
    expect(screen.getByTestId('decisions-empty')).toHaveTextContent(/recording what the team chose/i);
  });

  it('error banners surface verbatim above the log', () => {
    setup([makeDecision()], { error: 'Decision changed; reload and retry.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Decision changed; reload and retry.');
  });
});

describe('decisionOrdinals helper', () => {
  it('is stable against input order and ties break on id', () => {
    const t = (iso: string) => new Date(iso).toISOString();
    const a = makeDecision({ id: 'aaa', created_at: t('2026-01-01T00:00:00Z') });
    const b = makeDecision({ id: 'bbb', created_at: t('2026-01-01T00:00:00Z') });
    const c = makeDecision({ id: 'ccc', created_at: t('2025-12-31T00:00:00Z') });
    const ordinals = decisionOrdinals([b, a, c]);
    expect(ordinals.get('ccc')).toBe(1);
    expect(ordinals.get('aaa')).toBe(2);
    expect(ordinals.get('bbb')).toBe(3);
  });
});
