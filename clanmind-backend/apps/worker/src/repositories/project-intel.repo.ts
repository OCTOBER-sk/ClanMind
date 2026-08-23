import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Artifact,
  ArtifactRepository,
  ArtifactVersion,
  Decision,
  DecisionRepository,
  MeetingCandidate,
  MeetingRepository,
  MeetingSession,
  Memory,
  MemoryCandidate,
  MemoryCandidateRepository,
  MemoryRepository,
  Task,
  TaskRepository,
} from "@clanmind/domain";

/**
 * Supabase implementations of the §44 artifact, §47 decision, §48 task,
 * §50 meeting and §35/§36 memory repositories. Decisions/tasks implement
 * §21.2 optimistic concurrency via compare-and-set on `version`.
 */

export class SupabaseArtifactRepository implements ArtifactRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: {
    project_id: string;
    name: string;
    artifact_type: Artifact["artifact_type"];
    created_by_user_id: string | null;
  }): Promise<Artifact> {
    const { data, error } = await this.db
      .from("artifacts")
      .insert({
        project_id: input.project_id,
        name: input.name,
        artifact_type: input.artifact_type,
        created_by_user_id: input.created_by_user_id,
        created_by_ai_id: null,
        status: "ACTIVE",
        pinned: false,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Artifact;
  }

  async findById(id: string): Promise<Artifact | null> {
    const { data, error } = await this.db
      .from("artifacts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as Artifact) ?? null;
  }

  async update(
    id: string,
    input: Partial<Pick<Artifact, "name" | "pinned" | "status" | "current_version_id">>,
  ): Promise<Artifact | null> {
    const { data, error } = await this.db
      .from("artifacts")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as Artifact) ?? null;
  }

  async listByProject(projectId: string): Promise<Artifact[]> {
    const { data, error } = await this.db
      .from("artifacts")
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data as Artifact[]) ?? [];
  }

  async nextVersionNumber(artifactId: string): Promise<number> {
    const { count, error } = await this.db
      .from("artifact_versions")
      .select("id", { count: "exact", head: true })
      .eq("artifact_id", artifactId);
    if (error) throw error;
    return (count ?? 0) + 1;
  }

  async insertVersion(
    input: Omit<ArtifactVersion, "id" | "created_at" | "version_number"> & {
      version_number?: number;
    },
  ): Promise<ArtifactVersion> {
    const versionNumber =
      input.version_number ?? (await this.nextVersionNumber(input.artifact_id));
    const { data, error } = await this.db
      .from("artifact_versions")
      .insert({
        artifact_id: input.artifact_id,
        version_number: versionNumber,
        content_type: input.content_type,
        content_ref: input.content_ref,
        checksum: input.checksum,
        created_by_user_id: input.created_by_user_id,
        created_by_ai_id: input.created_by_ai_id,
        parent_version_id: input.parent_version_id,
      })
      .select()
      .single();
    if (error) throw error;
    return data as ArtifactVersion;
  }

  async findVersion(artifactId: string, versionNumber: number): Promise<ArtifactVersion | null> {
    const { data, error } = await this.db
      .from("artifact_versions")
      .select("*")
      .eq("artifact_id", artifactId)
      .eq("version_number", versionNumber)
      .maybeSingle();
    if (error) throw error;
    return (data as ArtifactVersion) ?? null;
  }

  async addLink(input: {
    artifact_id: string;
    target_type: string;
    target_id: string;
    relation: string;
  }): Promise<void> {
    const { error } = await this.db.from("artifact_links").upsert(input, {
      onConflict: "artifact_id,target_type,target_id,relation",
    });
    if (error) throw error;
  }
}

export class SupabaseDecisionRepository implements DecisionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: {
    project_id: string;
    title: string;
    context: string | null;
    proposed_by: string;
  }): Promise<Decision> {
    const { data, error } = await this.db
      .from("decisions")
      .insert({
        project_id: input.project_id,
        title: input.title,
        context: input.context,
        proposed_by: input.proposed_by,
        status: "PROPOSED",
      })
      .select()
      .single();
    if (error) throw error;
    return data as Decision;
  }

  async findById(id: string): Promise<Decision | null> {
    const { data, error } = await this.db
      .from("decisions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as Decision) ?? null;
  }

  async listByProject(projectId: string): Promise<Decision[]> {
    const { data, error } = await this.db
      .from("decisions")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as Decision[]) ?? [];
  }

  /** §21.2 CAS: update … where version = expected; null when raced. */
  async compareAndSetStatus(input: {
    id: string;
    expectedVersion: number;
    from: Decision["status"];
    to: Decision["status"];
    approved_by?: string;
  }): Promise<Decision | null> {
    const patch: Record<string, unknown> = {
      status: input.to,
      version: input.expectedVersion + 1,
      updated_at: new Date().toISOString(),
    };
    if (input.approved_by) {
      patch.approved_by = input.approved_by;
      patch.approved_at = new Date().toISOString();
    }
    const { data, error } = await this.db
      .from("decisions")
      .update(patch)
      .eq("id", input.id)
      .eq("version", input.expectedVersion)
      .eq("status", input.from)
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as Decision) ?? null;
  }

  async supersedeOthers(projectId: string, excludingId: string): Promise<void> {
    // §134/§47: a newly approved decision supersedes other approved ones.
    const { error } = await this.db
      .from("decisions")
      .update({ status: "SUPERSEDED", updated_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("status", "APPROVED")
      .neq("id", excludingId);
    if (error) throw error;
  }
}

export class SupabaseTaskRepository implements TaskRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: {
    project_id: string;
    title: string;
    description: string | null;
    owner_user_id: string | null;
    created_by_user_id: string | null;
  }): Promise<Task> {
    const { data, error } = await this.db
      .from("tasks")
      .insert({
        project_id: input.project_id,
        title: input.title,
        description: input.description,
        owner_user_id: input.owner_user_id,
        created_by_user_id: input.created_by_user_id,
        created_by_ai_id: null,
        status: "TODO",
        priority: "MEDIUM",
      })
      .select()
      .single();
    if (error) throw error;
    return data as Task;
  }

  async findById(id: string): Promise<Task | null> {
    const { data, error } = await this.db.from("tasks").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as Task) ?? null;
  }

  async listByProject(projectId: string): Promise<Task[]> {
    const { data, error } = await this.db
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as Task[]) ?? [];
  }

  async compareAndUpdate(input: {
    id: string;
    expectedVersion: number;
    patch: Partial<Pick<Task, "title" | "description" | "owner_user_id" | "status" | "priority" | "due_at">>;
  }): Promise<Task | null> {
    const completedAt = input.patch.status === "DONE" ? new Date().toISOString() : undefined;
    const { data, error } = await this.db
      .from("tasks")
      .update({
        ...input.patch,
        ...(completedAt !== undefined ? { completed_at: completedAt } : {}),
        version: input.expectedVersion + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("version", input.expectedVersion)
      .neq("status", "CANCELLED")
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as Task) ?? null;
  }

  async addDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
    const { error } = await this.db
      .from("task_dependencies")
      .insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId });
    if (error) throw error;
  }

  async dependenciesOf(taskId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from("task_dependencies")
      .select("depends_on_task_id")
      .eq("task_id", taskId);
    if (error) throw error;
    return (data as { depends_on_task_id: string }[]).map((r) => r.depends_on_task_id);
  }
}

export class SupabaseMeetingRepository implements MeetingRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insertSession(input: {
    group_id: string;
    project_id: string | null;
    started_by: string;
  }): Promise<MeetingSession> {
    const { data, error } = await this.db
      .from("meeting_sessions")
      .insert({
        group_id: input.group_id,
        project_id: input.project_id,
        started_by: input.started_by,
        status: "ACTIVE",
      })
      .select()
      .single();
    if (error) throw error;
    return data as MeetingSession;
  }

  async findSession(id: string): Promise<MeetingSession | null> {
    const { data, error } = await this.db
      .from("meeting_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as MeetingSession) ?? null;
  }

  async endSession(id: string, summaryArtifactId: string | null): Promise<void> {
    const { error } = await this.db
      .from("meeting_sessions")
      .update({ status: "ENDED", ended_at: new Date().toISOString(), summary_artifact_id: summaryArtifactId })
      .eq("id", id);
    if (error) throw error;
  }

  async insertCandidate(input: {
    meeting_session_id: string;
    candidate_type: MeetingCandidate["candidate_type"];
    content: Record<string, unknown>;
    confidence: number;
    source_message_id: string | null;
  }): Promise<MeetingCandidate> {
    const { data, error } = await this.db
      .from("meeting_candidates")
      .insert({
        meeting_session_id: input.meeting_session_id,
        candidate_type: input.candidate_type,
        content: input.content,
        confidence: input.confidence,
        source_message_id: input.source_message_id,
        status: "PENDING",
      })
      .select()
      .single();
    if (error) throw error;
    return data as MeetingCandidate;
  }

  async findCandidate(id: string): Promise<MeetingCandidate | null> {
    const { data, error } = await this.db
      .from("meeting_candidates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as MeetingCandidate) ?? null;
  }

  async resolveCandidate(
    id: string,
    status: MeetingCandidate["status"],
    promoted?: { promoted_to_type: string; promoted_to_id: string },
  ): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.db
      .from("meeting_candidates")
      .update({
        status,
        promoted_to_type: promoted?.promoted_to_type ?? null,
        promoted_to_id: promoted?.promoted_to_id ?? null,
        resolved_at: now,
      })
      .eq("id", id);
    if (error) throw error;
  }

  async listCandidates(sessionId: string): Promise<MeetingCandidate[]> {
    const { data, error } = await this.db
      .from("meeting_candidates")
      .select("*")
      .eq("meeting_session_id", sessionId);
    if (error) throw error;
    return (data as MeetingCandidate[]) ?? [];
  }

  async upsertSummary(input: { meeting_session_id: string; summary_text: string }): Promise<void> {
    const { error } = await this.db
      .from("meeting_summaries")
      .upsert(
        { meeting_session_id: input.meeting_session_id, summary_text: input.summary_text },
        { onConflict: "meeting_session_id" },
      );
    if (error) throw error;
  }
}

export class SupabaseMemoryRepository implements MemoryRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(
    input: Omit<Memory, "id" | "created_at" | "updated_at" | "last_used_at" | "archived_at" | "status"> & {
      status?: Memory["status"];
    },
  ): Promise<Memory> {
    const { data, error } = await this.db
      .from("memories")
      .insert({
        scope_type: input.scope_type,
        group_id: input.group_id,
        project_id: input.project_id,
        user_id: input.user_id,
        memory_type: input.memory_type,
        content: input.content,
        normalized_content: input.normalized_content,
        confidence: input.confidence,
        importance: input.importance,
        source_type: input.source_type,
        source_id: input.source_id,
        status: input.status ?? "ACTIVE",
      })
      .select()
      .single();
    if (error) throw error;
    return data as Memory;
  }

  async findById(id: string): Promise<Memory | null> {
    const { data, error } = await this.db.from("memories").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as Memory) ?? null;
  }

  async update(
    id: string,
    input: Partial<Pick<Memory, "content" | "importance" | "confidence">>,
  ): Promise<Memory | null> {
    const { data, error } = await this.db
      .from("memories")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as Memory) ?? null;
  }

  async archive(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.db
      .from("memories")
      .update({ status: "ARCHIVED", archived_at: now, updated_at: now })
      .eq("id", id);
    if (error) throw error;
  }

  async supersede(id: string): Promise<void> {
    const { error } = await this.db
      .from("memories")
      .update({ status: "SUPERSEDED", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("memories").delete().eq("id", id);
    if (error) throw error;
  }

  async searchInScope(input: {
    group_id: string;
    scope_type: Memory["scope_type"];
    project_id?: string | null;
    user_id?: string | null;
    limit: number;
  }): Promise<Memory[]> {
    let query = this.db
      .from("memories")
      .select("*")
      .eq("group_id", input.group_id)
      .eq("scope_type", input.scope_type)
      .eq("status", "ACTIVE");
    if (input.scope_type === "PROJECT") {
      query = query.eq("project_id", input.project_id ?? "");
    }
    if (input.scope_type === "USER_PRIVATE") {
      query = query.eq("user_id", input.user_id ?? "");
    }
    const { data, error } = await query.limit(input.limit);
    if (error) throw error;
    return (data as Memory[]) ?? [];
  }

  async findByNormalizedContent(input: {
    group_id: string;
    normalized_content: string;
    memory_type: string;
  }): Promise<Memory | null> {
    const { data, error } = await this.db
      .from("memories")
      .select("*")
      .eq("group_id", input.group_id)
      .eq("memory_type", input.memory_type)
      .eq("normalized_content", input.normalized_content)
      .maybeSingle();
    if (error) throw error;
    return (data as Memory) ?? null;
  }
}

export class SupabaseMemoryCandidateRepository implements MemoryCandidateRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(
    input: Omit<MemoryCandidate, "id" | "created_at" | "status"> & {
      status?: MemoryCandidate["status"];
    },
  ): Promise<MemoryCandidate> {
    const { data, error } = await this.db
      .from("memory_candidates")
      .insert({
        group_id: input.group_id,
        project_id: input.project_id,
        user_id: input.user_id,
        source_message_id: input.source_message_id,
        candidate_type: input.candidate_type,
        content: input.content,
        confidence: input.confidence,
        recommended_scope: input.recommended_scope,
        status: input.status ?? "PENDING",
      })
      .select()
      .single();
    if (error) throw error;
    return data as MemoryCandidate;
  }

  async findById(id: string): Promise<MemoryCandidate | null> {
    const { data, error } = await this.db
      .from("memory_candidates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as MemoryCandidate) ?? null;
  }

  async setStatus(id: string, status: MemoryCandidate["status"]): Promise<void> {
    const { error } = await this.db
      .from("memory_candidates")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  }

  async listByGroup(groupId: string, status: MemoryCandidate["status"]): Promise<MemoryCandidate[]> {
    const { data, error } = await this.db
      .from("memory_candidates")
      .select("*")
      .eq("group_id", groupId)
      .eq("status", status)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as MemoryCandidate[]) ?? [];
  }
}
