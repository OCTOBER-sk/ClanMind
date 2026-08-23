import { create } from 'zustand';
import type { Task, Decision, MemoryEntry, Notification, AiAction } from '@/types';

export interface ProjectDataState {
  tasks: Task[];
  decisions: Decision[];
  memories: MemoryEntry[];
  memoryCandidates: Array<{ id: string; content: string; scope: string }>;
  notifications: Notification[];
  /** §164A — generalized approval engine: any HIGH/CRITICAL AI action */
  aiActions: AiAction[];

  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;

  addDecision: (decision: Decision) => void;
  updateDecision: (decisionId: string, updates: Partial<Decision>) => void;

  addMemory: (memory: MemoryEntry) => void;
  deleteMemory: (memoryId: string) => void;
  removeMemoryCandidate: (candidateId: string) => void;

  markNotificationAsRead: (notificationId: string) => void;
  clearAllNotifications: () => void;
  addNotification: (notification: Notification) => void;

  updateAiAction: (actionId: string, updates: Partial<AiAction>) => void;
  refreshAiAction: (actionId: string) => void;
}

export const useProjectDataStore = create<ProjectDataState>((set) => ({
  // �11 � runtime starts empty; demo hydration (src/mocks) or live queries fill these.
  tasks: [],
  decisions: [],
  memories: [],
  memoryCandidates: [],
  notifications: [],
  aiActions: [],

  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
      ),
    })),
  deleteTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    })),

  addDecision: (decision) =>
    set((state) => ({ decisions: [decision, ...state.decisions] })),
  updateDecision: (decisionId, updates) =>
    set((state) => ({
      decisions: state.decisions.map((d) =>
        d.id === decisionId ? { ...d, ...updates, updated_at: new Date().toISOString() } : d
      ),
    })),

  addMemory: (memory) =>
    set((state) => ({ memories: [memory, ...state.memories] })),
  deleteMemory: (memoryId) =>
    set((state) => ({
      memories: state.memories.filter((m) => m.id !== memoryId),
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
  // action is re-fetched (simulated here as EXPIRED → Review latest).
  updateAiAction: (actionId, updates) =>
    set((state) => ({
      aiActions: state.aiActions.map((a) =>
        a.id === actionId ? { ...a, ...updates } : a
      ),
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
}));
