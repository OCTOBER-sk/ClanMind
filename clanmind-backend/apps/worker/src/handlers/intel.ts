import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "@clanmind/shared";
import type { ArtifactType } from "@clanmind/contracts";
import {
  ARTIFACT_TYPES,
  type Artifact,
  type Decision,
  type MeetingCandidate,
  type MeetingSession,
  type Task,
} from "@clanmind/domain";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuthenticatedUser } from "../middleware/auth";
import type { AppServices } from "../services";

const createArtifactBody = z.object({
  name: z.string().min(1).max(200),
  artifact_type: z.enum(ARTIFACT_TYPES as [ArtifactType, ...ArtifactType[]]),
  content_type: z.string().min(1).max(100).default("text/markdown"),
  content: z.string().min(1),
});

const newVersionBody = z.object({
  content_type: z.string().min(1).max(100).default("text/markdown"),
  content: z.string().min(1),
});

const restoreBody = z.object({ version_number: z.number().int().positive() });
const pinBody = z.object({ pinned: z.boolean() });

const createDecisionBody = z.object({
  title: z.string().min(1).max(300),
  context: z.string().max(8000).nullable().optional(),
});

const decisionActionBody = z.object({ expected_version: z.number().int().nonnegative() });

const createTaskBody = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(8000).nullable().optional(),
  owner_user_id: z.string().uuid().nullable().optional(),
});

const patchTaskBody = z.object({
  expected_version: z.number().int().nonnegative(),
  patch: z.object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(8000).nullable().optional(),
    owner_user_id: z.string().uuid().nullable().optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    due_at: z.string().datetime().nullable().optional(),
  }),
});

const completeTaskBody = z.object({ expected_version: z.number().int().nonnegative() });
const dependencyBody = z.object({ depends_on_task_id: z.string().uuid() });

const startMeetingBody = z.object({});
const endMeetingBody = z.object({ summary_text: z.string().min(1) });
const detectBody = z.object({
  candidate_type: z.enum([
    "DECISION",
    "TASK",
    "OPEN_QUESTION",
    "CONTRADICTION",
    "RESEARCH_NEED",
    "MILESTONE_CHANGE",
  ]),
  content: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  source_message_id: z.string().uuid().nullable().optional(),
});
const acceptCandidateBody = z.object({
  promote: z.enum(["task", "decision"]),
});

/**
 * §109–§112 project-intelligence endpoints. Every object path authorizes the
 * enclosing Project first (§86); CAS fields implement §21.2 concurrency.
 */
export function intelRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.use("*", requireAuthenticatedUser);

  // --- §109 artifacts -----------------------------------------------------

  app.get("/api/v1/projects/:projectId/artifacts", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const project = await services.projects.get(c.req.param("projectId"), user.user_id);
    const items = await services.artifacts.listByProject(project.id);
    return c.json({ items });
  });

  app.post("/api/v1/projects/:projectId/artifacts", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const project = await services.projects.get(c.req.param("projectId"), user.user_id);
    const parsed = createArtifactBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid artifact body.");
    const { artifact, version } = await services.artifacts.create({
      project_id: project.id,
      name: parsed.data.name,
      artifact_type: parsed.data.artifact_type,
      created_by_user_id: user.user_id,
      content_type: parsed.data.content_type,
      content: parsed.data.content,
      is_binary: false,
    });
    return c.json({ artifact, version }, 201);
  });

  app.get("/api/v1/artifacts/:artifactId", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const artifact = await requireArtifact(services.artifacts, c.req.param("artifactId"));
    await services.projects.get(artifact.project_id, user.user_id);
    return c.json({ artifact });
  });

  app.get("/api/v1/artifacts/:artifactId/versions", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const artifact = await requireArtifact(services.artifacts, c.req.param("artifactId"));
    await services.projects.get(artifact.project_id, user.user_id);
    const items = await services.artifacts.listVersions(artifact.id);
    return c.json({ items });
  });

  app.post("/api/v1/artifacts/:artifactId/versions", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const artifact = await requireArtifact(services.artifacts, c.req.param("artifactId"));
    await services.projects.get(artifact.project_id, user.user_id);
    const parsed = newVersionBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid version body.");
    const version = await services.artifacts.newVersion({
      artifact_id: artifact.id,
      created_by_user_id: user.user_id,
      content_type: parsed.data.content_type,
      content: parsed.data.content,
    });
    return c.json(version, 201);
  });

  app.post("/api/v1/artifacts/:artifactId/restore", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const artifact = await requireArtifact(services.artifacts, c.req.param("artifactId"));
    await services.projects.get(artifact.project_id, user.user_id);
    const parsed = restoreBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "version_number is required.");
    const version = await services.artifacts.restoreVersion(artifact.id, parsed.data.version_number);
    return c.json(version, 201);
  });

  app.post("/api/v1/artifacts/:artifactId/pin", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const artifact = await requireArtifact(services.artifacts, c.req.param("artifactId"));
    await services.projects.get(artifact.project_id, user.user_id);
    const parsed = pinBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "pinned is required.");
    await services.artifacts.pin(artifact.id, parsed.data.pinned);
    return c.json({ ok: true });
  });

  app.delete("/api/v1/artifacts/:artifactId", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const artifact = await requireArtifact(services.artifacts, c.req.param("artifactId"));
    await services.projects.get(artifact.project_id, user.user_id);
    await services.artifacts.softDelete(artifact.id);
    return c.json({ ok: true });
  });

  // §84-style share link bound to the artifact id with a short lifetime.
  app.post("/api/v1/artifacts/:artifactId/share", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const artifact = await requireArtifact(services.artifacts, c.req.param("artifactId"));
    await services.projects.get(artifact.project_id, user.user_id);
    const expiresAt = Date.now() + services.limits.signed_url_lifetime_seconds * 1000;
    const token = await services.signedUrls.sign({ attachment_id: artifact.id, expires_at: expiresAt });
    return c.json({
      url: `/api/v1/artifacts/${artifact.id}/content?token=${token}&expires_at=${expiresAt}`,
      expires_at: expiresAt,
    });
  });

  app.get("/api/v1/artifacts/:artifactId/content", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const artifact = await requireArtifact(services.artifacts, c.req.param("artifactId"));
    await services.projects.get(artifact.project_id, user.user_id);
    const ok = await services.signedUrls.verify(
      c.req.query("token") ?? "",
      artifact.id,
      Date.now(),
    );
    if (!ok) throw new AppError("FORBIDDEN", "This link is invalid or has expired.");
    const current =
      artifact.current_version_id === null
        ? null
        : await services.artifacts.currentVersionText(artifact.id);
    if (!current) throw new AppError("NOT_FOUND", "Artifact has no content yet.");
    return c.json({
      artifact_id: artifact.id,
      content_type: current.content_type,
      content: current.content_ref,
    });
  });

  // --- §110 decisions -----------------------------------------------------

  app.get("/api/v1/projects/:projectId/decisions", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const project = await services.projects.get(c.req.param("projectId"), user.user_id);
    const items = await services.decisions.listByProject(project.id);
    return c.json({ items });
  });

  app.post("/api/v1/projects/:projectId/decisions", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const project = await services.projects.get(c.req.param("projectId"), user.user_id);
    const parsed = createDecisionBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid decision body.");
    const decision = await services.decisions.propose({
      project_id: project.id,
      title: parsed.data.title,
      context: parsed.data.context ?? null,
      proposed_by: user.user_id,
    });
    return c.json(decision, 201);
  });

  app.get("/api/v1/decisions/:decisionId", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const decision = await requireDecision(services.decisions, c.req.param("decisionId"));
    await services.projects.get(decision.project_id, user.user_id);
    return c.json(decision);
  });

  app.post("/api/v1/decisions/:decisionId/approve", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const decision = await requireDecision(services.decisions, c.req.param("decisionId"));
    await services.projects.get(decision.project_id, user.user_id);
    const parsed = decisionActionBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "expected_version is required.");
    // Approve triggers supersedeOthers + §134 memory promotion inside the service.
    const updated = await services.decisions.approve({
      id: decision.id,
      approver: user.user_id,
      expectedVersion: parsed.data.expected_version,
    });
    return c.json(updated);
  });

  app.post("/api/v1/decisions/:decisionId/reject", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const decision = await requireDecision(services.decisions, c.req.param("decisionId"));
    await services.projects.get(decision.project_id, user.user_id);
    const parsed = decisionActionBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "expected_version is required.");
    await services.decisions.reject({ id: decision.id, expectedVersion: parsed.data.expected_version });
    return c.json({ ok: true });
  });

  // --- §111 tasks ---------------------------------------------------------

  app.get("/api/v1/projects/:projectId/tasks", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const project = await services.projects.get(c.req.param("projectId"), user.user_id);
    const items = await services.tasks.listByProject(project.id);
    return c.json({ items });
  });

  app.post("/api/v1/projects/:projectId/tasks", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const project = await services.projects.get(c.req.param("projectId"), user.user_id);
    const parsed = createTaskBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid task body.");
    const task = await services.tasks.create({
      project_id: project.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      owner_user_id: parsed.data.owner_user_id ?? null,
      created_by_user_id: user.user_id,
    });
    return c.json(task, 201);
  });

  app.get("/api/v1/tasks/:taskId", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const task = await requireTask(services.tasks, c.req.param("taskId"));
    await services.projects.get(task.project_id, user.user_id);
    return c.json(task);
  });

  app.patch("/api/v1/tasks/:taskId", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const task = await requireTask(services.tasks, c.req.param("taskId"));
    await services.projects.get(task.project_id, user.user_id);
    const parsed = patchTaskBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid task patch.");
    const updated = await services.tasks.update({
      id: task.id,
      expectedVersion: parsed.data.expected_version,
      patch: parsed.data.patch,
    });
    return c.json(updated);
  });

  app.post("/api/v1/tasks/:taskId/complete", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const task = await requireTask(services.tasks, c.req.param("taskId"));
    await services.projects.get(task.project_id, user.user_id);
    const parsed = completeTaskBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "expected_version is required.");
    const updated = await services.tasks.complete({
      id: task.id,
      expectedVersion: parsed.data.expected_version,
    });
    return c.json(updated);
  });

  app.post("/api/v1/tasks/:taskId/dependencies", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const task = await requireTask(services.tasks, c.req.param("taskId"));
    await services.projects.get(task.project_id, user.user_id);
    const parsed = dependencyBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "depends_on_task_id is required.");
    const other = await requireTask(services.tasks, parsed.data.depends_on_task_id);
    if (other.project_id !== task.project_id) {
      throw new AppError("VALIDATION_FAILED", "Dependency must live in the same project.");
    }
    // Cycle-checked inside the service (§48 well-formedness).
    await services.tasks.addDependency(task.id, other.id);
    return c.json({ ok: true }, 201);
  });

  // --- §112 meetings ------------------------------------------------------

  app.post("/api/v1/projects/:projectId/meetings", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const project = await services.projects.get(c.req.param("projectId"), user.user_id);
    startMeetingBody.safeParse((await c.req.json().catch(() => ({}))) as unknown);
    const session = await services.meetings.start({
      group_id: project.group_id,
      project_id: project.id,
      started_by: user.user_id,
    });
    return c.json(session, 201);
  });

  app.get("/api/v1/meetings/:meetingId", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const session = await requireMeeting(services.meetings, c.req.param("meetingId"));
    await services.membership.requireMember(session.group_id, user.user_id);
    const candidates = await services.meetings.listCandidates(session.id);
    return c.json({ session, candidates });
  });

  app.post("/api/v1/meetings/:meetingId/end", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const session = await requireMeeting(services.meetings, c.req.param("meetingId"));
    await services.membership.requireMember(session.group_id, user.user_id);
    const parsed = endMeetingBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "summary_text is required.");
    await services.meetings.end({
      meeting_session_id: session.id,
      summary_text: parsed.data.summary_text,
    });
    return c.json({ ok: true });
  });

  // §50A extra: explicit detection intake + human acceptance promotion.
  app.post("/api/v1/meetings/:meetingId/candidates", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const session = await requireMeeting(services.meetings, c.req.param("meetingId"));
    await services.membership.requireMember(session.group_id, user.user_id);
    const parsed = detectBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid candidate body.");
    const candidate = await services.meetings.detect({
      meeting_session_id: session.id,
      candidate_type: parsed.data.candidate_type,
      content: parsed.data.content,
      confidence: parsed.data.confidence,
      source_message_id: parsed.data.source_message_id ?? null,
    });
    return c.json(candidate, 201);
  });

  app.post("/api/v1/meetings/:meetingId/candidates/:candidateId/accept", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const session = await requireMeeting(services.meetings, c.req.param("meetingId"));
    await services.membership.requireMember(session.group_id, user.user_id);
    const parsed = acceptCandidateBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "promote ('task'|'decision') is required.");
    if (!session.project_id) {
      throw new AppError("VALIDATION_FAILED", "Meeting has no active project context.");
    }
    const result = await services.meetings.acceptCandidate({
      candidate_id: c.req.param("candidateId"),
      promote: async (candidate: MeetingCandidate) => {
        if (parsed.data.promote === "task") {
          const task = await services.tasks.create({
            project_id: session.project_id!,
            title: String(candidate.content["title"] ?? "Untitled task"),
            description:
              typeof candidate.content["description"] === "string"
                ? (candidate.content["description"] as string)
                : null,
            owner_user_id: null,
            created_by_user_id: user.user_id,
          });
          return { id: task.id };
        }
        const decision = await services.decisions.propose({
          project_id: session.project_id!,
          title: String(candidate.content["title"] ?? "Untitled decision"),
          context:
            typeof candidate.content["context"] === "string"
              ? (candidate.content["context"] as string)
              : null,
          proposed_by: user.user_id,
        });
        return { id: decision.id };
      },
    });
    return c.json(result, 201);
  });

  return app;
}

async function requireArtifact(
  artifacts: { findById(id: string): Promise<Artifact | null> },
  id: string,
): Promise<Artifact> {
  const artifact = await artifacts.findById(id);
  if (!artifact || artifact.status === "DELETED") {
    throw new AppError("NOT_FOUND", "Artifact not found.");
  }
  return artifact;
}

async function requireDecision(
  decisions: { findById(id: string): Promise<Decision | null> },
  id: string,
): Promise<Decision> {
  const decision = await decisions.findById(id);
  if (!decision) throw new AppError("NOT_FOUND", "Decision not found.");
  return decision;
}

async function requireTask(
  tasks: { findById(id: string): Promise<Task | null> },
  id: string,
): Promise<Task> {
  const task = await tasks.findById(id);
  if (!task) throw new AppError("NOT_FOUND", "Task not found.");
  return task;
}

async function requireMeeting(
  meetings: { findSession(id: string): Promise<MeetingSession | null> },
  id: string,
): Promise<MeetingSession> {
  const session = await meetings.findSession(id);
  if (!session) throw new AppError("NOT_FOUND", "Meeting not found.");
  return session;
}
