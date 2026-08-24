import { create } from 'zustand';
import type {
  Task,
  Decision,
  MemoryEntry,
  MemoryCandidate,
  Notification,
  AiAction,
  GithubActionItem,
} from '@/types';

/**
 * Project-intelligence data (§47/§48/§35/§36 contract rows + notifications
 * + §164A approvals). Runtime starts EMPTY; demo hydration (src/mocks) or
 * the P8 controllers/dispatch projections fill these — never fixtures from
 * live code paths.
 */
export interface ProjectDataState {
  tasks: Task[];
  decisions: Decision[];
  memories: MemoryEntry[];
  memoryCandidates: MemoryCandidate[];
  notifications: Notification[];
  /** §164A — generalized approval engine: any HIGH/CRITICAL AI action */
  aiActions: AiAction[];

  setTasks: (tasks: Task[]) => void;
  upsertTask: (task: Task) => void;
  removeTask: (taskId: string) => void;

  setDecisions: (decisions: Decision[]) => void;
  upsertDecision: (decision: Decision) => void;

  setMemories: (memories: MemoryEntry[]) => void;
  upsertMemory: (memory: MemoryEntry) => void;
  deleteMemory: (memoryId: string) => void;
  setMemoryCandidates: (candidates: MemoryCandidate[]) => void;
  upsertMemoryCandidate: (candidate: MemoryCandidate) => void;
  removeMemoryCandidate: (candidateId: string) => void;

  markNotificationAsRead: (notificationId: string) => void;
  clearAllNotifications: () => void;
  addNotification: (notification: Notification) => void;

  updateAiAction: (actionId: string, updates: Partial<AiAction>) => void;
  upsertAiAction: (action: AiAction) => void;
  refreshAiAction: (actionId: string) => void;
  /**
   * Reconcile §78 joined rows (github_actions ⋈ ai_actions status/risk) into
   * the store by ai_action_id. Rows the client holds no envelope for never
   * become cards — an Approve button without a displayed hash cannot exist
   * (§164A.2); they only contribute to pending counts in the GitHub panel.
   */
  applyGithubActionRows: (rows: GithubActionItem[]) => void;
}

export const useProjectDataStore = create<ProjectDataState>((set) => ({
  tasks: [],
  decisions: [],
  memories: [],
  memoryCandidates: [],
  notifications: [],
  aiActions: [],

  setTasks: (tasks) => set({ tasks }),
  upsertTask: (task) =>
    set((state) => ({
      tasks: state.tasks.some((t) => t.id === task.id)
        ? state.tasks.map((t) => (t.id === task.id ? task : t))
        : [task, ...state.tasks],
    })),
  removeTask: (taskId) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== taskId) })),

  setDecisions: (decisions) => set({ decisions }),
  upsertDecision: (decision) =>
    set((state) => ({
      decisions: state.decisions.some((d) => d.id === decision.id)
        ? state.decisions.map((d) => (d.id === decision.id ? decision : d))
        : [decision, ...state.decisions],
    })),

  setMemories: (memories) => set({ memories }),
  upsertMemory: (memory) =>
    set((state) => ({
      memories: state.memories.some((m) => m.id === memory.id)
        ? state.memories.map((m) => (m.id === memory.id ? memory : m))
        : [memory, ...state.memories],
    })),
  deleteMemory: (memoryId) =>
    set((state) => ({ memories: state.memories.filter((m) => m.id !== memoryId) })),
  setMemoryCandidates: (memoryCandidates) => set({ memoryCandidates }),
  upsertMemoryCandidate: (candidate) =>
    set((state) => ({
      memoryCandidates: state.memoryCandidates.some((c) => c.id === candidate.id)
        ? state.memoryCandidates.map((c) => (c.id === candidate.id ? candidate : c))
        : [candidate, ...state.memoryCandidates],
    })),
  removeMemoryCandidate: (candidateId) =>
    set((state) => ({
      memoryCandidates: state.memoryCandidates.filter((c) => c.id !== candidateId),
    })),

  markNotificationAsRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ),
    })),
  clearAllNotifications: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
    })),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
    })),

  // §164A.2/4: approve validates the exact payload snapshot; on mismatch the
  // action is re-fetched (EXPIRED → Review latest).
  updateAiAction: (actionId, updates) =>
    set((state) => ({
      aiActions: state.aiActions.map((a) =>
        a.id === actionId ? { ...a, ...updates } : a
      ),
    })),

  upsertAiAction: (action) =>
    set((state) => ({
      aiActions: state.aiActions.some((a) => a.id === action.id)
        ? state.aiActions.map((a) => (a.id === action.id ? { ...a, ...action } : a))
        : [action, ...state.aiActions],
    })),

  refreshAiAction: (actionId) =>
    set((state) => ({
      aiActions: state.aiActions.map((a) =>
        a.id === actionId
          ? {
              ...a,
              // §164A.4: review latest re-renders the fresh card with the current
              // hash/version (mock re-fetch keeps values stable in this demo).
              status: 'WAITING_APPROVAL',
            }
          : a
      ),
    })),

  applyGithubActionRows: (rows) =>
    set((state) => ({
      aiActions: state.aiActions.map((a) => {
        const row = rows.find((r) => r.ai_action_id === a.id);
        if (!row) return a;
        return { ...a, status: row.status as AiAction['status'], risk_level: row.risk_level as AiAction['risk_level'] };
      }),
    })),
}));
