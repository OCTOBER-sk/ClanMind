import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "@clanmind/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuthenticatedUser } from "../middleware/auth";

const patchMemoryBody = z.object({
  content: z.string().min(1).max(2000).optional(),
  importance: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * §108 memory endpoints. Private user memory is only ever readable/writable
 * by its owner (§55A); shared scopes require Group membership.
 */
export function memoryRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.use("*", requireAuthenticatedUser);

  app.get("/api/v1/groups/:groupId/memory", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const groupId = c.req.param("groupId");
    await services.membership.requireMember(groupId, user.user_id);
    const items = await services.memory.listGroupMemories(groupId, user.user_id);
    return c.json({ items });
  });

  app.get("/api/v1/projects/:projectId/memory", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    // §86: outsiders never learn project memory contents.
    const project = await services.projects.get(c.req.param("projectId"), user.user_id);
    const items = await services.memory.listProjectMemories(project.id, project.group_id);
    return c.json({ items });
  });

  app.get("/api/v1/groups/:groupId/memory/candidates", async (c) => {
    const services = c.get("services");
    const groupId = c.req.param("groupId");
    await services.membership.requireMember(groupId, c.get("user").user_id);
    const items = await services.memory.listCandidates(groupId);
    return c.json({ items });
  });

  app.post("/api/v1/memory/:candidateId/accept", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    // Membership of the owning Group is required even though the service
    // enforces the §185 #12 USER_PRIVATE owner rule itself.
    const candidate = await services.memory.getCandidate(c.req.param("candidateId"));
    if (!candidate) throw new AppError("NOT_FOUND", "Candidate not found.");
    await services.membership.requireMember(candidate.group_id, user.user_id);
    const memory = await services.memory.acceptCandidate(candidate.id, user.user_id);
    return c.json(memory, 201);
  });

  app.post("/api/v1/memory/:candidateId/reject", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const candidate = await services.memory.getCandidate(c.req.param("candidateId"));
    if (!candidate) throw new AppError("NOT_FOUND", "Candidate not found.");
    // Rejecting a private-scope candidate stays with its owner; shared
    // candidates may be rejected by Owner/Admin.
    if (candidate.recommended_scope === "USER_PRIVATE") {
      if (candidate.user_id !== user.user_id) {
        throw new AppError("FORBIDDEN", "This candidate belongs to another member.");
      }
    } else {
      const { member } = await services.membership.requireMember(
        candidate.group_id,
        user.user_id,
      );
      if (member.role !== "OWNER" && member.role !== "ADMIN") {
        throw new AppError(
          "GROUP_PERMISSION_DENIED",
          "Only Owners/Admins can reject shared candidates.",
        );
      }
    }
    await services.memory.rejectCandidate(candidate.id);
    return c.json({ ok: true });
  });

  app.patch("/api/v1/memory/:memoryId", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const parsed = patchMemoryBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid patch body.");
    if (Object.keys(parsed.data).length === 0) {
      throw new AppError("VALIDATION_FAILED", "At least one field is required.");
    }
    await authorizeMemoryAccess(services, c.req.param("memoryId"), user.user_id);
    const updated = await services.memory.updateMemory(c.req.param("memoryId"), parsed.data);
    return c.json(updated);
  });

  app.delete("/api/v1/memory/:memoryId", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    await authorizeMemoryAccess(services, c.req.param("memoryId"), user.user_id);
    await services.memory.deleteMemory(c.req.param("memoryId"));
    return c.json({ ok: true });
  });

  return app;
}

/**
 * PATCH/DELETE authorization: OWNER/ADMIN for any row; a plain member only
 * when the memory is their own USER_PRIVATE scope (§108).
 */
async function authorizeMemoryAccess(
  services: import("../services").AppServices,
  memoryId: string,
  userId: string,
): Promise<void> {
  const memory = await services.memory.getMemory(memoryId);
  if (!memory) throw new AppError("NOT_FOUND", "Memory not found.");
  if (memory.scope_type === "USER_PRIVATE") {
    if (memory.user_id === userId) return;
    throw new AppError("FORBIDDEN", "Private memory belongs to another member.");
  }
  const { member } = await services.membership.requireMember(memory.group_id, userId);
  if (member.role !== "OWNER" && member.role !== "ADMIN") {
    throw new AppError(
      "GROUP_PERMISSION_DENIED",
      "Only Owners/Admins can modify shared memory.",
    );
  }
}
