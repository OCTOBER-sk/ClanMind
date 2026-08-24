import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApprovalCard } from '@/features/approvals/ApprovalCard';
import type { AiAction } from '@/types';

const HASH = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function makeAction(overrides: Partial<AiAction> = {}): AiAction {
  return {
    id: 'act_1',
    group_id: 'grp_1',
    action_kind: 'MODIFY_GITHUB_FILES',
    risk_level: 'HIGH',
    status: 'WAITING_APPROVAL',
    payload: { branch: 'feat/x', files: [{ path: 'a.c', change: 'A', additions: 10, deletions: 0 }] },
    payload_hash: HASH,
    payload_version: 3,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('ApprovalCard — §164A generalized approval', () => {
  it('submits the exact displayed payload hash and version, never a boolean (§164A.2)', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(<ApprovalCard action={makeAction()} onApprove={onApprove} onReject={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledWith(
      'act_1',
      HASH,
      3
    );
  });

  it('reject path submits only the action id and resets its busy state (§163/§164A.1)', async () => {
    const user = userEvent.setup();
    let settleReject!: () => void;
    const pending = new Promise<void>((res) => {
      settleReject = res;
    });
    const onReject = vi.fn().mockReturnValue(pending);
    const onApprove = vi.fn();
    render(<ApprovalCard action={makeAction()} onApprove={onApprove} onReject={onReject} />);

    const rejectBtn = screen.getByRole('button', { name: /^reject$/i });
    await user.click(rejectBtn);
    expect(onReject).toHaveBeenCalledWith('act_1');
    expect(onApprove).not.toHaveBeenCalled();
    // Busy state: Reject disabled while its promise is pending.
    expect(rejectBtn).toBeDisabled();

    // Settling re-enables the control.
    settleReject();
    await waitFor(() => expect(screen.getByRole('button', { name: /^reject$/i })).toBeEnabled());
  });

  it('approve busy state blocks double submission and resets after failure (§164A.2)', async () => {
    const user = userEvent.setup();
    let rejectIt!: (reason?: unknown) => void;
    const pending = new Promise<void>((_res, rej) => {
      rejectIt = rej;
    });
    const onApprove = vi.fn().mockReturnValue(pending);
    render(<ApprovalCard action={makeAction()} onApprove={onApprove} onReject={vi.fn()} />);

    const approveBtn = screen.getByRole('button', { name: /approve/i });
    await user.click(approveBtn);
    // Pending → button is disabled/loading; a second click must not re-submit.
    expect(approveBtn).toBeDisabled();
    await user.click(approveBtn).catch(() => undefined);
    expect(onApprove).toHaveBeenCalledTimes(1);

    // Failure surfaces elsewhere (toast/status); the card must un-stick.
    rejectIt(new Error('ACTION_EXPIRED'));
    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeEnabled());
  });

  describe('§164A.4 EXPIRED — never silently retries with the old hash', () => {
    it('replaces the card with the exact copy and a single "Review latest" action', () => {
      const onApprove = vi.fn();
      const onReject = vi.fn();
      render(
        <ApprovalCard
          action={makeAction({ status: 'EXPIRED' })}
          onApprove={onApprove}
          onReject={onReject}
        />
      );
      expect(screen.getByText('This action changed since you last saw it.')).toBeInTheDocument();
      expect(screen.getByText(/Review the latest version before approving\./)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /review latest/i })).toBeInTheDocument();
      // No stale approve/reject affordances survive the replacement.
      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
      expect(onApprove).not.toHaveBeenCalled();
      expect(onReject).not.toHaveBeenCalled();
    });

    it('"Review latest" triggers exactly one re-fetch of the current row (§164A.4.3)', async () => {
      const user = userEvent.setup();
      const onReviewLatest = vi.fn();
      render(
        <ApprovalCard
          action={makeAction({ status: 'EXPIRED' })}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onReviewLatest={onReviewLatest}
        />
      );
      await user.click(screen.getByRole('button', { name: /review latest/i }));
      expect(onReviewLatest).toHaveBeenCalledTimes(1);
      expect(onReviewLatest).toHaveBeenCalledWith('act_1');
    });
  });

  it('renders the payload-driven file list, not mock content (§164A.5)', () => {
    render(
      <ApprovalCard
        action={makeAction({ payload: { branch: 'feat/z', files: [{ path: 'src/x.ts', change: 'M', additions: 4, deletions: 2 }] } })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText('src/x.ts')).toBeInTheDocument();
    expect(screen.getByText('feat/z')).toBeInTheDocument();
  });

  it('shows requested_by + created/expires provenance (§164A.1)', () => {
    const created = new Date('2026-08-20T10:00:00Z').toISOString();
    const expires = new Date('2026-08-21T10:00:00Z').toISOString();
    render(
      <ApprovalCard
        action={makeAction({
          requested_by_run_id: 'run_abcd1234efgh',
          created_at: created,
          expires_at: expires,
        })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText(/Requested via AI run/)).toBeInTheDocument();
    expect(screen.getByText('run_abcd')).toBeInTheDocument(); // 8-char run-id slice
    expect(screen.getByText(/^Created /)).toBeInTheDocument();
    expect(screen.getByText(/Approval window closes/)).toBeInTheDocument();
  });

  it('EXECUTING disables Approve/Reject (§164A.3)', () => {
    render(
      <ApprovalCard
        action={makeAction({ status: 'EXECUTING' })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
  });

  it('APPROVED shows the brief "Approved — starting…" transition card (§164A.3)', () => {
    render(
      <ApprovalCard
        action={makeAction({ status: 'APPROVED' })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText('Approved — starting…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });

  it('SUCCEEDED collapses to a completed card with no actions (§164A.3)', () => {
    render(
      <ApprovalCard
        action={makeAction({ status: 'SUCCEEDED' })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText(`hash: ${HASH.slice(0, 8)}…`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });

  it('REJECTED collapses to "Rejected by {name}" with no further action (§164A.3)', () => {
    render(
      <ApprovalCard
        action={makeAction({
          status: 'REJECTED',
          rejected_by_user_id: 'user_priya_2',
          rejected_by_name: 'Priya Sharma',
        })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText('Rejected by Priya Sharma')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
  });

  it('PROPOSED shows the transient preparing copy without enabling approval (§164A.3)', () => {
    render(
      <ApprovalCard
        action={makeAction({ status: 'PROPOSED' })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText('Odin is preparing this action')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
  });

  it('FAILED renders an error card, never a silent drop (§164A.3)', () => {
    render(
      <ApprovalCard
        action={makeAction({ status: 'FAILED' })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText('This action failed to execute.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
  });

  it('non-GitHub kinds reuse the same shell with their own payload summary (§164A.5)', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <ApprovalCard
        action={makeAction({
          id: 'act_bulk_del',
          action_kind: 'BULK_DELETE_ARTIFACTS',
          risk_level: 'MEDIUM',
          payload: {
            reason: 'superseded by Decision #14',
            items: ['Architecture v1 (superseded)', 'Old research notes (4 items)'],
            count: 5,
          },
        })}
        onApprove={onApprove}
        onReject={onReject}
      />
    );
    expect(screen.getByText('Odin wants to delete artifacts')).toBeInTheDocument();
    expect(screen.getByText('Reason: superseded by Decision #14')).toBeInTheDocument();
    expect(screen.getByText(/Risk: MEDIUM/)).toBeInTheDocument();
    expect(screen.getByText(/Architecture v1 \(superseded\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /approve/i }));
    await user.click(screen.getByRole('button', { name: /^reject$/i }));
    expect(onApprove).toHaveBeenCalledWith('act_bulk_del', HASH, 3);
    expect(onReject).toHaveBeenCalledWith('act_bulk_del');
  });
});
