import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "@clanmind/shared";
import { extractMentionTokens } from "@clanmind/domain";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuthenticatedUser } from "../middleware/auth";
import { enforceRateLimit } from "../ai";

/** §105 message endpoints. Realtime delivery happens after persistence. */
const sendMessageBody = z.object({
  client_message_id: z.string().min(1).max(128),
  body: z.string().min(1),
  project_id: z.string().uuid().nullable().optional(),
  reply_to_id: z.string().uuid().nullable().optional(),
  /** Raw @tokens; resolved to member ids server-side (§14.1). */
  mention_tokens: z.array(z.string().min(1).max(60)).max(50).optional(),
  /** §2.4 private mode: a teammate id, or "ai" for the Group AI. */
  private_to: z.union([z.string().uuid(), z.literal("ai")]).optional(),
});

const editMessageBody = z.object({ body: z.string().min(1) });

export function messageRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.use("*", requireAuthenticatedUser);

  app.post("/api/v1/groups/:groupId/messages", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const groupId = c.req.param("groupId");
    await services.membership.requireMember(groupId, user.user_id);

    // §178/§91 anti-abuse: per-user message burst cap before any write.
    enforceRateLimit(
      `msg:${user.user_id}`,
      services.limits.messages_per_minute_per_user,
      60_000,
    );

    const parsed = sendMessageBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid request body.");

    // Resolve mention tokens against actual members — never trust names.
    const tokens = parsed.data.mention_tokens ?? extractMentionTokens(parsed.data.body);
    const mentionUserIds: string[] = [];
    if (tokens.length > 0) {
      const members = await services.membership.listMembers(groupId, user.user_id);
      const byToken = new Map(
        members.map((m) => [m.group_display_name ?? "", m.user_id] as const),
      );
      for (const token of tokens) {
        const target = byToken.get(token);
        if (target) mentionUserIds.push(target);
      }
    }

    let visibility: "GROUP" | "PRIVATE_PAIR" | "PRIVATE_AI" = "GROUP";
    let privateConversationId: string | null = null;
    let audience: string[] | undefined;
    if (parsed.data.private_to === "ai") {
      // §2.4 /private @Odin — one conversation per member per Group.
      const agent = await services.ai.getCurrentAgent(groupId);
      const conversation = await services.privateConversations.findOrCreateAi(
        groupId,
        user.user_id,
        agent.id,
      );
      visibility = "PRIVATE_AI";
      privateConversationId = conversation.id;
      audience = [user.user_id];
    } else if (parsed.data.private_to) {
      await services.membership.requireMember(groupId, parsed.data.private_to);
      const conversation = await services.privateConversations.findOrCreateHumanPair(
        groupId,
        user.user_id,
        parsed.data.private_to,
      );
      visibility = "PRIVATE_PAIR";
      privateConversationId = conversation.id;
      audience = [user.user_id, parsed.data.private_to];
    }

    const message = await services.messages.send({
      group_id: groupId,
      project_id: parsed.data.project_id ?? null,
      client_message_id: parsed.data.client_message_id,
      body: parsed.data.body,
      reply_to_id: parsed.data.reply_to_id ?? null,
      mention_user_ids: mentionUserIds,
      sender_user_id: user.user_id,
      visibility,
      private_conversation_id: privateConversationId,
    });
    // Broadcast is async (§122) — fan out after persistence; the DO dedupes
    // against the outbox consumer delivery. Private events carry only their
    // conversation audience (§11.2).
    void services.realtime.publish({
      group_id: groupId,
      event_type: "message.created",
      actor_id: user.user_id,
      project_id: message.project_id,
      visibility,
      audience_user_ids: audience,
      payload: {
        message_id: message.id,
        server_sequence: message.server_sequence,
        preview: message.body.slice(0, 140),
      },
    });
    return c.json(message, 201);
  });

  app.get("/api/v1/groups/:groupId/messages", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const groupId = c.req.param("groupId");
    await services.membership.requireMember(groupId, user.user_id);
    const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);
    const page = await services.messages.listGroupVisible({
      group_id: groupId,
      project_id: c.req.query("project_id"),
      before: c.req.query("before"),
      limit,
    });
    return c.json(page);
  });

  app.patch("/api/v1/messages/:messageId", async (c) => {
    const parsed = editMessageBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid request body.");
    const message = await c
      .get("services")
      .messages.edit(c.req.param("messageId"), c.get("user").user_id, parsed.data.body);
    return c.json(message);
  });

  app.delete("/api/v1/messages/:messageId", async (c) => {
    await c
      .get("services")
      .messages.softDelete(c.req.param("messageId"), c.get("user").user_id);
    return c.json({ ok: true });
  });

  return app;
}
