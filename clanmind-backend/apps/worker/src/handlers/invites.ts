import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "@clanmind/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuthenticatedUser } from "../middleware/auth";

/** §104 invite endpoints (§8 flows). */
const createInviteBody = z.object({
  email: z.string().email().nullable().optional(),
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]).default("MEMBER"),
  max_uses: z.number().int().positive().max(100).nullable().optional(),
});

const acceptBody = z.object({}).passthrough().optional();

export function inviteRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.use("*", requireAuthenticatedUser);

  app.post("/api/v1/groups/:groupId/invites", async (c) => {
    const parsed = createInviteBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "Invalid request body.");
    }
    const result = await c
      .get("services")
      .invites.create(c.req.param("groupId"), c.get("user").user_id, {
        email: parsed.data.email ?? null,
        role: parsed.data.role,
        max_uses: parsed.data.max_uses ?? null,
      });
    // The raw token is shown once to the inviting admin (§8.2).
    return c.json({ invite: result.invite, token: result.token }, 201);
  });

  app.get("/api/v1/groups/:groupId/invites", async (c) => {
    const invites = await c
      .get("services")
      .invites.list(c.req.param("groupId"), c.get("user").user_id);
    return c.json({ items: invites });
  });

  app.post("/api/v1/groups/:groupId/invites/:inviteId/revoke", async (c) => {
    await c
      .get("services")
      .invites.revoke(c.req.param("groupId"), c.req.param("inviteId"), c.get("user").user_id);
    return c.json({ ok: true });
  });

  app.post("/api/v1/invites/:token/accept", async (c) => {
    void acceptBody;
    const result = await c
      .get("services")
      .invites.accept(c.req.param("token"), c.get("user").user_id);
    return c.json(result);
  });

  return app;
}
