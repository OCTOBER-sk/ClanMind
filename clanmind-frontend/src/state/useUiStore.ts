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
  theme: 'light' | 'dark';
  sidebarWidth: number; // default 240px
  rightPanelWidth: number; // default 460px
  isSidebarCollapsed: boolean;
  /** §193 — nav section lives in the URL, not in state. */
  isCommandPaletteOpen: boolean;
  isKeyboardHelpOpen: boolean;
  /** §69/§70: first-run onboarding finished for this account */
  onboardingComplete: boolean;
  isCreateGroupDialogOpen: boolean;
  isCreateProjectDialogOpen: boolean;
  isInviteDialogOpen: boolean;
  isTaskDialogOpen: boolean;
  isDecisionDialogOpen: boolean;
  isApprovalDialogOpen: boolean;
  isByokDialogOpen: boolean;

  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setSidebarWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setKeyboardHelpOpen: (open: boolean) => void;
  setOnboardingComplete: (complete: boolean) => void;
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
    }),
    {
      name: 'cm_ui',
      // §284: only UI preferences persist — never session/user data here
      partialize: (state) => ({
        theme: state.theme,
        sidebarWidth: state.sidebarWidth,
        rightPanelWidth: state.rightPanelWidth,
        isSidebarCollapsed: state.isSidebarCollapsed,
        onboardingComplete: state.onboardingComplete,
      }),
    },
  ),
);