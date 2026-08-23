import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "@clanmind/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuthenticatedUser } from "../middleware/auth";

/** §105/§13 search endpoint — permission filters are not optional. */
const searchQuery = z.object({
  q: z.string().min(1).max(200),
  project_id: z.string().uuid().optional(),
  sender_user_id: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  mention_me: z.enum(["true", "false"]).optional(),
  has_attachments: z.enum(["true", "false"]).optional(),
  ai_only: z.enum(["true", "false"]).optional(),
  include_private: z.enum(["true", "false"]).optional(),
});

export function searchRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.use("*", requireAuthenticatedUser);

  app.get("/api/v1/groups/:groupId/messages/search", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const groupId = c.req.param("groupId");
    await services.membership.requireMember(groupId, user.user_id);

    const parsed = searchQuery.safeParse({
      q: c.req.query("q") ?? "",
      project_id: c.req.query("project_id"),
      sender_user_id: c.req.query("sender_user_id"),
      from: c.req.query("from"),
      to: c.req.query("to"),
      mention_me: c.req.query("mention_me") ?? undefined,
      has_attachments: c.req.query("has_attachments") ?? undefined,
      ai_only: c.req.query("ai_only") ?? undefined,
      include_private: c.req.query("include_private") ?? undefined,
    });
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid search query.");
    const q = parsed.data;

    const items = await services.search.search({
      group_id: groupId,
      requester_user_id: user.user_id,
      query: q.q,
      project_id: q.project_id,
      sender_user_id: q.sender_user_id,
      from: q.from,
      to: q.to,
      mention_of: q.mention_me === "true" ? user.user_id : undefined,
      has_attachments: q.has_attachments === "true",
      ai_messages_only: q.ai_only === "true",
      include_private: q.include_private === "true",
      limit: Math.min(Number(c.req.query("limit") ?? 25) || 25, 50),
    });
    return c.json({ items });
  });

  app.get("/api/v1/notifications", async (c) => {
    const items = await c
      .get("services")
      .notifications.listForUser(
        c.get("user").user_id,
        Math.min(Number(c.req.query("limit") ?? 50) || 50, 100),
        c.req.query("unread") === "true",
      );
    return c.json({ items });
  });

  app.post("/api/v1/notifications/:notificationId/read", async (c) => {
    await c
      .get("services")
      .notifications.markRead(c.get("user").user_id, c.req.param("notificationId"));
    return c.json({ ok: true });
  });

  app.get("/api/v1/groups/:groupId/activity", async (c) => {
    const services = c.get("services");
    await services.membership.requireMember(c.req.param("groupId"), c.get("user").user_id);
    const items = await services.activity.listByGroup(
      c.req.param("groupId"),
      Math.min(Number(c.req.query("limit") ?? 50) || 50, 100),
    );
    return c.json({ items });
  });

  return app;
}
