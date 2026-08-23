import type { ArtifactType } from "@clanmind/contracts";
import { AppError } from "@clanmind/shared";

/** §45 — the closed artifact type registry. */
export const ARTIFACT_TYPES: ArtifactType[] = [
  "DOCUMENT", "MARKDOWN", "DIAGRAM", "FLOWCHART", "ARCHITECTURE", "GRAPH",
  "CHART", "TIMELINE", "MINDMAP", "DECISION_TREE", "TABLE", "RESEARCH",
  "IMAGE", "INTERACTIVE", "CODE", "HTML", "OTHER",
];

/** §44 */
export interface Artifact {
  id: string;
  project_id: string;
  name: string;
  artifact_type: ArtifactType;
  created_by_user_id: string | null;
  created_by_ai_id: string | null;
  status: "ACTIVE" | "GENERATING" | "DELETED";
  pinned: boolean;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ArtifactVersion {
  id: string;
  artifact_id: string;
  version_number: number;
  content_type: string;
  content_ref: string;
  checksum: string | null;
  created_by_user_id: string | null;
  created_by_ai_id: string | null;
  parent_version_id: string | null;
  created_at: string;
}

export interface ArtifactRepository {
  insert(input: { project_id: string; name: string; artifact_type: ArtifactType; created_by_user_id: string | null }): Promise<Artifact>;
  findById(id: string): Promise<Artifact | null>;
  update(id: string, input: Partial<Pick<Artifact, "name" | "pinned" | "status" | "current_version_id">>): Promise<Artifact | null>;
  listByProject(projectId: string): Promise<Artifact[]>;
  nextVersionNumber(artifactId: string): Promise<number>;
  insertVersion(input: Omit<ArtifactVersion, "id" | "created_at" | "version_number"> & { version_number?: number }): Promise<ArtifactVersion>;
  findVersion(artifactId: string, versionNumber: number): Promise<ArtifactVersion | null>;
  /** Immutable version history for §109 version lists (oldest → newest). */
  listVersions(artifactId: string): Promise<ArtifactVersion[]>;
  addLink(input: { artifact_id: string; target_type: string; target_id: string; relation: string }): Promise<void>;
}

/**
 * §44/§21.3 artifacts: versions are immutable; concurrent edits create new
 * versions; never silently overwrite. Binary content lives in R2 behind
 * content_ref (§178).
 */
export class ArtifactService {
  constructor(
    private readonly artifacts: ArtifactRepository,
    private readonly limits: { artifact_text_max_bytes: number; artifact_binary_max_bytes: number },
  ) {}

  async create(input: {
    project_id: string;
    name: string;
    artifact_type: ArtifactType;
    created_by_user_id: string | null;
    content_type: string;
    content: string;
    is_binary: boolean;
  }): Promise<{ artifact: Artifact; version: ArtifactVersion }> {
    if (!ARTIFACT_TYPES.includes(input.artifact_type)) {
      throw new AppError("VALIDATION_FAILED", "Unknown artifact type.");
    }
    const size = input.content.length;
    const limit = input.is_binary
      ? this.limits.artifact_binary_max_bytes
      : this.limits.artifact_text_max_bytes;
    if (size > limit) {
      throw new AppError("VALIDATION_FAILED", "Artifact exceeds the size limit; use a file instead.");
    }
    const artifact = await this.artifacts.insert({
      project_id: input.project_id,
      name: input.name.trim(),
      artifact_type: input.artifact_type,
      created_by_user_id: input.created_by_user_id,
    });
    const version = await this.artifacts.insertVersion({
      artifact_id: artifact.id,
      content_type: input.content_type,
      content_ref: input.content,
      checksum: null,
      created_by_user_id: input.created_by_user_id,
      created_by_ai_id: null,
      parent_version_id: null,
    });
    await this.artifacts.update(artifact.id, { current_version_id: version.id });
    return { artifact, version };
  }

  async newVersion(input: {
    artifact_id: string;
    created_by_user_id: string | null;
    content_type: string;
    content: string;
  }): Promise<ArtifactVersion> {
    const artifact = await this.artifacts.findById(input.artifact_id);
    if (!artifact || artifact.status === "DELETED") {
      throw new AppError("NOT_FOUND", "Artifact not found.");
    }
    // §21.3: immutability — a new version row, never an update.
    const versionNumber = await this.artifacts.nextVersionNumber(input.artifact_id);
    const parent = artifact.current_version_id;
    const version = await this.artifacts.insertVersion({
      artifact_id: input.artifact_id,
      version_number: versionNumber,
      content_type: input.content_type,
      content_ref: input.content,
      checksum: null,
      created_by_user_id: input.created_by_user_id,
      created_by_ai_id: null,
      parent_version_id: parent,
    });
    await this.artifacts.update(input.artifact_id, { current_version_id: version.id });
    return version;
  }

  async restoreVersion(artifactId: string, versionNumber: number): Promise<ArtifactVersion> {
    const version = await this.artifacts.findVersion(artifactId, versionNumber);
    if (!version) throw new AppError("NOT_FOUND", "Version not found.");
    // §44 restore = a NEW version with the old content as parent chain.
    return this.newVersion({
      artifact_id: artifactId,
      created_by_user_id: null,
      content_type: version.content_type,
      content: version.content_ref,
    });
  }

  /** §109 version history for an artifact; 404s unknown/deleted artifacts. */
  async listVersions(artifactId: string): Promise<ArtifactVersion[]> {
    const artifact = await this.artifacts.findById(artifactId);
    if (!artifact || artifact.status === "DELETED") {
      throw new AppError("NOT_FOUND", "Artifact not found.");
    }
    return this.artifacts.listVersions(artifactId);
  }

  async listByProject(projectId: string) {
    return this.artifacts.listByProject(projectId);
  }

  async findById(artifactId: string): Promise<Artifact | null> {
    return this.artifacts.findById(artifactId);
  }

  /** Current version row for share/content reads (§109). */
  async currentVersionText(
    artifactId: string,
  ): Promise<(ArtifactVersion & { artifact: Artifact }) | null> {
    const artifact = await this.artifacts.findById(artifactId);
    if (!artifact || artifact.status === "DELETED" || !artifact.current_version_id) {
      return null;
    }
    // The current version number is derivable from the immutable chain.
    const versions = await this.artifacts.listVersions(artifactId);
    const current = versions.find((v) => v.id === artifact.current_version_id) ?? null;
    return current ? { ...current, artifact } : null;
  }

  async pin(artifactId: string, pinned: boolean): Promise<void> {
    await this.artifacts.update(artifactId, { pinned });
  }

  async softDelete(artifactId: string): Promise<void> {
    await this.artifacts.update(artifactId, { status: "DELETED" });
  }
}

/** §47 decisions with §21.2 optimistic concurrency. */
export interface Decision {
  id: string;
  project_id: string;
  title: string;
  context: string | null;
  options: unknown;
  selected_option: unknown;
  rationale: string | null;
  status: "PROPOSED" | "APPROVED" | "REJECTED" | "SUPERSEDED";
  version: number;
  proposed_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
}

export interface DecisionRepository {
  insert(input: { project_id: string; title: string; context: string | null; proposed_by: string }): Promise<Decision>;
  findById(id: string): Promise<Decision | null>;
  listByProject(projectId: string): Promise<Decision[]>;
  compareAndSetStatus(input: { id: string; expectedVersion: number; from: Decision["status"]; to: Decision["status"]; approved_by?: string }): Promise<Decision | null>;
  supersedeOthers(projectId: string, excludingId: string): Promise<void>;
}

export class DecisionService {
  constructor(
    private readonly decisions: DecisionRepository,
    private readonly onApproved: (decision: Decision) => Promise<void>,
  ) {}

  async propose(input: { project_id: string; title: string; context: string | null; proposed_by: string }): Promise<Decision> {
    if (input.title.trim().length === 0) {
      throw new AppError("VALIDATION_FAILED", "Decision title is required.");
    }
    return this.decisions.insert(input);
  }

  async findById(id: string): Promise<Decision | null> {
    return this.decisions.findById(id);
  }

  async listByProject(projectId: string): Promise<Decision[]> {
    return this.decisions.listByProject(projectId);
  }

  async approve(input: { id: string; approver: string; expectedVersion: number }): Promise<Decision> {
    const updated = await this.decisions.compareAndSetStatus({
      id: input.id,
      expectedVersion: input.expectedVersion,
      from: "PROPOSED",
      to: "APPROVED",
      approved_by: input.approver,
    });
    if (!updated) {
      // §21.2: stale version → the client must reconcile.
      throw new AppError("CONFLICT", "Decision changed; reload and retry.");
    }
    await this.decisions.supersedeOthers(updated.project_id, updated.id);
    // §134: approved decisions become high-priority project memory candidates.
    await this.onApproved(updated);
    return updated;
  }

  async reject(input: { id: string; expectedVersion: number }): Promise<Decision> {
    const updated = await this.decisions.compareAndSetStatus({
      id: input.id,
      expectedVersion: input.expectedVersion,
      from: "PROPOSED",
      to: "REJECTED",
    });
    if (!updated) throw new AppError("CONFLICT", "Decision changed; reload and retry.");
    return updated;
  }
}

/** §48 tasks with §21.2 optimistic concurrency + dependencies. */
export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  owner_user_id: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  due_at: string | null;
  version: number;
  created_by_user_id: string | null;
  created_by_ai_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TaskRepository {
  insert(input: { project_id: string; title: string; description: string | null; owner_user_id: string | null; created_by_user_id: string | null }): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  listByProject(projectId: string): Promise<Task[]>;
  compareAndUpdate(input: { id: string; expectedVersion: number; patch: Partial<Pick<Task, "title" | "description" | "owner_user_id" | "status" | "priority" | "due_at">> }): Promise<Task | null>;
  addDependency(taskId: string, dependsOnTaskId: string): Promise<void>;
  dependenciesOf(taskId: string): Promise<string[]>;
}

export class TaskService {
  constructor(private readonly tasks: TaskRepository) {}

  async create(input: Parameters<TaskRepository["insert"]>[0]): Promise<Task> {
    if (input.title.trim().length === 0) {
      throw new AppError("VALIDATION_FAILED", "Task title is required.");
    }
    return this.tasks.insert(input);
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.findById(id);
  }

  async listByProject(projectId: string): Promise<Task[]> {
    return this.tasks.listByProject(projectId);
  }

  /** §21.2 optimistic concurrency: update where version = expected. */
  async update(input: {
    id: string;
    expectedVersion: number;
    patch: Partial<Pick<Task, "title" | "description" | "owner_user_id" | "status" | "priority" | "due_at">>;
  }): Promise<Task> {
    const updated = await this.tasks.compareAndUpdate(input);
    if (!updated) throw new AppError("CONFLICT", "Task changed elsewhere; reload and retry.");
    return updated;
  }

  async complete(input: { id: string; expectedVersion: number }): Promise<Task> {
    return this.update({
      id: input.id,
      expectedVersion: input.expectedVersion,
      patch: { status: "DONE" },
    });
  }

  /** Dependency cycles are rejected (§48 well-formedness). */
  async addDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
    if (taskId === dependsOnTaskId) {
      throw new AppError("VALIDATION_FAILED", "A task cannot depend on itself.");
    }
    // DFS for a cycle: if dependsOn already (transitively) depends on task.
    const seen = new Set<string>();
    const stack = [dependsOnTaskId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === taskId) {
        throw new AppError("CONFLICT", "This dependency would create a cycle.");
      }
      if (seen.has(current)) continue;
      seen.add(current);
      for (const dep of await this.tasks.dependenciesOf(current)) stack.push(dep);
    }
    await this.tasks.addDependency(taskId, dependsOnTaskId);
  }
}

/** §50/§50A meetings. */
export interface MeetingSession {
  id: string;
  group_id: string;
  project_id: string | null;
  started_by: string;
  started_at: string;
  ended_at: string | null;
  status: "ACTIVE" | "ENDED";
  summary_artifact_id: string | null;
}

export interface MeetingCandidate {
  id: string;
  meeting_session_id: string;
  candidate_type: "DECISION" | "TASK" | "OPEN_QUESTION" | "CONTRADICTION" | "RESEARCH_NEED" | "MILESTONE_CHANGE";
  content: Record<string, unknown>;
  confidence: number;
  source_message_id: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "MERGED" | "EXPIRED";
  promoted_to_type: string | null;
  promoted_to_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface MeetingRepository {
  insertSession(input: { group_id: string; project_id: string | null; started_by: string }): Promise<MeetingSession>;
  findSession(id: string): Promise<MeetingSession | null>;
  endSession(id: string, summaryArtifactId: string | null): Promise<void>;
  insertCandidate(input: { meeting_session_id: string; candidate_type: MeetingCandidate["candidate_type"]; content: Record<string, unknown>; confidence: number; source_message_id: string | null }): Promise<MeetingCandidate>;
  findCandidate(id: string): Promise<MeetingCandidate | null>;
  resolveCandidate(id: string, status: MeetingCandidate["status"], promoted?: { promoted_to_type: string; promoted_to_id: string }): Promise<void>;
  listCandidates(sessionId: string): Promise<MeetingCandidate[]>;
  upsertSummary(input: { meeting_session_id: string; summary_text: string }): Promise<void>;
}

/**
 * §50: Detected → Candidate → Approved → Persisted. Nothing detected in a
 * meeting commits to project state without an explicit human acceptance.
 */
export class MeetingService {
  constructor(private readonly meetings: MeetingRepository) {}

  async start(input: { group_id: string; project_id: string | null; started_by: string }): Promise<MeetingSession> {
    return this.meetings.insertSession(input);
  }

  async findSession(id: string): Promise<MeetingSession | null> {
    return this.meetings.findSession(id);
  }

  async listCandidates(sessionId: string): Promise<MeetingCandidate[]> {
    return this.meetings.listCandidates(sessionId);
  }

  async detect(input: {
    meeting_session_id: string;
    candidate_type: MeetingCandidate["candidate_type"];
    content: Record<string, unknown>;
    confidence: number;
    source_message_id: string | null;
  }): Promise<MeetingCandidate> {
    const session = await this.meetings.findSession(input.meeting_session_id);
    if (!session || session.status !== "ACTIVE") {
      throw new AppError("CONFLICT", "No active meeting session.");
    }
    return this.meetings.insertCandidate(input);
  }

  /**
   * §50A: acceptance promotes the candidate to a real object; the promoted
   * id is recorded for the summary's audit trail.
   */
  async acceptCandidate(input: {
    candidate_id: string;
    promote: (candidate: MeetingCandidate) => Promise<{ id: string }>;
  }): Promise<{ promoted_id: string }> {
    const candidate = await this.meetings.findCandidate(input.candidate_id);
    if (!candidate) throw new AppError("NOT_FOUND", "Candidate not found.");
    if (candidate.status !== "PENDING") {
      throw new AppError("CONFLICT", "Candidate already resolved.");
    }
    const created = await input.promote(candidate);
    await this.meetings.resolveCandidate(input.candidate_id, "ACCEPTED", {
      promoted_to_type: candidate.candidate_type === "TASK" ? "task" : "decision",
      promoted_to_id: created.id,
    });
    return { promoted_id: created.id };
  }

  async end(input: { meeting_session_id: string; summary_text: string; summary_artifact_id?: string | null }): Promise<void> {
    await this.meetings.upsertSummary({
      meeting_session_id: input.meeting_session_id,
      summary_text: input.summary_text,
    });
    await this.meetings.endSession(input.meeting_session_id, input.summary_artifact_id ?? null);
    // Unresolved candidates expire at meeting end (§50A/frontend §124A.3:
    // the review flow marks explicit skips; anything left is EXPIRED).
    for (const candidate of await this.meetings.listCandidates(input.meeting_session_id)) {
      if (candidate.status === "PENDING") {
        await this.meetings.resolveCandidate(candidate.id, "EXPIRED");
      }
    }
  }
}

/** §70/§71 proactivity — high-value only, cooldown + per-group limits. */
export interface ProactiveSuggestion {
  id: string;
  group_id: string;
  project_id: string | null;
  reason_code: string;
  summary: string;
  confidence: number;
  status: "PENDING" | "SHOWN" | "ACTED" | "DISMISSED";
  created_at: string;
  shown_at: string | null;
  acted_at: string | null;
}

export interface ProactiveRepository {
  insert(input: { group_id: string; project_id: string | null; reason_code: string; summary: string; confidence: number; created_at?: string }): Promise<ProactiveSuggestion>;
  countRecent(groupId: string, sinceIso: string): Promise<number>;
  latestCreatedAt(groupId: string): Promise<string | null>;
}

export const PROACTIVE_REASON_CODES = [
  "unresolved_contradiction",
  "repeated_architecture_disagreement",
  "obvious_missing_requirement",
  "task_blocked_by_decision",
  "project_state_stale",
] as const;

export class ProactivityService {
  constructor(
    private readonly repo: ProactiveRepository,
    private readonly limits: { cooldown_ms: number; max_per_day: number; min_confidence: number },
  ) {}

  /** §70: cooldown + relevance + confidence + per-group limit gate. */
  async propose(input: {
    group_id: string;
    project_id: string | null;
    reason_code: string;
    summary: string;
    confidence: number;
    now?: Date;
  }): Promise<ProactiveSuggestion | null> {
    if (!(PROACTIVE_REASON_CODES as readonly string[]).includes(input.reason_code)) return null;
    if (input.confidence < this.limits.min_confidence) return null;
    const now = input.now ?? new Date();
    const latest = await this.repo.latestCreatedAt(input.group_id);
    if (latest && now.getTime() - new Date(latest).getTime() < this.limits.cooldown_ms) {
      return null;
    }
    const since = new Date(now.getTime() - 86_400_000).toISOString();
    const recent = await this.repo.countRecent(input.group_id, since);
    if (recent >= this.limits.max_per_day) return null;
    return this.repo.insert({ ...input, created_at: now.toISOString() });
  }
}
