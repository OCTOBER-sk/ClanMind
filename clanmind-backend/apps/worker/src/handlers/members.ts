import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "@clanmind/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuthenticatedUser } from "../middleware/auth";

/** §104 Members endpoints. */
const patchMemberBody = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "GUEST"]),
});

const transferBody = z.object({
  new_owner_user_id: z.string().uuid(),
});

const nicknameBody = z.object({ nickname: z.string().min(1).max(60) });

export function memberRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.use("*", requireAuthenticatedUser);

  app.get("/api/v1/groups/:groupId/members", async (c) => {
    const members = await c
      .get("services")
      .membership.listMembers(c.req.param("groupId"), c.get("user").user_id);
    return c.json({ items: members });
  });

  app.patch("/api/v1/groups/:groupId/members/:userId", async (c) => {
    const parsed = patchMemberBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "Invalid request body.");
    }
    const member = await c
      .get("services")
      .membership.changeRole(
        c.req.param("groupId"),
        c.get("user").user_id,
        c.req.param("userId"),
        parsed.data.role,
      );
    return c.json(member);
  });

  app.delete("/api/v1/groups/:groupId/members/:userId", async (c) => {
    await c
      .get("services")
      .membership.removeMember(
        c.req.param("groupId"),
        c.get("user").user_id,
        c.req.param("userId"),
      );
    return c.json({ ok: true });
  });

  app.post("/api/v1/groups/:groupId/transfer-ownership", async (c) => {
    const parsed = transferBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "Invalid request body.");
    }
    await c
      .get("services")
      .membership.transferOwnership(
        c.req.param("groupId"),
        c.get("user").user_id,
        parsed.data.new_owner_user_id,
      );
    return c.json({ ok: true });
  });

  // §26 viewer-scoped nickname for a teammate.
  app.put("/api/v1/groups/:groupId/members/:userId/nickname", async (c) => {
    const services = c.get("services");
    // The viewer must be a Group member; the target should be too.
    await services.membership.requireMember(c.req.param("groupId"), c.get("user").user_id);
    const parsed = nicknameBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid request body.");
    const row = await services.nicknames.set(
      c.req.param("groupId"),
      c.get("user").user_id,
      c.req.param("userId"),
      parsed.data.nickname,
    );
    return c.json(row);
  });

  app.delete("/api/v1/groups/:groupId/members/:userId/nickname", async (c) => {
    const services = c.get("services");
    await services.membership.requireMember(c.req.param("groupId"), c.get("user").user_id);
    await services.nicknames.remove(
      c.req.param("groupId"),
      c.get("user").user_id,
      c.req.param("userId"),
    );
    return c.json({ ok: true });
  });

  app.get("/api/v1/groups/:groupId/nicknames", async (c) => {
    const services = c.get("services");
    await services.membership.requireMember(c.req.param("groupId"), c.get("user").user_id);
    const items = await services.nicknames.listForViewer(
      c.req.param("groupId"),
      c.get("user").user_id,
    );
    return c.json({ items });
  });

  return app;
}
