import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MainNavSection =
  | 'chat'
  | 'overview'
  | 'garage'
  | 'team'
  | 'tasks'
  | 'decisions'
  | 'context'
  | 'memory'
  | 'github'
  | 'settings'
  | 'activity';

export interface UiState {
  /** §11 UI preference — light / dark / follow the OS (resolved at render). */
  theme: 'light' | 'dark' | 'system';
  sidebarWidth: number; // default 240px
  rightPanelWidth: number; // default 460px
  isSidebarCollapsed: boolean;
  /** §193 — nav section lives in the URL, not in state. */
  isCommandPaletteOpen: boolean;
  isKeyboardHelpOpen: boolean;
  /** §69/§70: first-run onboarding finished for this account */
  onboardingComplete: boolean;
  /** §195 — last visited Group (restored on boot). */
  lastGroupId?: string;
  /**
   * §195/§305 — last active Project per Group. On a Group switch the Group's
   * own last Project is restored instead of resetting to none.
   */
  lastProjectIdByGroup: Record<string, string>;
  /** §15 — most-recently-visited Groups first in the switcher. */
  recentGroupIds: string[];
  /** §90 — Garage grid/list preference, remembered locally per device. */
  garageViewMode: 'grid' | 'list';
  isCreateGroupDialogOpen: boolean;
  isCreateProjectDialogOpen: boolean;
  isInviteDialogOpen: boolean;
  isTaskDialogOpen: boolean;
  isDecisionDialogOpen: boolean;
  isApprovalDialogOpen: boolean;
  isByokDialogOpen: boolean;

  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
  setSidebarWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setKeyboardHelpOpen: (open: boolean) => void;
  setOnboardingComplete: (complete: boolean) => void;
  /** §305 record the last Project seen inside a Group. */
  recordLastProject: (groupId: string, projectId: string) => void;
  /** §195 remember the Group currently being viewed. */
  recordLastGroup: (groupId: string) => void;
  /** §90 — persist the Garage view preference. */
  setGarageViewMode: (mode: 'grid' | 'list') => void;
  setCreateGroupDialogOpen: (open: boolean) => void;
  setCreateProjectDialogOpen: (open: boolean) => void;
  setInviteDialogOpen: (open: boolean) => void;
  setTaskDialogOpen: (open: boolean) => void;
  setDecisionDialogOpen: (open: boolean) => void;
  setApprovalDialogOpen: (open: boolean) => void;
  setByokDialogOpen: (open: boolean) => void;
}

// §195/§283: panel widths, theme and last nav section are local UI preferences
// persisted per device — not server state (§11).
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarWidth: 240,
      rightPanelWidth: 500,
      isSidebarCollapsed: false,
      isCommandPaletteOpen: false,
      isKeyboardHelpOpen: false,
      onboardingComplete: false,
      lastGroupId: undefined,
      lastProjectIdByGroup: {},
      recentGroupIds: [],
      garageViewMode: 'grid',
      isCreateGroupDialogOpen: false,
      isCreateProjectDialogOpen: false,
      isInviteDialogOpen: false,
      isTaskDialogOpen: false,
      isDecisionDialogOpen: false,
      isApprovalDialogOpen: false,
      isByokDialogOpen: false,

      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      setRightPanelWidth: (rightPanelWidth) => set({ rightPanelWidth }),
      setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),
      setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
      setKeyboardHelpOpen: (isKeyboardHelpOpen) => set({ isKeyboardHelpOpen }),
      setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
      recordLastProject: (groupId, projectId) =>
        set((state) => ({
          lastGroupId: groupId,
          lastProjectIdByGroup: { ...state.lastProjectIdByGroup, [groupId]: projectId },
          // §15 recents: most-recent first, deduplicated, capped at 12.
          recentGroupIds: [
            groupId,
            ...state.recentGroupIds.filter((id) => id !== groupId),
          ].slice(0, 12),
        })),
      recordLastGroup: (groupId) =>
        set((state) => {
          if (state.lastGroupId === groupId && state.recentGroupIds[0] === groupId) {
            return state;
          }
          return {
            lastGroupId: groupId,
            recentGroupIds: [
              groupId,
              ...state.recentGroupIds.filter((id) => id !== groupId),
            ].slice(0, 12),
          };
        }),
      setCreateGroupDialogOpen: (isCreateGroupDialogOpen) =>
        set({ isCreateGroupDialogOpen }),
      setCreateProjectDialogOpen: (isCreateProjectDialogOpen) =>
        set({ isCreateProjectDialogOpen }),
      setInviteDialogOpen: (isInviteDialogOpen) => set({ isInviteDialogOpen }),
      setTaskDialogOpen: (isTaskDialogOpen) => set({ isTaskDialogOpen }),
      setDecisionDialogOpen: (isDecisionDialogOpen) =>
        set({ isDecisionDialogOpen }),
      setApprovalDialogOpen: (isApprovalDialogOpen) =>
        set({ isApprovalDialogOpen }),
      setByokDialogOpen: (isByokDialogOpen) => set({ isByokDialogOpen }),
      setGarageViewMode: (garageViewMode) => set({ garageViewMode }),
    }),
    {
      name: 'cm_ui',
      // §284: only UI preferences persist — never session/user data here.
      // §195: window-adjacent prefs include last Group / per-Group last Project.
      partialize: (state) => ({
        theme: state.theme,
        sidebarWidth: state.sidebarWidth,
        rightPanelWidth: state.rightPanelWidth,
        isSidebarCollapsed: state.isSidebarCollapsed,
        onboardingComplete: state.onboardingComplete,
        lastGroupId: state.lastGroupId,
        lastProjectIdByGroup: state.lastProjectIdByGroup,
        recentGroupIds: state.recentGroupIds,
        garageViewMode: state.garageViewMode,
      }),
    },
  ),
);