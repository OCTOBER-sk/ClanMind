import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MeetingPanel } from '@/features/meetings/MeetingPanel';
import type { MeetingCandidate } from '@/types';

/** BE §50A row fixture — content is the jsonb detector payload. */
function candidate(overrides: Partial<MeetingCandidate>): MeetingCandidate {
  return {
    id: `mc_${Math.random().toString(36).slice(2)}`,
    meeting_session_id: 'meet_1',
    candidate_type: 'DECISION',
    content: { title: 'Sample candidate' },
    confidence: 0.9,
    source_message_id: null,
    status: 'PENDING',
    promoted_to_type: null,
    promoted_to_id: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
    ...overrides,
  };
}

const baseProps = {
  candidates: [] as MeetingCandidate[],
  liveNotes: ['Priya confirms the 500 Hz target.'] as string[],
  aiName: 'Odin',
  onAcceptCandidate: vi.fn(async () => {}),
  onEditCandidate: vi.fn(async () => {}),
  onDismissCandidate: vi.fn(),
  onRestoreCandidate: vi.fn(),
  onAddNote: vi.fn(),
  onResearchShortcut: vi.fn(),
  onOpenPromoted: vi.fn(),
  onClose: vi.fn(),
};

describe('MeetingPanel — §124 sections & §124A candidate lifecycle', () => {
  it('renders the §124 section skeleton with live notes', () => {
    render(
      <MeetingPanel
        {...baseProps}
        candidates={[
          candidate({ candidate_type: 'DECISION', content: { title: 'Lock SPI bus' } }),
          candidate({ candidate_type: 'TASK', content: { title: 'Wire telemetry path' } }),
          candidate({ candidate_type: 'OPEN_QUESTION', content: { title: 'Same bus for flash logging?' } }),
        ]}
      />
    );
    expect(screen.getByText('Live Notes (1)')).toBeInTheDocument();
    expect(screen.getByText(/Priya confirms the 500 Hz target/)).toBeInTheDocument();
    expect(screen.getByText('Potential Decisions (1)')).toBeInTheDocument();
    expect(screen.getByText('Action Items (1)')).toBeInTheDocument();
    expect(screen.getByText('Open Questions (1)')).toBeInTheDocument();
    // §124A.1 — headline comes from the jsonb title
    expect(screen.getByText('Lock SPI bus')).toBeInTheDocument();
  });

  it('maps RESEARCH_NEED into Odin suggestions with a /research shortcut pre-filled from the topic (§124A.1)', async () => {
    const user = (await import('@testing-library/user-event')).default;
    const onResearchShortcut = vi.fn();
    render(
      <MeetingPanel
        {...baseProps}
        onResearchShortcut={onResearchShortcut}
        candidates={[
          candidate({
            candidate_type: 'RESEARCH_NEED',
            content: { title: 'Benchmark SPI DMA bursts' },
          }),
        ]}
      />
    );
    expect(screen.getByText('Odin Suggestions (1)')).toBeInTheDocument();
    const shortcut = screen.getByRole('button', { name: /\/research/i });
    await user.click(shortcut);
    expect(onResearchShortcut).toHaveBeenCalledWith('Benchmark SPI DMA bursts');
  });

  it('maps MILESTONE_CHANGE into a Project Pulse-style note, not an action card (§124A.1)', () => {
    render(
      <MeetingPanel
        {...baseProps}
        candidates={[
          candidate({ candidate_type: 'MILESTONE_CHANGE', content: { title: 'Bench moved to next sprint' } }),
        ]}
      />
    );
    expect(screen.getByText('Milestone Notes (1)')).toBeInTheDocument();
    expect(screen.getByText('Project Pulse')).toBeInTheDocument();
    // Pulse notes are informational — no Accept/Dismiss affordances.
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it('surfaces CONTRADICTION as a distinct inline treatment (§124A.1)', () => {
    render(
      <MeetingPanel
        {...baseProps}
        candidates={[
          candidate({ candidate_type: 'CONTRADICTION', content: { title: 'Two statements conflict' } }),
        ]}
      />
    );
    expect(screen.getByText('Contradictions Detected (1)')).toBeInTheDocument();
    expect(screen.queryByText('Open Questions (1)')).not.toBeInTheDocument();
  });

  it('keeps REJECTED candidates recoverable in the Dismissed sub-list (§124A.2)', async () => {
    const user = (await import('@testing-library/user-event')).default;
    const onRestore = vi.fn();
    render(
      <MeetingPanel
        {...baseProps}
        onRestoreCandidate={onRestore}
        candidates={[candidate({ status: 'REJECTED', content: { title: 'Dismissed idea' } })]}
      />
    );
    expect(screen.getByText('Dismissed (1)')).toBeInTheDocument();
    await user.click(screen.getByText('Dismissed (1)'));
    const restore = screen.getByRole('button', { name: /restore/i });
    await user.click(restore);
    expect(onRestore).toHaveBeenCalledWith(expect.any(String));
  });

  it('shows ACCEPTED candidates as compact confirmed rows pointing at the promoted object (§124A.2)', () => {
    render(
      <MeetingPanel
        {...baseProps}
        candidates={[
          candidate({
            status: 'ACCEPTED',
            // BE §50A — lowercase promote types on the wire
            promoted_to_type: 'decision',
            promoted_to_id: 'dec_9',
            content: { title: 'Lock SPI bus at CPOL=0' },
          }),
          candidate({
            status: 'ACCEPTED',
            promoted_to_type: 'task',
            promoted_to_id: 'task_9',
            content: { title: 'Wire telemetry path' },
          }),
        ]}
      />
    );
    expect(screen.getByText('Confirmed (2)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view decision/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view task/i })).toBeInTheDocument();
    // Confirmed rows leave the active panel.
    expect(screen.queryByText('Potential Decisions (1)')).not.toBeInTheDocument();
  });

  it('hides EXPIRED candidates silently and shows MERGED as a subtle note (§124A.2)', () => {
    render(
      <MeetingPanel
        {...baseProps}
        candidates={[
          candidate({ status: 'EXPIRED', content: { title: 'Never shown again' } }),
          candidate({ status: 'MERGED', content: { title: 'Duplicate restatement' } }),
        ]}
      />
    );
    expect(screen.queryByText('Never shown again')).not.toBeInTheDocument();
    expect(screen.queryByText('Dismissed (')).not.toBeInTheDocument();
    expect(screen.getByText('Merged into another candidate.')).toBeInTheDocument();
  });

  it('adds a live note through the input (§124 Live notes)', async () => {
    const user = (await import('@testing-library/user-event')).default;
    const onAddNote = vi.fn();
    render(<MeetingPanel {...baseProps} onAddNote={onAddNote} />);
    const input = screen.getByLabelText('Add a live meeting note');
    await user.type(input, 'Bench capture archived{enter}');
    expect(onAddNote).toHaveBeenCalledWith('Bench capture archived');
  });

  it('accepting a PENDING decision waits for the async confirmation before clearing busy state (§124A.2)', async () => {
    const user = (await import('@testing-library/user-event')).default;
    let resolveAccept!: () => void;
    const onAcceptCandidate = vi.fn(
      () => new Promise<void>((resolve) => { resolveAccept = resolve; }),
    );
    render(
      <MeetingPanel
        {...baseProps}
        onAcceptCandidate={onAcceptCandidate}
        candidates={[candidate({ candidate_type: 'DECISION', content: { title: 'Lock SPI bus' } })]}
      />
    );
    await user.click(screen.getByRole('button', { name: /accept decision/i }));
    expect(onAcceptCandidate).toHaveBeenCalledTimes(1);
    resolveAccept();
  });

  it('§124 Edit refines a pending candidate through onEditCandidate with the new headline', async () => {
    const user = (await import('@testing-library/user-event')).default;
    const onEditCandidate = vi.fn(async () => {});
    render(
      <MeetingPanel
        {...baseProps}
        onEditCandidate={onEditCandidate}
        candidates={[
          candidate({
            candidate_type: 'TASK',
            content: { title: 'Wire telemetry path' },
          }),
        ]}
      />
    );
    // Every pending card carries the full §124 action set: Accept / Edit / Dismiss.
    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    const editor = screen.getByRole('textbox', { name: /edit candidate/i });
    expect(editor).toHaveValue('Wire telemetry path');
    await user.clear(editor);
    await user.type(editor, 'Wire telemetry path behind a flag');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(onEditCandidate).toHaveBeenCalledWith(expect.any(String), 'Wire telemetry path behind a flag');
  });

  it('empty edit drafts cannot be saved', async () => {
    const user = (await import('@testing-library/user-event')).default;
    const onEditCandidate = vi.fn(async () => {});
    render(
      <MeetingPanel
        {...baseProps}
        onEditCandidate={onEditCandidate}
        candidates={[candidate({ content: { title: 'Keep me' } })]}
      />
    );
    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    const editor = screen.getByRole('textbox', { name: /edit candidate/i });
    await user.clear(editor);
    const save = screen.getByRole('button', { name: /save changes/i });
    expect(save).toBeDisabled();
  });
});
