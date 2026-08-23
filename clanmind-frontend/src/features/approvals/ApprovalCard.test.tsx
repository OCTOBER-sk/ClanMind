import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApprovalCard } from '@/features/approvals/ApprovalCard';
import type { AiAction } from '@/types';

function makeAction(overrides: Partial<AiAction> = {}): AiAction {
  return {
    id: 'act_1',
    group_id: 'grp_1',
    action_kind: 'MODIFY_GITHUB_FILES',
    risk_level: 'HIGH',
    status: 'WAITING_APPROVAL',
    payload: { branch: 'feat/x', files: [{ path: 'a.c', change: 'A', additions: 10, deletions: 0 }] },
    payload_hash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    payload_version: 3,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('ApprovalCard — §164A generalized approval', () => {
  it('submits the exact payload hash and version, never a boolean (§164A.2)', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(<ApprovalCard action={makeAction()} onApprove={onApprove} onReject={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledWith(
      'act_1',
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      3
    );
  });

  it('EXPIRED state offers only "Review latest" (§164A.4)', () => {
    render(
      <ApprovalCard
        action={makeAction({ status: 'EXPIRED' })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText('This action changed since you last saw it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review latest/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
  });

  it('renders payload-driven file list, not mock content (§164A.5)', () => {
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
});