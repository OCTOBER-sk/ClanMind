import { create } from 'zustand';
import { api } from '@/api/client';
import { FeatureFlagsSchema } from '@/api/schemas';
import type { Group, Project, GroupMember, ServerFeatureFlags } from '@/types';

export interface GroupState {
  groups: Group[];
  activeGroup: Group | null;
  projects: Project[];
  activeProject: Project | null;
  members: GroupMember[];
  featureFlags: ServerFeatureFlags;
  memberNicknames: Record<string, string>;
  /** Loading state for flag re-fetch on group switch */
  flagsLoading: boolean;

  setActiveGroup: (group: Group) => void;
  setActiveProject: (project: Project) => void;
  setMemberNickname: (userId: string, nickname: string) => void;
  updateFeatureFlags: (flags: Partial<ServerFeatureFlags>) => void;
  /** Re-fetch feature flags for a given group (clears stale flags first) */
  refetchFeatureFlags: (groupId: string) => Promise<void>;
  updateProjectProgress: (projectId: string, progress: number) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  addGroup: (group: Group) => void;
  addProject: (project: Project) => void;
  removeGroup: (groupId: string) => void;
  transferOwnership: (fromUserId: string, toUserId: string) => void;
  updateMemberRole: (userId: string, role: GroupMember['role']) => void;
  removeMember: (userId: string) => void;
  addMember: (member: GroupMember) => void;
}

// §165A — server-controlled flags: never assume enabled until the server says
// so; refetchFeatureFlags() replaces these on every Group switch.
export const DEFAULT_FLAGS: ServerFeatureFlags = {
  meeting_mode: false,
  proactive_ai: false,
  github_write: false,
  github_merge: false,
  custom_skills: false,
  deep_research: false,
  offline_sync_v2: false,
  interactive_artifacts: false,
};

// §11/§283/§284 — runtime stores start EMPTY. Live mode fills these via
// server queries.
export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  activeGroup: null,
  projects: [],
  activeProject: null,
  members: [],
  featureFlags: { ...DEFAULT_FLAGS },
  memberNicknames: {},
  flagsLoading: false,

  setActiveGroup: (group) =>
    set({
      activeGroup: group,
      // Clear stale flags — refetchFeatureFlags should be called afterward
      featureFlags: { ...DEFAULT_FLAGS },
    }),

  setActiveProject: (project) => set({ activeProject: project }),

  setMemberNickname: (userId, nickname) =>
    set((state) => ({
      memberNicknames: { ...state.memberNicknames, [userId]: nickname },
    })),

  updateFeatureFlags: (flags) =>
    set((state) => ({
      featureFlags: { ...state.featureFlags, ...flags },
    })),

  refetchFeatureFlags: async (groupId) => {
    // Guard: only fetch if activeGroup matches
    const currentGroup = get().activeGroup;
    if (!currentGroup || currentGroup.id !== groupId) return;

    set({ flagsLoading: true });
    try {
      // §165A.1 — flags come from the SERVER (GET /groups/:id/flags), never a
      // local toggle; the client must not assume a flag is enabled just
      // because its UI path exists in the build.
      const raw = await api.get(`/groups/${encodeURIComponent(groupId)}/flags`, { retries: 0 });
      const parsed = FeatureFlagsSchema.safeParse(raw);
      // Ignore stale responses that land after the user switched away.
      if (get().activeGroup?.id !== groupId) return;
      set({
        featureFlags: parsed.success ? { ...DEFAULT_FLAGS, ...parsed.data } : { ...DEFAULT_FLAGS },
        flagsLoading: false,
      });
    } catch {
      // LIVE honesty (D14): the real Worker has no §165A flags endpoint yet —
      // the request fails and safe all-off defaults stay in force rather than
      // faking an answer.
      if (get().activeGroup?.id === groupId) {
        set({ featureFlags: { ...DEFAULT_FLAGS }, flagsLoading: false });
      }
    }
  },

  updateProjectProgress: (projectId, progress) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, pulse_progress: progress } : p
      ),
      activeProject:
        state.activeProject?.id === projectId
          ? { ...state.activeProject, pulse_progress: progress }
          : state.activeProject,
    })),

  updateProject: (projectId, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
      ),
      activeProject:
        state.activeProject?.id === projectId
          ? { ...state.activeProject, ...updates, updated_at: new Date().toISOString() }
          : state.activeProject,
    })),

  addGroup: (group) =>
    set((state) => ({
      groups: [...state.groups, group],
      activeGroup: group,
      featureFlags: { ...DEFAULT_FLAGS },
    })),

  addProject: (project) =>
    set((state) => ({
      projects: [...state.projects, project],
      activeProject: project,
    })),

  removeGroup: (groupId) =>
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
      activeGroup: state.activeGroup?.id === groupId ? null : state.activeGroup,
    })),

  transferOwnership: (fromUserId, toUserId) =>
    set((state) => ({
      members: state.members.map((m) => {
        if (m.user_id === fromUserId) return { ...m, role: 'ADMIN' };
        if (m.user_id === toUserId) return { ...m, role: 'OWNER' };
        return m;
      }),
    })),

  updateMemberRole: (userId, role) =>
    set((state) => ({
      members: state.members.map((m) =>
        m.user_id === userId ? { ...m, role } : m
      ),
    })),

  removeMember: (userId) =>
    set((state) => ({
      members: state.members.filter((m) => m.user_id !== userId),
    })),

  addMember: (member) =>
    set((state) => ({
      members: [...state.members, member],
    })),
}));
