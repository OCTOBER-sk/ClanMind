/**
 * §119 task interactions controller — loads a Project's §48 rows through the
 * endpoint module (TanStack Query read layer, same pattern as message
 * history) and applies optimistic status/assignment/due changes with §21.2
 * conflict reconciliation:
 *
 *   • mutate → optimistic store write immediately (§180 responsiveness)
 *   • success → replace with the authoritative server row (new version)
 *   • 409 CONFLICT → refetch the project's tasks so the card re-renders
 *     server truth; never blind-retry the stale version.
 *
 * The zustand store remains the single RENDER source: query results are
 * projected into it (scoped to their project) so realtime fan-out rows
 * (dispatch) and REST reads land in one place.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import {
  completeTask,
  createTask,
  fetchProjectTasks,
  patchTask,
  type CreateTaskInput,
  type TaskPatch,
} from '@/api/endpoints/tasks';
import { errorMessageOf } from '@/features/github/useGithubConnection';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import type { Task } from '@/types';

export interface TasksControllerState {
  /** Rows for the active Project (already scoped). */
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  /** True while an optimistic mutation awaits its server confirmation. */
  isMutating: boolean;
  refresh: () => Promise<void>;
  create: (
    input: CreateTaskInput,
    targetProjectId?: string | null,
  ) => Promise<Task | null>;
  /** §121 — create + follow-up priority/due PATCH through the real CAS;
   *  the dialog may target a Project other than the active one. */
  createWithDetails: (
    input: CreateTaskInput & { priority?: Task['priority']; due_at?: string | null },
    targetProjectId?: string | null,
  ) => Promise<Task | null>;
  patch: (task: Task, patch: TaskPatch) => Promise<boolean>;
  setStatus: (task: Task, status: Task['status']) => Promise<boolean>;
  assign: (task: Task, ownerUserId: string | null) => Promise<boolean>;
  complete: (task: Task) => Promise<boolean>;
}

/** Project the fetched page into the store scoped to its project. */
function applyProjectRows(projectId: string, rows: Task[]): void {
  useProjectDataStore.setState((s) => ({
    tasks: [...s.tasks.filter((t) => t.project_id !== projectId), ...rows],
  }));
}

export function useTasksController(projectId: string | null | undefined): TasksControllerState {
  const allTasks = useProjectDataStore((s) => s.tasks);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const query = useQuery({
    queryKey: ['project-tasks', projectId ?? null],
    queryFn: () => fetchProjectTasks(projectId as string),
    enabled: Boolean(projectId),
    staleTime: 15_000,
  });

  // External-store projection on fresh server pages (no React state here —
  // the store IS the render source, shared with the realtime dispatch).
  useEffect(() => {
    if (!query.data || !projectId) return;
    applyProjectRows(projectId, query.data);
  }, [query.data, projectId]);

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const create = useCallback(
    async (
      input: CreateTaskInput,
      /** §121 dialog may target a different Project than the active one. */
      targetProjectId?: string | null,
    ): Promise<Task | null> => {
      const destination = targetProjectId ?? projectId;
      if (!destination) return null;
      setIsMutating(true);
      try {
        const task = await createTask(destination, input);
        if (mountedRef.current) {
          useProjectDataStore.getState().upsertTask(task);
          setMutationError(null);
        }
        return task;
      } catch (err) {
        if (mountedRef.current) setMutationError(errorMessageOf(err));
        return null;
      } finally {
        if (mountedRef.current) setIsMutating(false);
      }
    },
    [projectId],
  );

  /**
   * §121 dialog create — the real POST body accepts only
   * title/description/owner_user_id, so Priority/Due ride a second CAS PATCH
   * against the created row's version. Both steps are server-truth; no
   * client-side field fabrication.
   */
  const createWithDetails = useCallback(
    async (
      input: CreateTaskInput & { priority?: Task['priority']; due_at?: string | null },
      targetProjectId?: string | null,
    ): Promise<Task | null> => {
      const created = await create(input, targetProjectId);
      if (!created) return null;
      const extras: TaskPatch = {};
      if (input.priority !== undefined) extras.priority = input.priority;
      if (input.due_at !== undefined) extras.due_at = input.due_at;
      if (Object.keys(extras).length === 0) return created;
      try {
        const updated = await patchTask(created.id, created.version, extras);
        useProjectDataStore.getState().upsertTask(updated);
        return updated;
      } catch (err) {
        // The task EXISTS even if detailing failed — surface the error but
        // keep the row rather than pretending nothing happened.
        if (mountedRef.current) setMutationError(errorMessageOf(err));
        return created;
      }
    },
    [create],
  );

  /**
   * Shared CAS mutation path. On 409 the local copy is stale — reconcile
   * from the server list instead of retrying with the old version.
   */
  const mutate = useCallback(
    async (
      task: Task,
      run: () => Promise<Task>,
      optimistic: Partial<Task>,
    ): Promise<boolean> => {
      setIsMutating(true);
      useProjectDataStore.getState().upsertTask({ ...task, ...optimistic });
      try {
        const updated = await run();
        if (mountedRef.current) {
          useProjectDataStore.getState().upsertTask(updated);
          setMutationError(null);
        }
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        if (err instanceof ApiError && (err.code === 'CONFLICT' || err.status === 409)) {
          // §21.2 — someone else won the compare-and-set; reload server truth.
          await query.refetch();
          setMutationError('This task changed elsewhere. Showing the latest version.');
        } else {
          setMutationError(errorMessageOf(err));
          // Roll the optimistic field back so the UI never lies about state.
          useProjectDataStore.getState().upsertTask(task);
        }
        return false;
      } finally {
        if (mountedRef.current) setIsMutating(false);
      }
    },
    [query],
  );

  const patch = useCallback(
    (task: Task, patchBody: TaskPatch) =>
      mutate(task, () => patchTask(task.id, task.version, patchBody), patchBody as Partial<Task>),
    [mutate],
  );

  const setStatus = useCallback(
    (task: Task, status: Task['status']) =>
      mutate(
        task,
        () => patchTask(task.id, task.version, { status }),
        status === 'DONE'
          ? { status, completed_at: new Date().toISOString() }
          : { status },
      ),
    [mutate],
  );

  const assign = useCallback(
    (task: Task, ownerUserId: string | null) =>
      mutate(task, () => patchTask(task.id, task.version, { owner_user_id: ownerUserId }), {
        owner_user_id: ownerUserId,
      }),
    [mutate],
  );

  const complete = useCallback(
    (task: Task) =>
      mutate(
        task,
        () => completeTask(task.id, task.version),
        { status: 'DONE', completed_at: new Date().toISOString() },
      ),
    [mutate],
  );

  const tasks = projectId ? allTasks.filter((t) => t.project_id === projectId) : [];

  return {
    tasks,
    isLoading: query.isPending && Boolean(projectId),
    error: mutationError ?? (query.isError ? errorMessageOf(query.error) : null),
    isMutating,
    refresh,
    create,
    createWithDetails,
    patch,
    setStatus,
    assign,
    complete,
  };
}
