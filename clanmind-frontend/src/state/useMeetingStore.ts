import { create } from 'zustand';
import type { MeetingCandidate, MeetingSession, MemoryCandidateStatus } from '@/types';

export interface MeetingState {
  currentSession: MeetingSession | null;
  isMeetingActive: boolean;
  isMeetingPaused: boolean;
  elapsedSeconds: number;
  isStartDialogOpen: boolean;
  isEndSummaryDialogOpen: boolean;
  timerIntervalId: number | null;

  startMeeting: (groupId: string, projectId: string) => void;
  pauseMeeting: () => void;
  resumeMeeting: () => void;
  endMeeting: () => void;
  tickTimer: () => void;
  addLiveNote: (note: string) => void;
  addCandidate: (candidate: MeetingCandidate) => void;
  updateCandidateStatus: (
    id: string,
    status: MemoryCandidateStatus,
    promotedTo?: { type: 'DECISION' | 'TASK'; id: string }
  ) => void;
  /** §124A.2 — bring a dismissed candidate back to the active panel */
  restoreCandidate: (id: string) => void;
  setStartDialogOpen: (open: boolean) => void;
  setEndSummaryDialogOpen: (open: boolean) => void;
}

// §11 — candidates arrive from the meeting pipeline (BE §50A) or demo
// hydration; no runtime fixtures.
const INITIAL_CANDIDATES: MeetingCandidate[] = [];

export const useMeetingStore = create<MeetingState>((set, get) => ({
  currentSession: null,
  isMeetingActive: false,
  isMeetingPaused: false,
  elapsedSeconds: 0,
  isStartDialogOpen: false,
  isEndSummaryDialogOpen: false,
  timerIntervalId: null,

  startMeeting: (groupId, projectId) => {
    const session: MeetingSession = {
      id: `meet_${Date.now()}`,
      group_id: groupId,
      project_id: projectId,
      started_at: new Date().toISOString(),
      is_active: true,
      is_paused: false,
      elapsed_seconds: 0,
      live_notes: [],
      candidates: [...INITIAL_CANDIDATES],
    };
    set({
      currentSession: session,
      isMeetingActive: true,
      isMeetingPaused: false,
      elapsedSeconds: 0,
      isStartDialogOpen: false,
    });
  },

  pauseMeeting: () =>
    set((state) => ({
      isMeetingPaused: true,
      currentSession: state.currentSession
        ? { ...state.currentSession, is_paused: true }
        : null,
    })),

  resumeMeeting: () =>
    set((state) => ({
      isMeetingPaused: false,
      currentSession: state.currentSession
        ? { ...state.currentSession, is_paused: false }
        : null,
    })),

  endMeeting: () => {
    set({
      isMeetingActive: false,
      isMeetingPaused: false,
      isEndSummaryDialogOpen: true,
    });
  },

  tickTimer: () => {
    const { isMeetingActive, isMeetingPaused, elapsedSeconds, currentSession } = get();
    if (isMeetingActive && !isMeetingPaused) {
      const nextSeconds = elapsedSeconds + 1;
      set({
        elapsedSeconds: nextSeconds,
        currentSession: currentSession
          ? { ...currentSession, elapsed_seconds: nextSeconds }
          : null,
      });
    }
  },

  addLiveNote: (note) =>
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            live_notes: [...state.currentSession.live_notes, note],
          }
        : null,
    })),

  addCandidate: (candidate) =>
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            candidates: [candidate, ...state.currentSession.candidates],
          }
        : null,
    })),

  updateCandidateStatus: (id, status, promotedTo) =>
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            candidates: state.currentSession.candidates.map((c) =>
              c.id === id
                ? {
                    ...c,
                    status,
                    promoted_to_type: promotedTo?.type || c.promoted_to_type,
                    promoted_to_id: promotedTo?.id || c.promoted_to_id,
                  }
                : c
            ),
          }
        : null,
    })),

  restoreCandidate: (id) =>
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            candidates: state.currentSession.candidates.map((c) =>
              c.id === id && c.status === 'REJECTED'
                ? { ...c, status: 'PENDING' }
                : c
            ),
          }
        : null,
    })),

  setStartDialogOpen: (isStartDialogOpen) => set({ isStartDialogOpen }),
  setEndSummaryDialogOpen: (isEndSummaryDialogOpen) => set({ isEndSummaryDialogOpen }),
}));
