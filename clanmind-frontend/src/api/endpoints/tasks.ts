/**
 * Tasks endpoint module — the ONLY REST site for the BE §111 task surface
 * (FE §9 layer boundary):
 *
 *   GET   /api/v1/projects/:projectId/tasks  → { items: Task[] }
 *   POST  /api/v1/projects/:projectId/tasks  → 201 Task   {title, description?, owner_user_id?}
 *   GET   /api/v1/tasks/:taskId              → Task
 *   PATCH /api/v1/tasks/:taskId              → Task       {expected_version, patch{…}}   (§21.2 CAS)
 *   POST  /api/v1/tasks/:taskId/complete     → Task       {expected_version}
 *
 * The create body accepts ONLY title/description/owner_user_id (handlers/
 * intel.ts createTaskBody) — priority/due_at changes go through PATCH with
 * the returned row's `version`. A stale `expected_version` answers 409
 * CONFLICT ("Task changed elsewhere; reload and retry.") — callers must
 * refetch, never blind-retry.
 */

import { z } from 'zod';
import { api } from '@/api/client';
import { TaskListSchema, TaskSchema } from '@/api/schemas';
import type { Task } from '@/types';

type TaskRow = z.infer<typeof TaskSchema>;

/** Map a validated §48 row into the canonical FE Task. */
export function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    project_id: row.project_id,
    title: row.title,
    description: row.description ?? null,
    owner_user_id: row.owner_user_id ?? null,
    status: row.status as Task['status'],
    priority: row.priority as Task['priority'],
    due_at: row.due_at ?? null,
    version: row.version,
    created_by_user_id: row.created_by_user_id ?? null,
    created_by_ai_id: row.created_by_ai_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at ?? null,
    related_decision_id:
      typeof (row as Record<string, unknown>).related_decision_id === 'string'
        ? ((row as Record<string, unknown>).related_decision_id as string)
        : undefined,
  };
}

function mapList(raw: unknown): Task[] {
  const page = TaskListSchema.safeParse(raw);
  if (!page.success) return [];
  return (page.data.items ?? []).flatMap((row) => {
    const parsed = TaskSchema.safeParse(row);
    return parsed.success ? [mapTaskRow(parsed.data)] : [];
  });
}

function mapOne(raw: unknown): Task {
  const parsed = TaskSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Task response failed schema validation.');
  return mapTaskRow(parsed.data);
}

/** BE §111 — list a Project's tasks (Tasks view + Overview feed). */
export async function fetchProjectTasks(projectId: string): Promise<Task[]> {
  const raw = await api.get(`/projects/${encodeURIComponent(projectId)}/tasks`);
  return mapList(raw);
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  owner_user_id?: string | null;
}

/** POST create — server defaults: status TODO, priority MEDIUM, version 1. */
export async function createTask(projectId: string, input: CreateTaskInput): Promise<Task> {
  const raw = await api.post(`/projects/${encodeURIComponent(projectId)}/tasks`, input);
  return mapOne(raw);
}

/** GET one task. */
export async function fetchTask(taskId: string): Promise<Task> {
  const raw = await api.get(`/tasks/${encodeURIComponent(taskId)}`);
  return mapOne(raw);
}

export interface TaskPatch {
  title?: string;
  description?: string | null;
  owner_user_id?: string | null;
  status?: Task['status'];
  priority?: Task['priority'];
  due_at?: string | null;
}

/**
 * PATCH with §21.2 optimistic concurrency — `expectedVersion` MUST be the
 * version the client last rendered. 409 CONFLICT means another writer won;
 * the caller reconciles from a fresh GET.
 */
export async function patchTask(
  taskId: string,
  expectedVersion: number,
  patch: TaskPatch,
): Promise<Task> {
  const raw = await api.patch(`/tasks/${encodeURIComponent(taskId)}`, {
    expected_version: expectedVersion,
    patch,
  });
  return mapOne(raw);
}

/** POST complete — the service-level DONE transition (also CAS-guarded). */
export async function completeTask(taskId: string, expectedVersion: number): Promise<Task> {
  const raw = await api.post(`/tasks/${encodeURIComponent(taskId)}/complete`, {
    expected_version: expectedVersion,
  });
  return mapOne(raw);
}
