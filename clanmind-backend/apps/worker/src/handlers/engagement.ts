import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "@clanmind/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuthenticatedUser } from "../middleware/auth";

/** Reaction + pin endpoints backing the §114 `message.react` flow and §39B. */
const reactBody = z.object({ emoji: z.string().min(1).max(32) });

export function engagementRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.use("*", requireAuthenticatedUser);

  app.post("/api/v1/messages/:messageId/reactions", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const parsed = reactBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid request body.");
    const message = await services.messages.requireReadable(
      c.req.param("messageId"),
      user.user_id,
      (conversationId, userId) =>
        services.privateConversations.requireMember(conversationId, userId).then(
          () => true,
          () => false,
        ),
    );
    await services.reactions.react(message.id, user.user_id, parsed.data.emoji);
    void services.realtime.publish({
      group_id: message.group_id,
      event_type: "message.reaction.added",
      actor_id: user.user_id,
      payload: { message_id: message.id, emoji: parsed.data.emoji },
    });
    return c.json({ ok: true });
  });

  app.delete("/api/v1/messages/:messageId/reactions", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const emoji = c.req.query("emoji") ?? "";
    const message = await services.messages.requireReadable(
      c.req.param("messageId"),
      user.user_id,
      (conversationId, userId) =>
        services.privateConversations.requireMember(conversationId, userId).then(
          () => true,
          () => false,
        ),
    );
    await services.reactions.unreact(message.id, user.user_id, emoji);
    void services.realtime.publish({
      group_id: message.group_id,
      event_type: "message.reaction.removed",
      actor_id: user.user_id,
      payload: { message_id: message.id, emoji },
    });
    return c.json({ ok: true });
  });

  app.get("/api/v1/groups/:groupId/pins", async (c) => {
    const services = c.get("services");
    await services.membership.requireMember(c.req.param("groupId"), c.get("user").user_id);
    const pins = await services.pins.listOpenPins(c.req.param("groupId"));
    return c.json({ items: pins });
  });

  app.post("/api/v1/messages/:messageId/pin", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const message = await services.messages.requireReadable(
      c.req.param("messageId"),
      user.user_id,
      (conversationId, userId) =>
        services.privateConversations.requireMember(conversationId, userId).then(
          () => true,
          () => false,
        ),
    );
    await services.membership.requireMember(message.group_id, user.user_id);
    const pin = await services.pins.pin(message, user.user_id);
    void services.realtime.publish({
      group_id: message.group_id,
      event_type: "message.pinned",
      actor_id: user.user_id,
      payload: { message_id: message.id },
    });
    return c.json(pin);
  });

  app.post("/api/v1/messages/:messageId/unpin", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const message = await services.messages.requireReadable(
      c.req.param("messageId"),
      user.user_id,
      (conversationId, userId) =>
        services.privateConversations.requireMember(conversationId, userId).then(
          () => true,
          () => false,
        ),
    );
    await services.membership.requireMember(message.group_id, user.user_id);
    await services.pins.unpin(message.group_id, message.id);
    void services.realtime.publish({
      group_id: message.group_id,
      event_type: "message.unpinned",
      actor_id: user.user_id,
      payload: { message_id: message.id },
    });
    return c.json({ ok: true });
  });

  return app;
}
