/**
 * P9 — §126 Start / §127 End dialog contracts.
 *
 * The start dialog MUST hit the real §112 endpoint (`POST
 * /projects/:projectId/meetings`) and refuse to start without a Project
 * context (sessions are project-scoped server-side). The end dialog keeps
 * the meeting ACTIVE until Review & Save resolves (§213), runs the §124A.3
 * explicit-skip review, and passes the user's §128 artifact choice through.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/design-system/components/Toast';
import { MeetingStartDialog, MeetingEndSummaryDialog } from '@/features/meetings/MeetingDialogs';
import { useMeetingStore } from '@/state/useMeetingStore';
import { useGroupStore } from '@/state/useGroupStore';
import type { MeetingCandidate, MeetingSession } from '@/types';

const SESSION: MeetingSession = {
  id: 'meet_test_1',
  group_id: 'grp_1',
  project_id: 'proj_1',
  started_by: 'user_1',
  started_at: new Date().toISOString(),
  ended_at: null,
  status: 'ACTIVE',
  summary_artifact_id: null,
};

vi.mock('@/api/endpoints/meetings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints/meetings')>();
  return {
    ...actual,
    startProjectMeeting: vi.fn(async () => ({ ...SESSION })),
  };
});

import { startProjectMeeting } from '@/api/endpoints/meetings';

function candidate(overrides: Partial<MeetingCandidate>): MeetingCandidate {
  return {
    id: `mc_${Math.random().toString(36).slice(2)}`,
    meeting_session_id: 'meet_test_1',
    candidate_type: 'DECISION',
    content: { title: 'Lock SPI bus at CPOL=0' },
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

function renderWithProviders(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('MeetingStartDialog — §126', () => {
  beforeEach(() => {
    useMeetingStore.getState().resetMeeting();
    useGroupStore.setState({ activeGroup: { id: 'grp_1', name: 'G' } as never, activeProject: null });
    vi.clearAllMocks();
  });

  it('starts through POST /projects/:id/meetings and adopts the server session row', async () => {
    useGroupStore.setState({
      activeProject: { id: 'proj_flight_ctrl' } as never,
    });
    renderWithProviders(<MeetingStartDialog />);
    useMeetingStore.getState().setStartDialogOpen(true);

    await userEvent.click(await screen.findByRole('button', { name: /start meeting/i }));

    await waitFor(() => {
      expect(startProjectMeeting).toHaveBeenCalledWith('proj_flight_ctrl');
      const state = useMeetingStore.getState();
      expect(state.isMeetingActive).toBe(true);
      expect(state.currentSession?.id).toBe('meet_test_1');
      // The SERVER row is authoritative — status ACTIVE comes from the wire.
      expect(state.currentSession?.status).toBe('ACTIVE');
    });
    // Dialog closes on success.
    expect(useMeetingStore.getState().isStartDialogOpen).toBe(false);
  });

  it('never starts without a Project context (§112 sessions are project-scoped)', async () => {
    useGroupStore.setState({ activeProject: null });
    renderWithProviders(<MeetingStartDialog />);
    useMeetingStore.getState().setStartDialogOpen(true);

    await userEvent.click(await screen.findByRole('button', { name: /start meeting/i }));

    expect(startProjectMeeting).not.toHaveBeenCalled();
    expect(useMeetingStore.getState().isMeetingActive).toBe(false);
    // Still in the dialog — the user can pick a project and retry.
    expect(useMeetingStore.getState().isStartDialogOpen).toBe(true);
  });

  it('a failed start leaves the meeting inactive with the dialog open for retry', async () => {
    vi.mocked(startProjectMeeting).mockRejectedValueOnce(new Error('NETWORK'));
    useGroupStore.setState({ activeProject: { id: 'proj_x' } as never });
    renderWithProviders(<MeetingStartDialog />);
    useMeetingStore.getState().setStartDialogOpen(true);

    await userEvent.click(await screen.findByRole('button', { name: /start meeting/i }));

    await waitFor(() => {
      expect(useMeetingStore.getState().isMeetingActive).toBe(false);
      expect(useMeetingStore.getState().isStartDialogOpen).toBe(true);
    });
  });
});

describe('MeetingEndSummaryDialog — §127/§124A.3/§128', () => {
  beforeEach(() => {
    useMeetingStore.getState().resetMeeting();
    useMeetingStore.setState({
      currentSession: { ...SESSION },
      isMeetingActive: true,
      isEndSummaryDialogOpen: true,
      candidates: [],
      liveNotes: ['Note one'],
    });
  });

  it('shows §127 counts over confirmed + still-open candidates', () => {
    useMeetingStore.setState({
      candidates: [
        candidate({ candidate_type: 'DECISION', status: 'ACCEPTED' }),
        candidate({ candidate_type: 'TASK', status: 'PENDING' }),
        candidate({ candidate_type: 'OPEN_QUESTION', status: 'PENDING' }),
        candidate({ candidate_type: 'RESEARCH_NEED', status: 'ACCEPTED' }),
      ],
    });
    renderWithProviders(
      <MeetingEndSummaryDialog onAcceptCandidate={vi.fn()} onEndMeeting={vi.fn(async () => true)} />,
    );
    expect(screen.getByText('Decisions')).toBeInTheDocument();
    const numbers = screen.getAllByText(/^1$/).length;
    // Decisions=1, Tasks=1, Questions=1, Research=1 → four "1" tiles.
    expect(numbers).toBe(4);
  });

  it('explicit Skip transitions a PENDING candidate to EXPIRED before the end posts (§124A.3)', async () => {
    const cand = candidate({ candidate_type: 'OPEN_QUESTION', content: { title: 'Unresolved q' } });
    useMeetingStore.setState({ candidates: [cand] });
    renderWithProviders(
      <MeetingEndSummaryDialog onAcceptCandidate={vi.fn()} onEndMeeting={vi.fn(async () => true)} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /skip/i }));
    const stored = useMeetingStore.getState().candidates.find((c) => c.id === cand.id);
    expect(stored?.status).toBe('EXPIRED');
    expect(stored?.resolved_at).not.toBeNull();
  });

  it('Save inside the review promotes only through onAcceptCandidate (real endpoint path)', async () => {
    const cand = candidate({ candidate_type: 'TASK', content: { title: 'Wire telemetry' } });
    useMeetingStore.setState({ candidates: [cand] });
    const onAcceptCandidate = vi.fn(async () => {});
    renderWithProviders(
      <MeetingEndSummaryDialog onAcceptCandidate={onAcceptCandidate} onEndMeeting={vi.fn(async () => true)} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onAcceptCandidate).toHaveBeenCalledWith(cand);
  });

  it('Review & Save posts the trimmed summary text and the §128 artifact choice', async () => {
    const onEndMeeting = vi.fn(async (_text: string, saveArtifact: boolean) => {
      expect(saveArtifact).toBe(true);
      return true;
    });
    renderWithProviders(
      <MeetingEndSummaryDialog onAcceptCandidate={vi.fn()} onEndMeeting={onEndMeeting} />,
    );
    await userEvent.type(screen.getByRole('textbox', { name: /^summary/i }), '  Locked the SPI bus config.  ');
    await userEvent.click(screen.getByRole('button', { name: /review & save/i }));
    await waitFor(() => {
      expect(onEndMeeting).toHaveBeenCalledWith('Locked the SPI bus config.', true);
    });
    expect(useMeetingStore.getState().isEndSummaryDialogOpen).toBe(false);
  });

  it('an unsuccessful end (server error) keeps the dialog open and the meeting ACTIVE', async () => {
    const onEndMeeting = vi.fn(async () => false);
    renderWithProviders(
      <MeetingEndSummaryDialog onAcceptCandidate={vi.fn()} onEndMeeting={onEndMeeting} />,
    );
    await userEvent.type(screen.getByRole('textbox', { name: /^summary/i }), 'Summary text');
    await userEvent.click(screen.getByRole('button', { name: /review & save/i }));
    await waitFor(() => {
      expect(useMeetingStore.getState().isMeetingActive).toBe(true);
      expect(useMeetingStore.getState().currentSession?.status).toBe('ACTIVE');
    });
  });

  it('unchecking the §128 box asks the caller not to create the Garage artifact', async () => {
    const onEndMeeting = vi.fn(async (_t: string, saveArtifact: boolean) => {
      expect(saveArtifact).toBe(false);
      return true;
    });
    renderWithProviders(
      <MeetingEndSummaryDialog onAcceptCandidate={vi.fn()} onEndMeeting={onEndMeeting} />,
    );
    await userEvent.type(screen.getByRole('textbox', { name: /^summary/i }), 'Short recap.');
    await userEvent.click(screen.getByLabelText(/save summary to garage/i));
    await userEvent.click(screen.getByRole('button', { name: /review & save/i }));
    await waitFor(() => expect(onEndMeeting).toHaveBeenCalledTimes(1));
  });
});
