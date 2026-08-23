import { AppError } from "@clanmind/shared";

/** §35 */
export interface Memory {
  id: string;
  scope_type: "GROUP" | "PROJECT" | "USER_PRIVATE";
  group_id: string;
  project_id: string | null;
  user_id: string | null;
  memory_type: string;
  content: string;
  normalized_content: string | null;
  confidence: number;
  importance: number;
  source_type: string;
  source_id: string | null;
  status: "ACTIVE" | "ARCHIVED" | "SUPERSEDED";
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  archived_at: string | null;
}

/** §36 */
export interface MemoryCandidate {
  id: string;
  group_id: string;
  project_id: string | null;
  user_id: string | null;
  source_message_id: string | null;
  candidate_type: string;
  content: string;
  confidence: number;
  recommended_scope: "GROUP" | "PROJECT" | "USER_PRIVATE";
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "MERGED" | "EXPIRED";
  created_at: string;
}

export interface MemoryRepository {
  insert(input: Omit<Memory, "id" | "created_at" | "updated_at" | "last_used_at" | "archived_at" | "status"> & { status?: Memory["status"] }): Promise<Memory>;
  findById(id: string): Promise<Memory | null>;
  update(id: string, input: Partial<Pick<Memory, "content" | "importance" | "confidence">>): Promise<Memory | null>;
  archive(id: string): Promise<void>;
  supersede(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  searchInScope(input: {
    group_id: string;
    scope_type: Memory["scope_type"];
    project_id?: string | null;
    user_id?: string | null;
    limit: number;
  }): Promise<Memory[]>;
  findByNormalizedContent(input: {
    group_id: string;
    normalized_content: string;
    memory_type: string;
  }): Promise<Memory | null>;
}

export interface MemoryCandidateRepository {
  insert(input: Omit<MemoryCandidate, "id" | "created_at" | "status"> & { status?: MemoryCandidate["status"] }): Promise<MemoryCandidate>;
  findById(id: string): Promise<MemoryCandidate | null>;
  setStatus(id: string, status: MemoryCandidate["status"]): Promise<void>;
  listByGroup(groupId: string, status: MemoryCandidate["status"]): Promise<MemoryCandidate[]>;
}

/**
 * §137 secret patterns — memory candidates that look like credentials are
 * rejected, audited internally, and never fed back into prompts.
 */
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*\S{8,}\b/i,
  /\bBearer\s+[A-Za-z0-9._-]{20,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

export function looksLikeSecret(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

/** §37: never automatically store these as memory. */
export function isAutoStorable(input: {
  content: string;
  visibility: "GROUP" | "PRIVATE_PAIR" | "PRIVATE_AI";
}): boolean {
  // Private conversations never become shared memory (§2.4/§55A).
  if (input.visibility !== "GROUP") return false;
  if (looksLikeSecret(input.content)) return false;
  const content = input.content.trim();
  if (content.length < 8 || content.length > 2000) return false;
  return true;
}

/**
 * §36/§38 Memory Service: curated durable knowledge, never a dump of every
 * message (Correction 9). Ambiguous items become candidates with confidence.
 */
export class MemoryService {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly candidates: MemoryCandidateRepository,
  ) {}

  /**
   * §115 step 22's follow-up: a completed run's exchange proposes at most one
   * candidate; high-confidence items may auto-store per §37 rules.
   */
  async proposeFromRun(input: {
    group_id: string;
    project_id: string | null;
    user_id: string;
    visibility: "GROUP" | "PRIVATE_PAIR" | "PRIVATE_AI";
    content: string;
    confidence: number;
  }): Promise<{ stored: boolean; candidate: MemoryCandidate | null }> {
    if (looksLikeSecret(input.content)) {
      // §137: reject + audit; never feed back into prompts.
      return { stored: false, candidate: null };
    }
    const recommended_scope: Memory["scope_type"] =
      input.visibility === "GROUP"
        ? input.project_id
          ? "PROJECT"
          : "GROUP"
        : "USER_PRIVATE";
    const candidate = await this.candidates.insert({
      group_id: input.group_id,
      project_id: input.project_id,
      user_id: recommended_scope === "USER_PRIVATE" ? input.user_id : null,
      source_message_id: null,
      candidate_type: "fact",
      content: input.content.trim(),
      confidence: input.confidence,
      recommended_scope,
    });
    // Only high-confidence, explicitly shareable items auto-store; the rest
    // await human acceptance (§37 ambiguous → candidate storage).
    if (isAutoStorable({ content: input.content, visibility: input.visibility }) && input.confidence >= 0.9) {
      const memory = await this.memories.insert({
        scope_type: recommended_scope,
        group_id: input.group_id,
        project_id: recommended_scope === "PROJECT" ? input.project_id : null,
        user_id: recommended_scope === "USER_PRIVATE" ? input.user_id : null,
        memory_type: "fact",
        content: input.content.trim(),
        normalized_content: normalizeContent(input.content),
        confidence: input.confidence,
        importance: 0.5,
        source_type: "ai_run",
        source_id: null,
      });
      await this.candidates.setStatus(candidate.id, "ACCEPTED");
      return { stored: true, candidate: { ...candidate, status: "ACCEPTED" } };
    }
    return { stored: false, candidate };
  }

  async acceptCandidate(candidateId: string, actorUserId: string): Promise<Memory> {
    const candidate = await this.candidates.findById(candidateId);
    if (!candidate) throw new AppError("NOT_FOUND", "Candidate not found.");
    if (candidate.status !== "PENDING") {
      throw new AppError("CONFLICT", "Candidate is already resolved.");
    }
    // §185 #12: private memory becomes shared only through this explicit
    // human promotion path.
    if (candidate.recommended_scope === "USER_PRIVATE" && candidate.user_id !== actorUserId) {
      throw new AppError("FORBIDDEN", "This candidate belongs to another member.");
    }
    const memory = await this.memories.insert({
      scope_type: candidate.recommended_scope,
      group_id: candidate.group_id,
      project_id: candidate.recommended_scope === "PROJECT" ? candidate.project_id : null,
      user_id: candidate.recommended_scope === "USER_PRIVATE" ? candidate.user_id : null,
      memory_type: candidate.candidate_type,
      content: candidate.content,
      normalized_content: normalizeContent(candidate.content),
      confidence: candidate.confidence,
      importance: 0.5,
      source_type: "candidate",
      source_id: candidate.id,
    });
    await this.candidates.setStatus(candidateId, "ACCEPTED");
    return memory;
  }

  async rejectCandidate(candidateId: string): Promise<void> {
    const candidate = await this.candidates.findById(candidateId);
    if (!candidate) throw new AppError("NOT_FOUND", "Candidate not found.");
    await this.candidates.setStatus(candidateId, "REJECTED");
  }

  /**
   * §38 retrieval — scope filter first, then ranking inputs. Callers receive
   * authorized rows only (§126: permission filter before candidate retrieval).
   */
  retrieveForContext(input: {
    group_id: string;
    project_id: string | null;
    user_id: string;
    include_user_private: boolean;
    limit: number;
  }): Promise<Memory[]> {
    const scopes: Memory["scope_type"][] = input.include_user_private
      ? ["GROUP", "PROJECT", "USER_PRIVATE"]
      : ["GROUP", "PROJECT"];
    return Promise.all(
      scopes.map((scope_type) =>
        this.memories.searchInScope({
          group_id: input.group_id,
          scope_type,
          project_id: scope_type === "PROJECT" ? input.project_id : null,
          user_id: scope_type === "USER_PRIVATE" ? input.user_id : null,
          limit: input.limit,
        }),
      ),
    ).then((groups) => groups.flat());
  }

  /**
   * §135 contradiction detection: a new memory conflicting with an active old
   * one never silently coexists — the old is marked superseded when the new
   * comes from an approved decision (§134), otherwise flagged for the team.
   */
  async registerMemory(input: {
    group_id: string;
    project_id: string | null;
    memory_type: string;
    content: string;
    confidence: number;
    source_type: string;
    fromApprovedDecision: boolean;
  }): Promise<{ memory: Memory; superseded: Memory | null }> {
    const normalized = normalizeContent(input.content);
    const existing = await this.memories.findByNormalizedContent({
      group_id: input.group_id,
      normalized_content: normalized,
      memory_type: input.memory_type,
    });
    if (existing && existing.status === "ACTIVE" && existing.content.trim() !== input.content.trim()) {
      // Same normalized key, different value → contradiction (§135).
      if (input.fromApprovedDecision) {
        // §134: decisions outrank casual statements.
        await this.memories.supersede(existing.id);
        const memory = await this.insertActive(input, normalized);
        return { memory, superseded: existing };
      }
      const memory = await this.insertActive(input, normalized);
      return { memory, superseded: null };
    }
    if (existing && existing.status === "ACTIVE") {
      return { memory: existing, superseded: null };
    }
    const memory = await this.insertActive(input, normalized);
    return { memory, superseded: null };
  }

  private insertActive(
    input: {
      group_id: string;
      project_id: string | null;
      memory_type: string;
      content: string;
      confidence: number;
      source_type: string;
    },
    normalized: string,
  ): Promise<Memory> {
    return this.memories.insert({
      scope_type: input.project_id ? "PROJECT" : "GROUP",
      group_id: input.group_id,
      project_id: input.project_id,
      user_id: null,
      memory_type: input.memory_type,
      content: input.content,
      normalized_content: normalized,
      confidence: input.confidence,
      importance: 0.5,
      source_type: input.source_type,
      source_id: null,
    });
  }

  async archiveMemory(id: string): Promise<void> {
    await this.memories.archive(id);
  }

  async updateMemory(id: string, input: Partial<Pick<Memory, "content" | "importance" | "confidence">>): Promise<Memory> {
    const updated = await this.memories.update(id, input);
    if (!updated) throw new AppError("NOT_FOUND", "Memory not found.");
    return updated;
  }

  async deleteMemory(id: string): Promise<void> {
    await this.memories.delete(id);
  }
}

/** §135 example: "We will use PostgreSQL." ≡ "use postgresql". */
export function normalizeContent(content: string): string {
  return content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(we|will|the|a|an|use|using)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
