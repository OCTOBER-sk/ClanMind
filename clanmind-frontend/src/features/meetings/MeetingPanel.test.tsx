import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MeetingPanel } from '@/features/meetings/MeetingPanel';
import type { MeetingCandidate } from '@/types';

function candidate(overrides: Partial<MeetingCandidate>): MeetingCandidate {
  return {
    id: `mc_${Math.random().toString(36).slice(2)}`,
    meeting_id: 'm1',
    group_id: 'g1',
    project_id: 'p1',
    candidate_type: 'DECISION',
    status: 'PENDING',
    content: 'Sample candidate',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const baseProps = {
  candidates: [] as MeetingCandidate[],
  liveNotes: [] as string[],
  aiName: 'Odin',
  onAcceptCandidate: vi.fn(async () => {}),
  onDismissCandidate: vi.fn(),
  onRestoreCandidate: vi.fn(),
  onAddNote: vi.fn(),
  onResearchShortcut: vi.fn(),
  onOpenPromoted: vi.fn(),
  onClose: vi.fn(),
};

describe('MeetingPanel — §124A candidate lifecycle', () => {
  it('maps RESEARCH_NEED into Odin suggestions with a /research shortcut (§124A.1)', () => {
    render(
      <MeetingPanel
        {...baseProps}
        candidates={[candidate({ candidate_type: 'RESEARCH_NEED', content: 'Benchmark SPI DMA bursts' })]}
      />
    );
    expect(screen.getByText('Odin Suggestions (1)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\/research/i })).toBeInTheDocument();
  });

  it('maps MILESTONE_CHANGE into a Project Pulse-style note (§124A.1)', () => {
    render(
      <MeetingPanel
        {...baseProps}
        candidates={[candidate({ candidate_type: 'MILESTONE_CHANGE', content: 'Bench moved to next sprint' })]}
      />
    );
    expect(screen.getByText('Milestone Notes (1)')).toBeInTheDocument();
    expect(screen.getByText('Project Pulse')).toBeInTheDocument();
  });

  it('keeps REJECTED candidates recoverable in the Dismissed sub-list (§124A.2)', async () => {
    const user = (await import('@testing-library/user-event')).default;
    const onRestore = vi.fn();
    render(
      <MeetingPanel
        {...baseProps}
        onRestoreCandidate={onRestore}
        candidates={[candidate({ status: 'REJECTED', content: 'Dismissed idea' })]}
      />
    );
    expect(screen.getByText('Dismissed (1)')).toBeInTheDocument();
    await user.click(screen.getByText('Dismissed (1)'));
    const restore = screen.getByRole('button', { name: /restore/i });
    await user.click(restore);
    expect(onRestore).toHaveBeenCalled();
  });

  it('shows ACCEPTED candidates as compact confirmed rows (§124A.2)', () => {
    render(
      <MeetingPanel
        {...baseProps}
        candidates={[
          candidate({ status: 'ACCEPTED', promoted_to_type: 'DECISION', promoted_to_id: 'dec_9' }),
        ]}
      />
    );
    expect(screen.getByText('Confirmed (1)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view decision/i })).toBeInTheDocument();
  });
});