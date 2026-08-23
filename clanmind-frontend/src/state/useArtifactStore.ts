import { create } from 'zustand';
import type { Artifact, AiRun, AiRunStatus, RightPanelMode } from '@/types';

/** Per-artifact AI run status — tracks live generation / approval */
export interface ArtifactRunInfo {
  /** The artifact id this run is for */
  artifactId: string;
  runId: string;
  status: AiRunStatus;
  /** Whether the AI wants to commit changes and is waiting for user approval */
  approvalPending: boolean;
}

export interface ArtifactState {
  artifacts: Artifact[];
  activeArtifact: Artifact | null;
  activeVersionNumber: number;
  compareVersionNumber: number | null;
  rightPanelMode: RightPanelMode;
  /** Per-artifact run status keyed by artifactId */
  aiRunByArtifact: Record<string, ArtifactRunInfo>;
  /** §134A — AI runs keyed by the AI message id they render under */
  aiRunsByMessage: Record<string, AiRun>;

  setActiveArtifact: (artifact: Artifact | null) => void;
  setActiveVersionNumber: (version: number) => void;
  setCompareVersionNumber: (version: number | null) => void;
  setRightPanelMode: (mode: RightPanelMode) => void;
  toggleArtifactPin: (artifactId: string) => void;
  toggleArtifactContext: (artifactId: string) => void;
  addArtifact: (artifact: Artifact) => void;
  openArtifactPanel: (artifact: Artifact) => void;
  closeRightPanel: () => void;
  /** Track a live AI run for an artifact */
  setArtifactRunStatus: (info: ArtifactRunInfo) => void;
  /** Clear run status when run completes or is dismissed */
  clearArtifactRunStatus: (artifactId: string) => void;
  /** Approve a pending AI change for the given artifact */
  approveArtifactChange: (artifactId: string) => void;
  /** Reject a pending AI change for the given artifact */
  rejectArtifactChange: (artifactId: string) => void;
  /** §134A — register/update the run driving an AI message */
  setAiRunByMessage: (messageId: string, run: AiRun) => void;
}

// �11 � no runtime fixtures; demo hydration (src/mocks/dataset.ts) or live
// artifact queries populate the store.
export const useArtifactStore = create<ArtifactState>((set) => ({
  artifacts: [],
  activeArtifact: null,
  activeVersionNumber: 1,
  compareVersionNumber: null,
  rightPanelMode: 'closed',
  aiRunByArtifact: {},
  aiRunsByMessage: {},

  setActiveArtifact: (artifact) =>
    set({
      activeArtifact: artifact,
      activeVersionNumber: artifact ? artifact.current_version : 1,
      compareVersionNumber: null,
      rightPanelMode: artifact ? 'artifact' : 'closed',
    }),
  setActiveVersionNumber: (version) => set({ activeVersionNumber: version }),
  setCompareVersionNumber: (version) => set({ compareVersionNumber: version }),
  setRightPanelMode: (mode) => set({ rightPanelMode: mode }),

  toggleArtifactPin: (artifactId) =>
    set((state) => ({
      artifacts: state.artifacts.map((a) =>
        a.id === artifactId ? { ...a, pinned: !a.pinned } : a
      ),
      activeArtifact:
        state.activeArtifact?.id === artifactId
          ? { ...state.activeArtifact, pinned: !state.activeArtifact.pinned }
          : state.activeArtifact,
    })),

  toggleArtifactContext: (artifactId) =>
    set((state) => ({
      artifacts: state.artifacts.map((a) =>
        a.id === artifactId
          ? { ...a, used_as_context: !a.used_as_context }
          : a
      ),
      activeArtifact:
        state.activeArtifact?.id === artifactId
          ? {
              ...state.activeArtifact,
              used_as_context: !state.activeArtifact.used_as_context,
            }
          : state.activeArtifact,
    })),

  addArtifact: (artifact) =>
    set((state) => ({
      artifacts: [artifact, ...state.artifacts],
      activeArtifact: artifact,
      activeVersionNumber: artifact.current_version,
      rightPanelMode: 'artifact',
    })),

  openArtifactPanel: (artifact) =>
    set({
      activeArtifact: artifact,
      activeVersionNumber: artifact.current_version,
      compareVersionNumber: null,
      rightPanelMode: 'artifact',
    }),

  closeRightPanel: () => set({ rightPanelMode: 'closed' }),

  setArtifactRunStatus: (info) =>
    set((state) => ({
      aiRunByArtifact: { ...state.aiRunByArtifact, [info.artifactId]: info },
    })),

  clearArtifactRunStatus: (artifactId) =>
    set((state) => {
      const next = { ...state.aiRunByArtifact };
      delete next[artifactId];
      return { aiRunByArtifact: next };
    }),

  approveArtifactChange: (artifactId) =>
    set((state) => {
      const existing = state.aiRunByArtifact[artifactId];
      if (!existing) return {};
      return {
        aiRunByArtifact: {
          ...state.aiRunByArtifact,
          [artifactId]: { ...existing, approvalPending: false, status: 'RUNNING' },
        },
      };
    }),

  rejectArtifactChange: (artifactId) =>
    set((state) => {
      const next = { ...state.aiRunByArtifact };
      delete next[artifactId];
      return { aiRunByArtifact: next };
    }),

  setAiRunByMessage: (messageId, run) =>
    set((state) => ({
      aiRunsByMessage: { ...state.aiRunsByMessage, [messageId]: run },
    })),
}));
