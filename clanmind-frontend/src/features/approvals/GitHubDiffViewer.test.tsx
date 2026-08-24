/**
 * P7 — §162 GitHub Diff Viewer.
 *
 * Everything renders from the ai_actions payload: file tree, per-file
 * additions/deletions, inline hunks (demo-only file_diffs extension), hunk
 * collapse, copy, PR preview. Line hunks have NO backend endpoint yet — the
 * honest fallback text is asserted too (INTEGRATION_NOTES P7 gap list).
 * §164 merging requires an explicit confirmation dialog and disappears
 * entirely when github_merge is off (§165A.2).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitHubDiffViewer, highlightLine } from '@/features/approvals/GitHubDiffViewer';
import { copyToClipboard } from '@/tauri/bridge';
import type { AiAction } from '@/types';

// §162 copy — assert the exact payload handed to the clipboard bridge instead
// of fighting jsdom's getter-only navigator.clipboard in this environment.
vi.mock('@/tauri/bridge', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));
const mockedCopyToClipboard = vi.mocked(copyToClipboard);

const HASH = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

function makeAction(overrides: Partial<AiAction> = {}): AiAction {
  return {
    id: 'act_gh_diff',
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
      pr_title: 'Add auth flow module',
      pr_description: 'Implements login + session refresh.',
      changed_files: [
        { path: 'src/auth/login.ts', additions: 120, deletions: 0 },
        { path: 'src/routes.ts', additions: 30, deletions: 6 },
      ],
      file_diffs: {
        'src/routes.ts': [
          '+ import { loginHandler } from "./auth/login";',
          '+ const route = "/api/v1/login";',
          '+ export const port = 8080;',
          '- const oldRoute = null; // removed',
          '  export { route };',
        ],
        // No hunks for login.ts → honest fallback must show.
      },
    },
    payload_hash: HASH,
    payload_version: 1,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeHunks(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `+ line ${i + 1}`);
}

function setup(action: AiAction | undefined, props: Partial<Parameters<typeof GitHubDiffViewer>[0]> = {}) {
  const onClose = vi.fn();
  const onApproveAndMerge = vi.fn();
  const user = userEvent.setup();
  render(
    <GitHubDiffViewer
      action={action}
      defaultBranch="main"
      mergeEnabled
      onClose={onClose}
      onApproveAndMerge={onApproveAndMerge}
      {...props}
    />
  );
  return { onClose, onApproveAndMerge, user };
}

describe('GitHubDiffViewer — §162 render', () => {
  it('renders header context, totals, and the hierarchical file tree', () => {
    setup(makeAction());
    expect(screen.getByText('PR: feat/auth-flow')).toBeInTheDocument();
    // Branch context line (h3 already covers the PR title above).
    expect(screen.getByText(/feat\/auth-flow.*→ main/)).toBeInTheDocument();
    expect(screen.getByText(/→ main/)).toBeInTheDocument();
    expect(screen.getByText('+150')).toBeInTheDocument(); // 120 + 30
    // Total deletions badge (the per-file −6 is asserted below within routes.ts).
    const totalsRow = screen.getByText('+150').parentElement!;
    expect(within(totalsRow).getByText('−6')).toBeInTheDocument();
    expect(screen.getByText('2 files changed')).toBeInTheDocument();

    // Tree groups directories first: src/ container exists, files listed.
    expect(screen.getByTestId('diff-file-tree')).toBeInTheDocument();
    expect(screen.getAllByTestId('diff-file')).toHaveLength(2);
    expect(screen.getByText('login.ts')).toBeInTheDocument();
    expect(screen.getByText('routes.ts')).toBeInTheDocument();
    // Per-file stats ride each file row.
    const routesRow = screen.getAllByTestId('diff-file').find((el) => el.textContent?.includes('routes.ts'))!;
    expect(within(routesRow).getByText('+30')).toBeInTheDocument();
    expect(within(routesRow).getByText('−6')).toBeInTheDocument();
  });

  it('shows inline hunks for files that carry them, with syntax highlighting', async () => {
    const { user } = setup(makeAction());
    // Expand routes.ts to reveal its hunks (all start expanded by default).
    const routesRow = screen.getAllByTestId('diff-file').find((el) => el.textContent?.includes('routes.ts'))!;
    expect(within(routesRow).getByText('import')).toBeInTheDocument(); // keyword token rendered
    expect(within(routesRow).getByText('"/api/v1/login"')).toBeInTheDocument(); // string token
    expect(within(routesRow).getByText('8080')).toBeInTheDocument(); // number token
    // Collapse then re-expand to confirm toggle wiring.
    await user.click(within(routesRow).getByRole('button'));
    expect(within(routesRow).queryByText('"/api/v1/login"')).not.toBeInTheDocument();
    await user.click(within(routesRow).getByRole('button'));
    expect(within(routesRow).getByText('"/api/v1/login"')).toBeInTheDocument();
  });

  it('degrades honestly for files without line-level data', () => {
    setup(makeAction());
    const loginRow = screen.getAllByTestId('diff-file').find((el) => el.textContent?.includes('login.ts'))!;
    expect(
      within(loginRow).getByText(/Line-level changes not available for this file/),
    ).toBeInTheDocument();
  });

  it('collapses long hunks behind "Show N more lines" (§162 hunk collapse)', async () => {
    const action = makeAction();
    action.payload.file_diffs = { 'src/routes.ts': makeHunks(12) };
    const { user } = setup(action);
    const row = screen.getAllByTestId('diff-file').find((el) => el.textContent?.includes('routes.ts'))!;
    // Hunks render through syntax-highlighted child spans, so getByText can't
    // match a multi-token line. Match the code span's exact textContent —
    // substring checks on the row text would false-positive via the interleaved
    // line-number digits (e.g. "+ line 1" + line-number "2" → "+ line 12").
    const hasCodeLine = (n: number) =>
      Array.from(row.querySelectorAll('span')).some((el) => el.textContent === `+ line ${n}`);
    expect(hasCodeLine(1)).toBe(true);
    expect(hasCodeLine(9)).toBe(false);
    await user.click(within(row).getByRole('button', { name: /show 4 more lines/i }));
    expect(hasCodeLine(12)).toBe(true);
    await user.click(within(row).getByRole('button', { name: /collapse lines/i }));
    expect(hasCodeLine(12)).toBe(false);
  });

  it('copies every visible hunk line via the clipboard', async () => {
    mockedCopyToClipboard.mockClear();
    const { user } = setup(makeAction());
    await user.click(screen.getByRole('button', { name: /copy diff/i }));
    // "Copied" only appears after copyToClipboard resolves, so await it to
    // confirm the async copy chain ran before asserting on the mock's calls.
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    expect(mockedCopyToClipboard).toHaveBeenCalledTimes(1);
    const copied = mockedCopyToClipboard.mock.calls[0]![0] as string;
    expect(copied.split('\n')).toHaveLength(5); // only routes.ts carries hunks
    expect(copied).toContain('+ const route = "/api/v1/login";');
  });

  it('PR preview reveals payload-driven title/description/SHAs only', async () => {
    const { user } = setup(makeAction());
    expect(screen.queryByText('Add auth flow module')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /pr preview/i }));
    expect(screen.getByText('Add auth flow module')).toBeInTheDocument();
    expect(screen.getByText('Implements login + session refresh.')).toBeInTheDocument();
    expect(screen.getByText(/base 3f9c2ab/)).toBeInTheDocument();
    expect(screen.getByText(/head c71de4f/)).toBeInTheDocument();
  });

  it('renders nothing without an action', () => {
    const { container } = render(
      <GitHubDiffViewer action={undefined} defaultBranch="main" onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('close button calls onClose', async () => {
    const { onClose, user } = setup(makeAction());
    await user.click(screen.getByRole('button', { name: /close diff viewer/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('empty payload degrades honestly instead of inventing content', () => {
    setup(makeAction({ payload: {} }));
    expect(screen.getByText(/No changed-file details are available/)).toBeInTheDocument();
  });
});

describe('GitHubDiffViewer — §164 high-impact merge dialog', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    warnSpy?.mockRestore();
  });

  it('mergeEnabled=false removes the Merge affordance entirely (§165A.2)', () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setup(makeAction(), { mergeEnabled: false });
    expect(screen.queryByRole('button', { name: /approve & merge/i })).not.toBeInTheDocument();
  });

  it('Approve & Merge opens the exact §164 dialog before anything executes', async () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { onApproveAndMerge, user } = setup(makeAction());
    await user.click(screen.getByRole('button', { name: /approve & merge/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Merge pull request')).toBeInTheDocument();
    expect(
      within(dialog).getByText('This changes the connected repository.'),
    ).toBeInTheDocument();
    expect(onApproveAndMerge).not.toHaveBeenCalled();

    // Cancel never merges.
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(onApproveAndMerge).not.toHaveBeenCalled();

    // Merge confirms exactly once.
    await user.click(screen.getByRole('button', { name: /approve & merge/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^merge$/i }));
    expect(onApproveAndMerge).toHaveBeenCalledTimes(1);
  });
});

describe('highlightLine — §162 syntax-highlighting basics', () => {
  it('colors strings, numbers and keywords distinctly', () => {
    const spans = highlightLine('const route = "/api/v1/login"; return 8080;');
    const textOf = (s: { text: string }) => s.text;
    expect(spans.map(textOf).join('')).toBe('const route = "/api/v1/login"; return 8080;');

    const keyword = spans.find((s) => s.text === 'const');
    expect(keyword?.color).toBe('var(--color-info)');
    expect(keyword?.bold).toBe(true);

    const str = spans.find((s) => s.text === '"/api/v1/login"');
    expect(str?.color).toBe('var(--color-success)');

    const num = spans.find((s) => s.text === '8080');
    expect(num?.color).toBe('var(--color-info)');

    // Plain identifiers stay unstyled.
    expect(spans.find((s) => s.text === 'route')?.color).toBeUndefined();
  });

  it('renders whole-line comments in the muted color', () => {
    const spans = highlightLine('// removed old route');
    expect(spans).toHaveLength(1);
    expect(spans[0]!.color).toBe('var(--color-text-tertiary)');
  });

  it('highlights preprocessor directives (#include)', () => {
    const spans = highlightLine('#include "spi_dma.h"');
    const directive = spans.find((s) => s.text === '#include');
    expect(directive?.bold).toBe(true);
    expect(directive?.color).toBe('var(--color-warning)');
  });
});
