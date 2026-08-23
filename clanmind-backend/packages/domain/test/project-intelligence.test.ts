import { describe, expect, it } from "vitest";
import {
  ARTIFACT_TYPES,
  ArtifactService,
  DecisionService,
  MeetingService,
  ProactivityService,
  TaskService,
  type Artifact,
  type ArtifactRepository,
  type ArtifactVersion,
  type Decision,
  type DecisionRepository,
  type MeetingCandidate,
  type MeetingRepository,
  type MeetingSession,
  type ProactiveRepository,
  type ProactiveSuggestion,
  type Task,
  type TaskRepository,
} from "../src/index";
import { AppError } from "@clanmind/shared";

// ---------- artifacts ----------

function artifactRepo() {
  const artifacts: Artifact[] = [];
  const versions: ArtifactVersion[] = [];
  const r: ArtifactRepository = {
    async insert(input) {
      const a: Artifact = {
        ...input,
        id: crypto.randomUUID(),
        created_by_ai_id: null,
        status: "ACTIVE",
        pinned: false,
        current_version_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
      artifacts.push(a);
      return a;
    },
    async findById(id) {
      return artifacts.find((a) => a.id === id) ?? null;
    },
    async update(id, input) {
      const a = artifacts.find((x) => x.id === id);
      if (!a) return null;
      Object.assign(a, input);
      return a;
    },
    async listByProject(projectId) {
      return artifacts.filter((a) => a.project_id === projectId);
    },
    async nextVersionNumber(artifactId) {
      return versions.filter((v) => v.artifact_id === artifactId).length + 1;
    },
    async insertVersion(input) {
      const v: ArtifactVersion = {
        ...input,
        version_number: input.version_number ?? versions.filter((x) => x.artifact_id === input.artifact_id).length + 1,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      versions.push(v);
      return v;
    },
    async findVersion(artifactId, versionNumber) {
      return versions.find((v) => v.artifact_id === artifactId && v.version_number === versionNumber) ?? null;
    },
    async listVersions(artifactId) {
      return versions
        .filter((v) => v.artifact_id === artifactId)
        .sort((a, b) => a.version_number - b.version_number);
    },
    async addLink() {},
  };
  return { artifacts, versions, r };
}

describe("§44/§45 artifacts", () => {
  it("creates an artifact with version 1 and advances immutably", async () => {
    const s = artifactRepo();
    const svc = new ArtifactService(s.r, { artifact_text_max_bytes: 500_000, artifact_binary_max_bytes: 10_485_760 });
    const { artifact } = await svc.create({
      project_id: "p1",
      name: "Architecture",
      artifact_type: "ARCHITECTURE",
      created_by_user_id: "u1",
      content_type: "application/json",
      content: '{"nodes":[]}',
      is_binary: false,
    });
    expect(ARTIFACT_TYPES).toHaveLength(17);
    const v1 = await s.r.findVersion(artifact.id, 1);
    const v2 = await svc.newVersion({ artifact_id: artifact.id, created_by_user_id: "u1", content_type: "application/json", content: '{"nodes":[1]}' });
    expect(v2.version_number).toBe(2);
    expect(v2.parent_version_id).toBe(v1?.id);
    // v1 untouched (§21.3 immutability)
    expect(v1?.content_ref).toBe('{"nodes":[]}');
  });

  it("restore creates a new version with old content (§44)", async () => {
    const s = artifactRepo();
    const svc = new ArtifactService(s.r, { artifact_text_max_bytes: 500_000, artifact_binary_max_bytes: 10_485_760 });
    const { artifact } = await svc.create({
      project_id: "p1",
      name: "Doc",
      artifact_type: "MARKDOWN",
      created_by_user_id: "u1",
      content_type: "text/markdown",
      content: "v1 content",
      is_binary: false,
    });
    await svc.newVersion({ artifact_id: artifact.id, created_by_user_id: "u1", content_type: "text/markdown", content: "v2 content" });
    const restored = await svc.restoreVersion(artifact.id, 1);
    expect(restored.version_number).toBe(3);
    expect(restored.content_ref).toBe("v1 content");
  });

  it("rejects oversized text artifacts (§178: 500 KB)", async () => {
    const s = artifactRepo();
    const svc = new ArtifactService(s.r, { artifact_text_max_bytes: 10, artifact_binary_max_bytes: 100 });
    await expect(
      svc.create({
        project_id: "p1",
        name: "Big",
        artifact_type: "DOCUMENT",
        created_by_user_id: "u1",
        content_type: "text/plain",
        content: "x".repeat(11),
        is_binary: false,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});

// ---------- decisions ----------

function decisionRepo() {
  const rows: Decision[] = [];
  const approved: Decision[] = [];
  const r: DecisionRepository = {
    async insert(input) {
      const d: Decision = {
        ...input,
        id: crypto.randomUUID(),
        options: null,
        selected_option: null,
        rationale: null,
        status: "PROPOSED",
        version: 1,
        approved_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        approved_at: null,
      };
      rows.push(d);
      return d;
    },
    async findById(id) {
      return rows.find((d) => d.id === id) ?? null;
    },
    async listByProject(projectId) {
      return rows.filter((d) => d.project_id === projectId);
    },
    async compareAndSetStatus(input) {
      const d = rows.find((x) => x.id === input.id);
      if (!d || d.version !== input.expectedVersion || d.status !== input.from) return null;
      d.status = input.to;
      d.version += 1;
      if (input.approved_by) {
        d.approved_by = input.approved_by;
        d.approved_at = new Date().toISOString();
      }
      return d;
    },
    async supersedeOthers(projectId, excludingId) {
      for (const d of rows) {
        if (d.project_id === projectId && d.id !== excludingId && d.status === "APPROVED") {
          d.status = "SUPERSEDED";
        }
      }
    },
  };
  return { rows, approved, r };
}

describe("§47/§134 decisions", () => {
  it("approval uses optimistic concurrency and triggers memory promotion", async () => {
    const s = decisionRepo();
    const svc = new DecisionService(s.r, async (d) => {
      s.approved.push(d);
    });
    const decision = await svc.propose({ project_id: "p1", title: "Use PostgreSQL", context: null, proposed_by: "u1" });
    const approvedDecision = await svc.approve({ id: decision.id, approver: "u2", expectedVersion: 1 });
    expect(approvedDecision.status).toBe("APPROVED");
    expect(s.approved).toHaveLength(1);

    await expect(svc.approve({ id: decision.id, approver: "u2", expectedVersion: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

// ---------- tasks ----------

function taskRepo() {
  const rows: Task[] = [];
  const deps = new Map<string, string[]>();
  const r: TaskRepository = {
    async insert(input) {
      const t: Task = {
        ...input,
        id: crypto.randomUUID(),
        status: "TODO",
        priority: "MEDIUM",
        due_at: null,
        version: 1,
        created_by_ai_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
      };
      rows.push(t);
      return t;
    },
    async findById(id) {
      return rows.find((t) => t.id === id) ?? null;
    },
    async listByProject(projectId) {
      return rows.filter((t) => t.project_id === projectId);
    },
    async compareAndUpdate(input) {
      const t = rows.find((x) => x.id === input.id);
      if (!t || t.version !== input.expectedVersion) return null;
      Object.assign(t, input.patch);
      t.version += 1;
      return t;
    },
    async addDependency(taskId, dependsOnTaskId) {
      deps.set(taskId, [...(deps.get(taskId) ?? []), dependsOnTaskId]);
    },
    async dependenciesOf(taskId) {
      return deps.get(taskId) ?? [];
    },
  };
  return { rows, r };
}

describe("§48/§21.2 tasks", () => {
  it("updates with optimistic concurrency; stale versions conflict", async () => {
    const s = taskRepo();
    const svc = new TaskService(s.r);
    const task = await svc.create({ project_id: "p1", title: "Write API", description: null, owner_user_id: "u1", created_by_user_id: "u1" });
    await svc.update({ id: task.id, expectedVersion: 1, patch: { status: "IN_PROGRESS" } });
    await expect(svc.complete({ id: task.id, expectedVersion: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
    const done = await svc.complete({ id: task.id, expectedVersion: 2 });
    expect(done.status).toBe("DONE");
  });

  it("rejects dependency cycles", async () => {
    const s = taskRepo();
    const svc = new TaskService(s.r);
    const a = await svc.create({ project_id: "p1", title: "A", description: null, owner_user_id: null, created_by_user_id: "u1" });
    const b = await svc.create({ project_id: "p1", title: "B", description: null, owner_user_id: null, created_by_user_id: "u1" });
    await svc.addDependency(a.id, b.id);
    await expect(svc.addDependency(b.id, a.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(svc.addDependency(a.id, a.id)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});

// ---------- meetings ----------

function meetingRepo() {
  const sessions: MeetingSession[] = [];
  const candidates: MeetingCandidate[] = [];
  const summaries = new Map<string, string>();
  const r: MeetingRepository = {
    async insertSession(input) {
      const s: MeetingSession = {
        ...input,
        id: crypto.randomUUID(),
        started_at: new Date().toISOString(),
        ended_at: null,
        status: "ACTIVE",
        summary_artifact_id: null,
      };
      sessions.push(s);
      return s;
    },
    async findSession(id) {
      return sessions.find((s) => s.id === id) ?? null;
    },
    async endSession(id, summaryArtifactId) {
      const s = sessions.find((x) => x.id === id);
      if (s) {
        s.status = "ENDED";
        s.ended_at = new Date().toISOString();
        s.summary_artifact_id = summaryArtifactId;
      }
    },
    async insertCandidate(input) {
      const c: MeetingCandidate = {
        ...input,
        status: "PENDING",
        promoted_to_type: null,
        promoted_to_id: null,
        created_at: new Date().toISOString(),
        resolved_at: null,
        id: crypto.randomUUID(),
      };
      candidates.push(c);
      return c;
    },
    async findCandidate(id) {
      return candidates.find((c) => c.id === id) ?? null;
    },
    async resolveCandidate(id, status, promoted) {
      const c = candidates.find((x) => x.id === id);
      if (c) {
        c.status = status;
        c.resolved_at = new Date().toISOString();
        if (promoted) {
          c.promoted_to_type = promoted.promoted_to_type;
          c.promoted_to_id = promoted.promoted_to_id;
        }
      }
    },
    async listCandidates(sessionId) {
      return candidates.filter((c) => c.meeting_session_id === sessionId);
    },
    async upsertSummary(input) {
      summaries.set(input.meeting_session_id, input.summary_text);
    },
  };
  return { sessions, candidates, r };
}

describe("§50/§50A meetings", () => {
  it("candidates promote through Detected → Accepted → Persisted", async () => {
    const s = meetingRepo();
    const svc = new MeetingService(s.r);
    const session = await svc.start({ group_id: "g1", project_id: "p1", started_by: "u1" });
    const candidate = await svc.detect({
      meeting_session_id: session.id,
      candidate_type: "DECISION",
      content: { title: "Use SQLite for prototyping" },
      confidence: 0.8,
      source_message_id: null,
    });
    const result = await svc.acceptCandidate({
      candidate_id: candidate.id,
      promote: async (c) => ({ id: `decision-${c.candidate_type}` }),
    });
    expect(result.promoted_id).toBe("decision-DECISION");
    const stored = s.candidates.find((c) => c.id === candidate.id);
    expect(stored?.status).toBe("ACCEPTED");
    expect(stored?.promoted_to_type).toBe("decision");
  });

  it("detection requires an ACTIVE session; ending expires pending candidates", async () => {
    const s = meetingRepo();
    const svc = new MeetingService(s.r);
    const session = await svc.start({ group_id: "g1", project_id: null, started_by: "u1" });
    const c1 = await svc.detect({ meeting_session_id: session.id, candidate_type: "TASK", content: {}, confidence: 0.7, source_message_id: null });
    await svc.detect({ meeting_session_id: session.id, candidate_type: "OPEN_QUESTION", content: {}, confidence: 0.6, source_message_id: null });
    await svc.end({ meeting_session_id: session.id, summary_text: "summary" });
    await expect(
      svc.detect({ meeting_session_id: session.id, candidate_type: "TASK", content: {}, confidence: 0.9, source_message_id: null }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(s.candidates.every((c) => c.status === "EXPIRED" || c.id === c1.id)).toBe(true);
  });
});

// ---------- proactivity ----------

function proactiveRepo() {
  const rows: ProactiveSuggestion[] = [];
  const r: ProactiveRepository = {
    async insert(input) {
      const row: ProactiveSuggestion = {
        ...input,
        status: "PENDING",
        created_at: input.created_at ?? new Date().toISOString(),
        shown_at: null,
        acted_at: null,
        id: crypto.randomUUID(),
      };
      rows.push(row);
      return row;
    },
    async countRecent(groupId, since) {
      return rows.filter((p) => p.group_id === groupId && p.created_at >= since).length;
    },
    async latestCreatedAt(groupId) {
      const groupRows = rows.filter((p) => p.group_id === groupId);
      return groupRows.length ? groupRows.at(-1)!.created_at : null;
    },
  };
  return { rows, r };
}

describe("§70/§71 proactivity limits", () => {
  it("suppresses low-confidence, unknown reasons, cooldown, and daily cap", async () => {
    const s = proactiveRepo();
    const svc = new ProactivityService(s.r, { cooldown_ms: 60_000, max_per_day: 2, min_confidence: 0.8 });
    // Start the fake clock ahead of the real one so repo rows (stamped with
    // the real clock) never violate the cooldown arithmetic.
    const now = new Date(Date.now() + 3_600_000);

    expect(
      await svc.propose({ group_id: "g1", project_id: null, reason_code: "timer_elapsed", summary: "s", confidence: 0.99, now }),
    ).toBeNull();
    expect(
      await svc.propose({ group_id: "g1", project_id: null, reason_code: "unresolved_contradiction", summary: "s", confidence: 0.5, now }),
    ).toBeNull();
    expect(
      await svc.propose({ group_id: "g1", project_id: null, reason_code: "unresolved_contradiction", summary: "s", confidence: 0.9, now }),
    ).not.toBeNull();
    expect(
      await svc.propose({ group_id: "g1", project_id: null, reason_code: "task_blocked_by_decision", summary: "s", confidence: 0.9, now }),
    ).toBeNull(); // cooldown
    const later = new Date(now.getTime() + 120_000);
    expect(
      await svc.propose({ group_id: "g1", project_id: null, reason_code: "task_blocked_by_decision", summary: "s", confidence: 0.9, now: later }),
    ).not.toBeNull();
    const evenLater = new Date(now.getTime() + 240_000);
    expect(
      await svc.propose({ group_id: "g1", project_id: null, reason_code: "project_state_stale", summary: "s", confidence: 0.9, now: evenLater }),
    ).toBeNull(); // daily cap of 2 reached
  });
});
