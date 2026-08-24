/**
 * P7 — §161 GitHubActionCard + §163 approval dialog flows.
 *
 * The card is ONE specialization of the generic §164A ApprovalCard shell:
 * the domain strip (branch, changed-file markers) rides above it, and the
 * Approve press must open the §163 confirmation dialog listing exactly what
 * will happen BEFORE any submission occurs.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitHubActionCard } from '@/features/approvals/GitHubActionCard';
import type { AiAction } from '@/types';

const HASH = 'c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00';

function makeGithubAction(overrides: Partial<AiAction> = {}): AiAction {
  return {
    id: 'act_gh_1',
    group_id: 'grp_robotics_1',
    project_id: 'proj_flight_ctrl',
    action_kind: 'github.apply_patch',
    risk_level: 'HIGH',
    status: 'WAITING_APPROVAL',
    payload: {
      repo_full_name: 'robotics-core/flight-controller',
      branch: 'feat/auth-flow',
      base_sha: '3f9c2ab91d7e40c1b5a2f8e60d34c7a19b2d5e88',
      target_sha: 'c71de4f20a98b3d64e17f2c805a9b4d23e6f1a52',
      changed_files: [
        { path: 'auth.ts', additions: 120, deletions: 0 },
        { path: 'routes.ts', additions: 30, deletions: 0 },
        { path: 'README.md', additions: 4, deletions: 9 },
      ],
    },
    payload_hash: HASH,
    payload_version: 1,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    ...overrides,
  };
}

function setup(overrides: Partial<AiAction> = {}) {
  const onApprove = vi.fn();
  const onReject = vi.fn();
  const onReviewLatest = vi.fn();
  const onViewDiff = vi.fn();
  const user = userEvent.setup();
  render(
    <GitHubActionCard
      action={makeGithubAction(overrides)}
      onApprove={onApprove}
      onReject={onReject}
      onReviewLatest={onReviewLatest}
      onViewDiff={onViewDiff}
    />
  );
  return { onApprove, onReject, onReviewLatest, onViewDiff, user };
}

describe('GitHubActionCard — §161 anatomy', () => {
  it('renders the exact §161 example anatomy from the payload', () => {
    setup();
    expect(screen.getByTestId('github-action-card')).toBeInTheDocument();
    // Title comes from the generic label map for github.apply_patch.
    expect(screen.getByText('Odin wants to change GitHub')).toBeInTheDocument();
    // Domain strip: branch in mono above the generic card. The generic shell's
    // payload summary also repeats the branch — both come from the payload.
    expect(screen.getAllByText('feat/auth-flow').length).toBeGreaterThanOrEqual(2);
    // Changed-file summary with A/M/D markers derived from stats.
    expect(screen.getByText('auth.ts')).toBeInTheDocument();
    expect(screen.getByText('routes.ts')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
    // Risk badge.
    expect(screen.getByText('Risk: HIGH')).toBeInTheDocument();
  });

  it('non-GitHub actions render nothing — this is a GitHub specialization', () => {
    const { container } = render(
      <GitHubActionCard
        action={makeGithubAction({ action_kind: 'BULK_DELETE_ARTIFACTS' })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('GitHubActionCard — §163 dialog flow', () => {
  it('card Approve opens the confirmation dialog FIRST and submits nothing yet', async () => {
    const { onApprove, user } = setup();
    await user.click(screen.getByRole('button', { name: /approve/i }));
    expect(onApprove).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Approve this action?')).toBeInTheDocument();
    // §163 step list is built from the payload, never invented.
    expect(
      within(dialog).getByText('Create branch feat/auth-flow'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Modify 3 files')).toBeInTheDocument();
    expect(within(dialog).getByText('Create commit')).toBeInTheDocument();
    expect(within(dialog).getByText('Open PR')).toBeInTheDocument();
  });

  it('dialog Approve submits the EXACT displayed hash+version once (§164A.2)', async () => {
    const { onApprove, user } = setup();
    await user.click(screen.getByRole('button', { name: /approve/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledWith('act_gh_1', HASH, 1);
  });

  it('dialog file list carries per-file +/-/~ markers inside the dialog', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /approve/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('+ auth.ts')).toBeInTheDocument();
    expect(within(dialog).getByText('~ README.md')).toBeInTheDocument();
  });

  it('dialog Reject closes without approving OR rejecting (it cancels approval)', async () => {
    const { onApprove, onReject, user } = setup();
    await user.click(screen.getByRole('button', { name: /approve/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /reject/i }));
    expect(onApprove).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
    await waitForDialogToClose(user);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('EXPIRED actions never reach the confirm dialog — re-review replaces them', async () => {
    const { onApprove, user } = setup({ status: 'EXPIRED' });
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review latest/i })).toBeInTheDocument();
    // Nothing can be submitted from a stale snapshot.
    expect(onApprove).not.toHaveBeenCalled();

    // The Review-latest button lives INSIDE the generic shell; clicking it
    // must not open the §163 dialog either.
    await user.click(screen.getByRole('button', { name: /review latest/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rejects straight from the generic card without the confirm step', async () => {
    const { onReject, user } = setup();
    await user.click(screen.getByRole('button', { name: /^reject$/i }));
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledWith('act_gh_1');
  });

  it('routes "Review Changes" to the diff viewer binding (§162 entry point)', async () => {
    const { onViewDiff, user } = setup();
    await user.click(screen.getByRole('button', { name: /review changes/i }));
    expect(onViewDiff).toHaveBeenCalledTimes(1);
  });
});

async function waitForDialogToClose(_user: ReturnType<typeof userEvent.setup>) {
  // Radix unmounts synchronously after state change; a microtask flush is enough.
  await Promise.resolve();
}
