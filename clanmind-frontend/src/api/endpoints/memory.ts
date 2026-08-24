/**
 * Memory endpoint module — the ONLY REST site for the BE §108 memory surface
 * (FE §9 layer boundary):
 *
 *   GET    /api/v1/groups/:groupId/memory             → { items }  GROUP scope
 *   GET    /api/v1/projects/:projectId/memory         → { items }  PROJECT scope
 *   GET    /api/v1/groups/:groupId/memory/candidates  → { items }  PENDING candidates
 *   POST   /api/v1/memory/:candidateId/accept         → 201 Memory row
 *   POST   /api/v1/memory/:candidateId/reject         → {ok}
 *   PATCH  /api/v1/memory/:memoryId                   → Memory {content?, importance?, confidence?}
 *   DELETE /api/v1/memory/:memoryId                   → {ok}
 *
 * Honest gaps (INTEGRATION_NOTES D22): the real Worker ships NO route that
 * lists USER_PRIVATE memories and no user-initiated create endpoint, so
 * `fetchPrivateMemories()` targets the documented-but-unimplemented private
 * list path and `createMemory()` is a demo-parity extension — live mode
 * surfaces the honest failure instead of faking success.
 */

import { z } from 'zod';
import { api } from '@/api/client';
import {
  MemoryCandidateListSchema,
  MemoryCandidateSchema,
  MemoryEntrySchema,
  MemoryListSchema,
} from '@/api/schemas';
import type { MemoryCandidate, MemoryEntry } from '@/types';

type MemoryRow = z.infer<typeof MemoryEntrySchema>;
type CandidateRow = z.infer<typeof MemoryCandidateSchema>;

/** Map a validated §35 row into the canonical FE MemoryEntry. */
export function mapMemoryRow(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    scope_type: row.scope_type as MemoryEntry['scope_type'],
    group_id: row.group_id,
    project_id: row.project_id ?? null,
    user_id: row.user_id ?? null,
    memory_type: row.memory_type,
    content: row.content,
    normalized_content: row.normalized_content ?? null,
    confidence: row.confidence,
    importance: row.importance,
    source_type: row.source_type,
    source_id: row.source_id ?? null,
    status: row.status as MemoryEntry['status'],
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_used_at: row.last_used_at ?? null,
    archived_at: row.archived_at ?? null,
  };
}

function mapMemoryList(raw: unknown): MemoryEntry[] {
  const page = MemoryListSchema.safeParse(raw);
  if (!page.success) return [];
  return (page.data.items ?? []).flatMap((row) => {
    const parsed = MemoryEntrySchema.safeParse(row);
    return parsed.success ? [mapMemoryRow(parsed.data)] : [];
  });
}

function mapOne(raw: unknown): MemoryEntry {
  const parsed = MemoryEntrySchema.safeParse(raw);
  if (!parsed.success) throw new Error('Memory response failed schema validation.');
  return mapMemoryRow(parsed.data);
}

/** BE §108 — Group-scope memories for a Group. */
export async function fetchGroupMemories(groupId: string): Promise<MemoryEntry[]> {
  const raw = await api.get(`/groups/${encodeURIComponent(groupId)}/memory`);
  return mapMemoryList(raw);
}

/** BE §108 — Project-scope memories for a Project. */
export async function fetchProjectMemories(projectId: string): Promise<MemoryEntry[]> {
  const raw = await api.get(`/projects/${encodeURIComponent(projectId)}/memory`);
  return mapMemoryList(raw);
}

/**
 * USER_PRIVATE feed. The backend documents private-memory enforcement but
 * ships no list route today; live mode will 404 and the caller keeps the
 * section honestly empty rather than inventing rows.
 */
export async function fetchPrivateMemories(): Promise<MemoryEntry[]> {
  const raw = await api.get('/me/memory');
  const items = Array.isArray(raw)
    ? raw
    : ((raw as { items?: unknown[] })?.items ?? []);
  return items.flatMap((row) => {
    const parsed = MemoryEntrySchema.safeParse(row);
    return parsed.success ? [mapMemoryRow(parsed.data)] : [];
  });
}

/** BE §108 — PENDING candidates Odin proposed in this Group. */
export async function fetchMemoryCandidates(groupId: string): Promise<MemoryCandidate[]> {
  const raw = await api.get(`/groups/${encodeURIComponent(groupId)}/memory/candidates`);
  const page = MemoryCandidateListSchema.safeParse(raw);
  if (!page.success) return [];
  return (page.data.items ?? []).flatMap((row) => {
    const parsed = MemoryCandidateSchema.safeParse(row);
    if (!parsed.success) return [];
    const c: CandidateRow = parsed.data;
    return [
      {
        id: c.id,
        group_id: c.group_id,
        project_id: c.project_id ?? null,
        user_id: c.user_id ?? null,
        source_message_id: c.source_message_id ?? null,
        candidate_type: c.candidate_type,
        content: c.content,
        confidence: c.confidence,
        recommended_scope: c.recommended_scope as MemoryCandidate['recommended_scope'],
        status: c.status as MemoryCandidate['status'],
        created_at: c.created_at,
      } satisfies MemoryCandidate,
    ];
  });
}

/**
 * Accept a candidate → the server creates the §35 memory row (201).
 * Scope/type/confidence ride the candidate's recommended values.
 */
export async function acceptMemoryCandidate(candidateId: string): Promise<MemoryEntry> {
  const raw = await api.post(`/memory/${encodeURIComponent(candidateId)}/accept`, {});
  return mapOne(raw);
}

/** Dismiss a candidate — PENDING → REJECTED server-side. */
export async function rejectMemoryCandidate(candidateId: string): Promise<void> {
  await api.post(`/memory/${encodeURIComponent(candidateId)}/reject`, {});
}

export interface UpdateMemoryInput {
  content?: string;
  importance?: number;
  confidence?: number;
}

/** PATCH content/importance/confidence (Owner/Admin or own private row). */
export async function updateMemory(memoryId: string, input: UpdateMemoryInput): Promise<MemoryEntry> {
  const raw = await api.patch(`/memory/${encodeURIComponent(memoryId)}`, input);
  return mapOne(raw);
}

/** DELETE a memory row (soft semantics server-side). */
export async function deleteMemory(memoryId: string): Promise<void> {
  await api.delete(`/memory/${encodeURIComponent(memoryId)}`);
}

/**
 * §118 explicit memory ("Remember this"). DEMO-PARITY EXTENSION ONLY — no
 * real Worker route accepts user-authored memory yet; live mode gets the
 * honest NOT_FOUND instead of pretending it saved. Recorded in D22.
 */
export interface CreateMemoryInput {
  scope_type: MemoryEntry['scope_type'];
  group_id: string;
  project_id?: string | null;
  memory_type: MemoryCardTypeInput;
  content: string;
}

/** FE §116 card vocabulary accepted for explicit entries. */
export type MemoryCardTypeInput =
  | 'DECISION'
  | 'CONSTRAINT'
  | 'CONVENTION'
  | 'PREFERENCE'
  | 'FINDING'
  | 'LESSON';

export async function createMemory(input: CreateMemoryInput): Promise<MemoryEntry> {
  const raw = await api.post(
    `/groups/${encodeURIComponent(input.group_id)}/memory`,
    input,
  );
  return mapOne(raw);
}
