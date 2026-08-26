import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "@clanmind/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuthenticatedUser } from "../middleware/auth";

/**
 * §104 Groups endpoints. DELETE is the §9 Stage-1 soft delete (full
 * lifecycle lands with A5).
 */
const createGroupBody = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
});

const patchGroupBody = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  avatar_object_id: z.string().uuid().nullable().optional(),
});

export function groupRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  // §16 WebSocket room entry is handled at the worker entrypoint (index.ts) so
  // the DO can authenticate via ?token (browsers can't send WS headers).
  app.use("*", requireAuthenticatedUser);

  app.get("/api/v1/groups", async (c) => {
    const groups = await c.get("services").groups.listForUser(c.get("user").user_id);
    return c.json({ items: groups });
  });

  app.post("/api/v1/groups", async (c) => {
    const parsed = createGroupBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "Invalid request body.");
    }
    const group = await c
      .get("services")
      .groups.create({ ...parsed.data, owner_user_id: c.get("user").user_id });
    return c.json(group, 201);
  });

  app.get("/api/v1/groups/:groupId", async (c) => {
    const group = await c
      .get("services")
      .groups.get(c.req.param("groupId"), c.get("user").user_id);
    return c.json(group);
  });

  app.patch("/api/v1/groups/:groupId", async (c) => {
    const parsed = patchGroupBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "Invalid request body.");
    }
    const group = await c
      .get("services")
      .groups.update(c.req.param("groupId"), c.get("user").user_id, parsed.data);
    return c.json(group);
  });

  app.delete("/api/v1/groups/:groupId", async (c) => {
    const services = c.get("services");
    const group = await services.groups.softDelete(
      c.req.param("groupId"),
      c.get("user").user_id,
    );
    return c.json(group);
  });

  // §15/§16: WebSocket room entry — the Durable Object itself validates the
  // token and Group membership before accepting the socket.
  app.get("/api/v1/groups/:groupId/ws", (c) => {
    const id = c.env.GROUP_ROOM.idFromName(c.req.param("groupId"));
    const stub = c.env.GROUP_ROOM.get(id);
    const url = new URL(c.req.url);
    return stub.fetch(`https://room/ws${url.search}`);
  });

  // §9 Stage 2: Owner restores within the recovery window.
  app.post("/api/v1/groups/:groupId/restore", async (c) => {
    const group = await c
      .get("services")
      .groups.restore(c.req.param("groupId"), c.get("user").user_id);
    return c.json(group);
  });

  // §9 Stage 3: Owner's explicit permanent-deletion confirmation; the purge
  // itself runs asynchronously as the `deletion` job.
  app.post("/api/v1/groups/:groupId/delete-permanently", async (c) => {
    const services = c.get("services");
    await services.deletion.requestPermanentDelete(
      c.req.param("groupId"),
      c.get("user").user_id,
      services.jobs,
    );
    return c.json({ ok: true, queued: true });
  });

  return app;
}
