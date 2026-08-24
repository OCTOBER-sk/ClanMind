/**
 * P13 accessibility pass — CommandPalette dialog semantics (§61/§63/§66/§8).
 *
 * The palette is a modal dialog: it must be named, trap Tab while open,
 * close on Escape, and restore focus to the trigger when it closes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from './CommandPalette';
import type { Project, Artifact, Task, Decision } from '@/types';

const project = {
  id: 'p1', group_id: 'g1', name: 'Rover', project_type: 'BUILD',
  status: 'ACTIVE', pulse_progress: 40,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
} as unknown as Project;

const artifact = {
  id: 'a1', project_id: 'p1', title: 'Architecture diagram',
  artifact_type: 'DIAGRAM', current_version: 2, pinned: false,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
} as unknown as Artifact;

const task = {
  id: 't1', project_id: 'p1', title: 'Ship chassis', status: 'TODO',
  priority: 'HIGH', version: 1,
} as unknown as Task;

const decision = {
  id: 'd1', project_id: 'p1', title: 'Use CAN bus', status: 'PROPOSED', version: 1,
} as unknown as Decision;

function renderPalette(open: boolean, onOpenChange = vi.fn()) {
  const props = {
    open,
    onOpenChange,
    projects: [project],
    artifacts: [artifact],
    tasks: [task],
    decisions: [decision],
    onSelectProject: vi.fn(),
    onSelectArtifact: vi.fn(),
    onSelectAction: vi.fn(),
  };
  const view = render(
    <div>
      <button type="button" data-testid="trigger">Open palette</button>
      <CommandPalette {...props} />
    </div>,
  );
  return { ...view, onOpenChange };
}

describe('CommandPalette — §66 accessible dialog behavior', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // Focus starts on the trigger in real usage.
    document.body.focus();
  });

  it('renders role="dialog" with aria-modal and an accessible name (§66)', () => {
    renderPalette(true);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Search and commands');
  });

  it('moves initial focus into the palette input on open', () => {
    renderPalette(true);
    const input = screen.getByPlaceholderText(/Search ClanMind/i);
    expect(document.activeElement).toBe(input);
  });

  it('Escape closes via onOpenChange(false) (§63)', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderPalette(true);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Tab is TRAPPED inside the dialog — cycles from last item back to first (§66)', async () => {
    const user = userEvent.setup();
    renderPalette(true);
    const dialog = screen.getByRole('dialog');
    const focusablesInDialog = Array.from(
      dialog.querySelectorAll<HTMLElement>('input, [role="option"], button'),
    ).filter((el) => !el.hasAttribute('disabled'));

    expect(focusablesInDialog.length).toBeGreaterThan(0);

    // Walk forward past the LAST focusable element…
    for (let i = 0; i <= focusablesInDialog.length; i++) {
      await user.tab();
    }
    // …focus must still be inside the dialog (wrapped), never behind it.
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Shift+Tab from the first element wraps to the last, stays inside too.
    const input = screen.getByPlaceholderText(/Search ClanMind/i);
    input.focus();
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('restores focus to the pre-open trigger when closed (§66)', () => {
    const onOpenChange = vi.fn();
    const baseProps = {
      onOpenChange,
      projects: [project],
      artifacts: [artifact],
      tasks: [task],
      decisions: [decision],
      onSelectProject: vi.fn(),
      onSelectArtifact: vi.fn(),
      onSelectAction: vi.fn(),
    };

    // Closed first; the page's real trigger holds focus.
    const { rerender } = render(
      <>
        <button type="button" data-testid="page-trigger">Real page trigger</button>
        <CommandPalette {...baseProps} open={false} />
      </>,
    );
    screen.getByTestId('page-trigger').focus();

    // Open: focus must move into the palette…
    rerender(
      <>
        <button type="button" data-testid="page-trigger">Real page trigger</button>
        <CommandPalette {...baseProps} open={true} />
      </>,
    );
    const input = screen.getByPlaceholderText(/Search ClanMind/i);
    expect(document.activeElement).toBe(input);

    // …and close must hand focus back to the trigger.
    rerender(
      <>
        <button type="button" data-testid="page-trigger">Real page trigger</button>
        <CommandPalette {...baseProps} open={false} />
      </>,
    );
    expect(document.activeElement).toBe(screen.getByTestId('page-trigger'));
  });
});
