/**
 * Project endpoints — live mode write path for project creation (BE §104).
 *
 *   POST /api/v1/groups/:groupId/projects { name, description?, goal?, project_type? }
 *        → project row (201)
 *
 * Real Worker validation: name 1..120, description ≤1000, goal ≤2000;
 * project_type defaults to "other" when omitted.
 */

import { api } from '@/api/client';
import { ProjectSchema } from '@/api/schemas';
import { mapProject } from '@/live/liveRuntime';
import type { Project } from '@/types';

/** POST /groups/:groupId/projects → 201 project row. Maps BE row into canonical FE Project. */
export async function createProject(
  groupId: string,
  input: {
    name: string;
    description?: string;
    goal?: string;
    project_type?: string;
  },
): Promise<Project> {
  const raw = await api.post(
    `/groups/${encodeURIComponent(groupId)}/projects`,
    input,
  );
  const parsed = ProjectSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Project create response failed schema validation.');
  return mapProject(parsed.data);
}
