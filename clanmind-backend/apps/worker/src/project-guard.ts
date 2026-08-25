import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@clanmind/shared";

/**
 * M2 (BACKEND_AUDIT2 §6): a client-supplied `project_id` must belong to the
 * target Group — the FK to `projects` only proves the project exists, never
 * that `project.group_id == group_id`. Any member of Group A can otherwise
 * cross-reference a project of Group B, corrupting the group-scope invariant
 * (§185 #4). Re-derives `project.group_id` and throws FORBIDDEN on mismatch.
 */
export async function assertProjectInGroup(
  db: SupabaseClient,
  projectId: string,
  groupId: string,
): Promise<void> {
  const { data, error } = await db
    .from("projects")
    .select("group_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  const projectGroupId = (data as { group_id: string } | null)?.group_id ?? null;
  if (projectGroupId === null || projectGroupId !== groupId) {
    throw new AppError(
      "FORBIDDEN",
      "The project does not belong to this Group.",
    );
  }
}
