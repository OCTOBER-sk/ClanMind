import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Project,
  ProjectInstruction,
  ProjectInstructionRepository,
  ProjectRepository,
  UpdateProjectInput,
} from "@clanmind/domain";

/** Supabase implementation of the §184 projects/instructions contracts. */
export class SupabaseProjectRepository implements ProjectRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: {
    group_id: string;
    name: string;
    description: string | null;
    goal: string | null;
    project_type: string | null;
    created_by: string;
  }): Promise<Project> {
    const { data, error } = await this.db
      .from("projects")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as Project;
  }

  async findById(id: string): Promise<Project | null> {
    const { data, error } = await this.db
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as Project | null) ?? null;
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project | null> {
    const { data, error } = await this.db
      .from("projects")
      .update(input)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as Project | null) ?? null;
  }

  async setStatus(
    id: string,
    status: Project["status"],
    archivedAt: string | null,
  ): Promise<Project | null> {
    const { data, error } = await this.db
      .from("projects")
      .update({ status, archived_at: archivedAt })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as Project | null) ?? null;
  }

  async listByGroup(groupId: string, includeArchived: boolean): Promise<Project[]> {
    let query = this.db.from("projects").select("*").eq("group_id", groupId);
    if (!includeArchived) query = query.eq("status", "active");
    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) throw error;
    return (data as Project[]) ?? [];
  }

  async countActive(groupId: string): Promise<number> {
    const { count, error } = await this.db
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)
      .eq("status", "active");
    if (error) throw error;
    return count ?? 0;
  }
}

export class SupabaseProjectInstructionRepository implements ProjectInstructionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: {
    project_id: string;
    instruction_text: string;
    priority: number;
    created_by: string;
  }): Promise<ProjectInstruction> {
    const { data, error } = await this.db
      .from("project_instructions")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as ProjectInstruction;
  }

  async listByProject(projectId: string): Promise<ProjectInstruction[]> {
    const { data, error } = await this.db
      .from("project_instructions")
      .select("*")
      .eq("project_id", projectId)
      .order("priority", { ascending: true });
    if (error) throw error;
    return (data as ProjectInstruction[]) ?? [];
  }

  async update(
    id: string,
    input: { instruction_text?: string; priority?: number; enabled?: boolean },
  ): Promise<ProjectInstruction | null> {
    const { data, error } = await this.db
      .from("project_instructions")
      .update(input)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as ProjectInstruction | null) ?? null;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db
      .from("project_instructions")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }
}
