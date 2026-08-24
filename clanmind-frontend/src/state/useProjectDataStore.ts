import { create } from 'zustand';
import type {
  Task,
  Decision,
  MemoryEntry,
  MemoryCandidate,
  Notification,
  ActivityEvent,
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
  /** §95A canonical rows (read state = server `read_at`, §277). */
  notifications: Notification[];
  /** §98A attention feed (GET /groups/:groupId/activity). */
  activityEvents: ActivityEvent[];
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

  /** Replace the recipient's notification list from a validated fetch. */
  setNotifications: (rows: Notification[]) => void;
  /** Merge one §95A row (realtime fan-out / optimistic reconcile), newest first, deduped by id. */
  upsertNotification: (row: Notification) => void;
  setActivityEvents: (events: ActivityEvent[]) => void;
  markNotificationAsRead: (notificationId: string) => void;
  clearAllNotifications: () => void;

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
  activityEvents: [],
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

  setNotifications: (rows) =>
    set(() => ({
      notifications: [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    })),
  upsertNotification: (row) =>
    set((state) => ({
      notifications: state.notifications.some((n) => n.id === row.id)
        ? state.notifications.map((n) => (n.id === row.id ? row : n))
        : [row, ...state.notifications].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    })),
  setActivityEvents: (events) => set({ activityEvents: events }),
  // §277 — read state IS the server's read_at; local writes are optimistic
  // projections of POST /notifications/:id/read and reconcile on refetch.
  markNotificationAsRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId && n.read_at == null
          ? { ...n, read_at: new Date().toISOString() }
          : n
      ),
    })),
  clearAllNotifications: () =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.read_at == null ? { ...n, read_at: new Date().toISOString() } : n
      ),
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
