import { create } from 'zustand';
import type {
  MeetingCandidate,
  MeetingCandidateStatus,
  MeetingSession,
} from '@/types';

/**
 * Meeting state (FE §123/§124/§124A, BE §50/§50A).
 *
 * `currentSession` is the SERVER row (BE §50) — the §123 header timer and
 * `isMeetingPaused` (§213 matrix "paused") are client-derived presentations;
 * the backend status enum is only ACTIVE|ENDED. `candidates` is the session's
 * §50A trail; live notes (§124 "Live notes") have no backend column and stay
 * client-held for the session (D23).
 */
export interface MeetingState {
  currentSession: MeetingSession | null;
  /** §50A candidates for the current session, newest first. */
  candidates: MeetingCandidate[];
  isMeetingActive: boolean;
  isMeetingPaused: boolean;
  elapsedSeconds: number;
  /** §124 Live notes — client-held during the session. */
  liveNotes: string[];
  isStartDialogOpen: boolean;
  isEndSummaryDialogOpen: boolean;

  setSession: (session: MeetingSession) => void;
  setCandidates: (candidates: MeetingCandidate[]) => void;
  addCandidate: (candidate: MeetingCandidate) => void;
  patchCandidate: (id: string, patch: Partial<MeetingCandidate>) => void;
  pauseMeeting: () => void;
  resumeMeeting: () => void;
  tickTimer: () => void;
  addLiveNote: (note: string) => void;
  /**
   * §127 — user pressed End: open the summary review while the session is
   * still ACTIVE server-side; only POST /end (Review & Save) retires it.
   */
  beginEnding: () => void;
  /** Server confirmed the end — retire the active surface. */
  finishEnding: () => void;
  resetMeeting: () => void;
  setStartDialogOpen: (open: boolean) => void;
  setEndSummaryDialogOpen: (open: boolean) => void;
}

const INITIAL = {
  currentSession: null,
  candidates: [] as MeetingCandidate[],
  isMeetingActive: false,
  isMeetingPaused: false,
  elapsedSeconds: 0,
  liveNotes: [] as string[],
  isStartDialogOpen: false,
  isEndSummaryDialogOpen: false,
};

export const useMeetingStore = create<MeetingState>((set) => ({
  ...INITIAL,

  setSession: (session) =>
    set({
      currentSession: session,
      isMeetingActive: session.status === 'ACTIVE',
      isStartDialogOpen: false,
    }),

  setCandidates: (candidates) => set({ candidates }),

  addCandidate: (candidate) =>
    set((state) => ({ candidates: [candidate, ...state.candidates] })),

  patchCandidate: (id, patch) =>
    set((state) => ({
      candidates: state.candidates.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  pauseMeeting: () => set({ isMeetingPaused: true }),

  resumeMeeting: () => set({ isMeetingPaused: false }),

  tickTimer: () =>
    set((state) => (state.isMeetingActive && !state.isMeetingPaused
      ? { elapsedSeconds: state.elapsedSeconds + 1 }
      : {})),

  addLiveNote: (note) =>
    set((state) => ({ liveNotes: [...state.liveNotes, note] })),

  beginEnding: () => set({ isEndSummaryDialogOpen: true }),

  finishEnding: () =>
    set((state) => ({
      isMeetingActive: false,
      isMeetingPaused: false,
      currentSession: state.currentSession
        ? { ...state.currentSession, status: 'ENDED', ended_at: new Date().toISOString() }
        : null,
    })),

  resetMeeting: () => set(INITIAL),

  setStartDialogOpen: (isStartDialogOpen) => set({ isStartDialogOpen }),
  setEndSummaryDialogOpen: (isEndSummaryDialogOpen) => set({ isEndSummaryDialogOpen }),
}));

/** Convenience selector — statuses are compared as the §50A union. */
export function isActiveCandidate(status: MeetingCandidateStatus): boolean {
  return status === 'PENDING';
}
