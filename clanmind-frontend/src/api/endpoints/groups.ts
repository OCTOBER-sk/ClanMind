/**
 * Group endpoints used by Settings (BE §104 Groups + handlers/groups.ts) —
 * the ONLY REST sites for group profile edits and the §228/§9 deletion
 * lifecycle (FE §9 layer boundary):
 *
 *   PATCH  /api/v1/groups/:groupId { name?, description? } → group row
 *   DELETE /api/v1/groups/:groupId → soft delete (Stage 1, recovery window)
 *   POST   /api/v1/groups/:groupId/restore → Owner-only Stage 2
 *   POST   /api/v1/groups/:groupId/delete-permanently → Owner-only Stage 3
 *
 * Real Worker validation: name 1..80, description ≤500; updates require
 * OWNER/ADMIN (403 GROUP_PERMISSION_DENIED otherwise); the delete stages are
 * OWNER-only (domain/group.service.ts requireRole(["OWNER"])).
 */

import { z } from 'zod';
import { api } from '@/api/client';

const UpdatedGroupSchema = z
  .object({ id: z.string().min(1), name: z.string().min(1) })
  .passthrough();

export interface UpdateGroupInput {
  name?: string;
  description?: string | null;
}

export async function updateGroup(groupId: string, input: UpdateGroupInput): Promise<unknown> {
  const raw = await api.patch(`/groups/${encodeURIComponent(groupId)}`, input);
  const parsed = UpdatedGroupSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Group update response failed schema validation.');
  return parsed.data;
}

/** §228 Stage-1 soft delete — the Group enters its recovery window. */
export async function deleteGroup(groupId: string): Promise<unknown> {
  return api.delete(`/groups/${encodeURIComponent(groupId)}`);
}
