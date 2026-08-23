import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "@clanmind/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuthenticatedUser } from "../middleware/auth";

/** §104 project endpoints + §29 instruction records. */
const createProjectBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(5000).nullable().optional(),
  goal: z.string().max(2000).nullable().optional(),
  project_type: z
    .enum(["software", "iot", "startup", "research", "college", "school", "personal", "other"])
    .nullable()
    .optional(),
});

const patchProjectBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(5000).nullable().optional(),
  goal: z.string().max(2000).nullable().optional(),
  project_type: z
    .enum(["software", "iot", "startup", "research", "college", "school", "personal", "other"])
    .nullable()
    .optional(),
  progress: z.number().min(0).max(100).nullable().optional(),
});

const createInstructionBody = z.object({
  instruction_text: z.string().min(1).max(4000),
  priority: z.number().int().min(0).max(1000).default(100),
});

const patchInstructionBody = z.object({
  instruction_text: z.string().min(1).max(4000).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  enabled: z.boolean().optional(),
});

export function projectRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.use("*", requireAuthenticatedUser);

  app.get("/api/v1/groups/:groupId/projects", async (c) => {
    const includeArchived = c.req.query("include_archived") === "true";
    const projects = await c
      .get("services")
      .projects.listByGroup(c.req.param("groupId"), c.get("user").user_id, includeArchived);
    return c.json({ items: projects });
  });

  app.post("/api/v1/groups/:groupId/projects", async (c) => {
    const parsed = createProjectBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid request body.");
    const project = await c
      .get("services")
      .projects.create(c.req.param("groupId"), c.get("user").user_id, parsed.data);
    return c.json(project, 201);
  });

  app.get("/api/v1/projects/:projectId", async (c) => {
    const project = await c
      .get("services")
      .projects.get(c.req.param("projectId"), c.get("user").user_id);
    return c.json(project);
  });

  app.patch("/api/v1/projects/:projectId", async (c) => {
    const parsed = patchProjectBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid request body.");
    const project = await c
      .get("services")
      .projects.update(c.req.param("projectId"), c.get("user").user_id, parsed.data);
    return c.json(project);
  });

  app.post("/api/v1/projects/:projectId/archive", async (c) => {
    const project = await c
      .get("services")
      .projects.archive(c.req.param("projectId"), c.get("user").user_id);
    return c.json(project);
  });

  app.post("/api/v1/projects/:projectId/restore", async (c) => {
    const project = await c
      .get("services")
      .projects.restore(c.req.param("projectId"), c.get("user").user_id);
    return c.json(project);
  });

  // §29 instructions
  app.get("/api/v1/projects/:projectId/instructions", async (c) => {
    const items = await c
      .get("services")
      .projects.listInstructions(c.req.param("projectId"), c.get("user").user_id);
    return c.json({ items });
  });

  app.post("/api/v1/projects/:projectId/instructions", async (c) => {
    const parsed = createInstructionBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid request body.");
    const instruction = await c
      .get("services")
      .projects.addInstruction(
        c.req.param("projectId"),
        c.get("user").user_id,
        parsed.data.instruction_text,
        parsed.data.priority,
      );
    return c.json(instruction, 201);
  });

  app.patch("/api/v1/projects/:projectId/instructions/:instructionId", async (c) => {
    const parsed = patchInstructionBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid request body.");
    const instruction = await c
      .get("services")
      .projects.updateInstruction(
        c.req.param("projectId"),
        c.req.param("instructionId"),
        c.get("user").user_id,
        parsed.data,
      );
    return c.json(instruction);
  });

  app.delete("/api/v1/projects/:projectId/instructions/:instructionId", async (c) => {
    await c
      .get("services")
      .projects.deleteInstruction(
        c.req.param("projectId"),
        c.req.param("instructionId"),
        c.get("user").user_id,
      );
    return c.json({ ok: true });
  });

  return app;
}
