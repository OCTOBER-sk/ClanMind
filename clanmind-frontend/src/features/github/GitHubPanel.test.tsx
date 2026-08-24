/**
 * P7 — §159 GitHub project panel across the §165 status matrix and the
 * §165A.2 flag gates.
 *
 * Key product rule under test: a disabled flag HIDES the risky affordance
 * entirely (never renders it inert); repository info and read-only status
 * keep rendering as normal because reads are still allowed (BE §76.1).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitHubPanel } from '@/features/github/GitHubPanel';
import { GITHUB_STATUS_LABEL, type GithubConnectionState } from '@/features/github/useGithubConnection';
import type { AiAction, GithubActionItem, GithubConnection } from '@/types';

const CONNECTION: GithubConnection = {
  id: 'ghconn_1',
  group_id: 'grp_robotics_1',
  installation_id: 4821934,
  owner_login: 'robotics-core',
  repo_name: 'flight-controller',
  repo_full_name: 'robotics-core/flight-controller',
  default_branch: 'main',
  permission_mode: 'READ_WRITE',
  connected_at: new Date(Date.now() - 3_600_000).toISOString(),
  disconnected_at: null,
};

const PENDING_ACTION: AiAction = {
  id: 'act_github_panel_1',
  group_id: 'grp_robotics_1',
  project_id: 'proj_flight_ctrl',
  action_kind: 'github.apply_patch',
  risk_level: 'HIGH',
  status: 'WAITING_APPROVAL',
  payload: {
    branch: 'feat/spi-dma-driver',
    changed_files: [{ path: 'Drivers/SPI/spi_dma.c', additions: 142, deletions: 0 }],
    payload_note: 'write-triggering card',
  },
  payload_hash: 'a'.repeat(64),
  payload_version: 1,
  created_at: new Date().toISOString(),
};

function makeRow(overrides: Partial<GithubActionItem> = {}): GithubActionItem {
  return {
    id: 'gha_1',
    ai_action_id: PENDING_ACTION.id,
    group_id: 'grp_robotics_1',
    project_id: 'proj_flight_ctrl',
    action_type: 'apply_patch',
    branch_name: 'feat/spi-dma-driver',
    target_sha: null,
    pr_number: null,
    preview_json: null,
    created_at: new Date().toISOString(),
    completed_at: null,
    status: 'WAITING_APPROVAL',
    risk_level: 'HIGH',
    ...overrides,
  };
}

function makeState(overrides: Partial<GithubConnectionState> = {}): GithubConnectionState {
  return {
    status: 'READ_WRITE',
    connection: CONNECTION,
    actions: [],
    isLoading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function setup(
  state: GithubConnectionState,
  props: Partial<Parameters<typeof GitHubPanel>[0]> = {},
) {
  const handlers = {
    onApproveAction: vi.fn(),
    onRejectAction: vi.fn(),
    onReviewLatest: vi.fn(),
    onOpenDiff: vi.fn(),
  };
  const user = userEvent.setup();
  render(
    <GitHubPanel
      groupId="grp_robotics_1"
      projectId="proj_flight_ctrl"
      githubState={state}
      githubWriteEnabled
      githubMergeEnabled
      aiActions={[PENDING_ACTION]}
      {...handlers}
      {...props}
    />
  );
  return { user, ...handlers };
}

describe('GitHubPanel — §159 connected state', () => {
  it('renders repo identity, default branch, sync time and status badge', () => {
    setup(makeState());
    expect(screen.getByTestId('github-panel')).toBeInTheDocument();
    expect(screen.getByText('robotics-core/flight-controller')).toBeInTheDocument();
    expect(screen.getByText(/robotics-core\/flight-controller · main/)).toBeInTheDocument();
    expect(screen.getByText(/Last synced/)).toBeInTheDocument();
    expect(screen.getByText(GITHUB_STATUS_LABEL.READ_WRITE)).toBeInTheDocument(); // "Read/write"
    // Write-capable connection never shows the public-URL disclaimer.
    expect(screen.queryByText(/public repository URL/)).not.toBeInTheDocument();
  });

  it('lists pending approval cards when github_write is on', () => {
    setup(makeState({ actions: [makeRow()] }));
    expect(screen.getByText('Pending actions')).toBeInTheDocument();
    expect(screen.getByText('Odin wants to change GitHub')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
  });

  it("shows the honest placeholder when rows exist but envelopes haven't arrived", () => {
    // Rows are present but no ai_action envelopes have arrived yet (aiActions=[]).
    setup(makeState({ actions: [makeRow()] }), { aiActions: [] });
    expect(
      screen.getByText(/awaiting review — full details arrive with the approval event\./),
    ).toBeInTheDocument();
  });

  it('pull-request list is derived ONLY from backend create_pr rows', () => {
    setup(makeState({
      actions: [
        makeRow({ id: 'gha_pr9', ai_action_id: 'act_pr9', action_type: 'create_pr', pr_number: 9, branch_name: 'feat/spi-dma-driver', status: 'SUCCEEDED' }),
        makeRow({ id: 'gha_patch', action_type: 'apply_patch' }),
      ],
    }));
    expect(screen.getByText('#9 feat/spi-dma-driver')).toBeInTheDocument();
    expect(screen.getByText('SUCCEEDED')).toBeInTheDocument();
    // Non-PR rows stay out of the PR list.
    expect(screen.queryByText('#— feat/spi-dma-driver')).not.toBeInTheDocument();
  });

  it('refresh re-queries the shared connection state', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { user } = setup(makeState({ refresh }));
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe('GitHubPanel — §165A.2 flag gates hide, never disable', () => {
  it('github_write off: info stays, every write affordance vanishes', () => {
    setup(makeState(), { githubWriteEnabled: false });
    // Reads still work — repo info and status render normally.
    expect(screen.getByText('robotics-core/flight-controller')).toBeInTheDocument();
    expect(screen.getByText(GITHUB_STATUS_LABEL.READ_WRITE)).toBeInTheDocument();
    // The write-triggering approval card NEVER appears…
    expect(screen.queryByText('Odin wants to change GitHub')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    // …and it is absent rather than greyed out (hidden ≠ disabled).
    expect(screen.getByText(/Repository writes are disabled for this Group/)).toBeInTheDocument();
    // Disconnect remains available for the Owner regardless of write flags.
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });

  it('github_write off: even non-GitHub pending actions stay hidden from this panel', () => {
    const bulkDelete: AiAction = {
      ...PENDING_ACTION,
      id: 'act_bulk_del',
      action_kind: 'BULK_DELETE_ARTIFACTS',
    };
    setup(makeState(), { githubWriteEnabled: false, aiActions: [PENDING_ACTION, bulkDelete] });
    expect(screen.queryByText(/Odin wants to/)).not.toBeInTheDocument();
  });

  it('github_write on but disconnected: copy defers to the connection path instead', () => {
    setup(makeState({ status: 'NOT_CONNECTED', connection: null }));
    expect(
      screen.getByText('Connect GitHub to review repository actions here.'),
    ).toBeInTheDocument();
  });
});

describe('GitHubPanel — §160 read-only vs write capability', () => {
  it('READ_ONLY shows the read-only badge, the URL disclaimer, and Connect GitHub', () => {
    setup(makeState({
      status: 'READ_ONLY',
      connection: { ...CONNECTION, permission_mode: 'READ_ONLY', installation_id: null },
    }));
    expect(screen.getByText(GITHUB_STATUS_LABEL.READ_ONLY)).toBeInTheDocument();
    expect(
      screen.getByText(/A public repository URL provides read access only\. For write capability, connect GitHub\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^connect github$/i })).toBeInTheDocument();
  });
});

describe('GitHubPanel — §165 not-connected / disconnected states', () => {
  it('NOT_CONNECTED shows the empty header and the full connect form', () => {
    setup(makeState({ status: 'NOT_CONNECTED', connection: null }));
    expect(screen.getByText(GITHUB_STATUS_LABEL.NOT_CONNECTED)).toBeInTheDocument();
    expect(screen.getByText('No repository connected')).toBeInTheDocument();
    expect(screen.getByLabelText(/^owner$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^repository$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/default branch/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/installation id/i)).toBeInTheDocument();
  });

  it('DISCONNECTED keeps history visible and offers reconnection', () => {
    setup(makeState({
      status: 'DISCONNECTED',
      connection: { ...CONNECTION, disconnected_at: new Date().toISOString(), installation_id: null },
    }));
    expect(screen.getByText(GITHUB_STATUS_LABEL.DISCONNECTED)).toBeInTheDocument();
    // History rows are kept server-side; the last-known repo stays on screen.
    expect(screen.getByText('robotics-core/flight-controller')).toBeInTheDocument();
    // Reconnect affordance — the form title and the submit button both say
    // "Connect GitHub", so assert on the actionable button explicitly.
    expect(screen.getAllByRole('button', { name: /connect github/i }).length).toBeGreaterThan(0);
  });

  it('connect submits an App-installation body; public URL alone never grants write', async () => {
    const connect = vi.fn().mockResolvedValue(true);
    const { user } = setup(makeState({ status: 'NOT_CONNECTED', connection: null, connect }), {});
    await user.type(screen.getByLabelText(/^owner$/i), 'robotics-core');
    await user.type(screen.getByLabelText(/^repository$/i), 'flight-controller');
    const install = screen.getByLabelText(/installation id/i);
    await user.type(install, '4821934');
    expect(connect).not.toHaveBeenCalled();
    await user.click(within(screen.getByTestId('github-panel')).getByRole('button', { name: /^connect github$/i }));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith(expect.objectContaining({
      owner_login: 'robotics-core',
      repo_name: 'flight-controller',
      installation_id: 4821934,
      permission_mode: 'READ_WRITE',
    }));
  });

  it('blocks submit until owner/repo/installation are valid', async () => {
    const connect = vi.fn().mockResolvedValue(true);
    const { user } = setup(makeState({ status: 'NOT_CONNECTED', connection: null, connect }));
    const panel = within(screen.getByTestId('github-panel'));
    await user.type(panel.getByLabelText(/^owner$/i), 'robotics-core');
    // Repository + Installation ID still missing → button stays disabled.
    expect(panel.getByRole('button', { name: /^connect github$/i })).toBeDisabled();
    await user.type(panel.getByLabelText(/installation id/i), '4821934');
    expect(panel.getByRole('button', { name: /^connect github$/i })).toBeDisabled();
    await user.type(panel.getByLabelText(/^repository$/i), 'flight-controller');
    await user.click(panel.getByRole('button', { name: /^connect github$/i }));
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('NEEDS_REAUTH renders its exact §165 label without fabricating state', () => {
    setup(makeState({ status: 'NEEDS_REAUTH' }));
    expect(screen.getByText(GITHUB_STATUS_LABEL.NEEDS_REAUTH)).toBeInTheDocument();
  });
});

describe('GitHubPanel — §231 disconnect explains consequences first', () => {
  it('disconnect opens the consequence dialog; confirm calls disconnect once', async () => {
    const disconnect = vi.fn().mockResolvedValue(true);
    const { user } = setup(makeState({ actions: [makeRow()], disconnect }));
    await user.click(screen.getByRole('button', { name: /disconnect/i }));
    expect(disconnect).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('ClanMind will stop repository actions. Existing project history remains.'),
    ).toBeInTheDocument();

    // Cancel keeps everything connected.
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(disconnect).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /disconnect/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /disconnect/i }));
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('mutation failures surface the BE §102 message via role=alert', async () => {
    // The connection hook translates a failed mutation into state.error
    // (errorMessageOf), which the panel renders with role="alert". Here we
    // supply the resulting error directly — the panel is responsible for
    // surfacing it, not for running the mutation.
    setup(makeState({ error: 'Network unreachable' }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Network unreachable');
  });
});
