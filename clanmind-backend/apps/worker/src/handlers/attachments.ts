import { Hono } from "hono";
import { AppError, parseLimits } from "@clanmind/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuthenticatedUser } from "../middleware/auth";

/**
 * Attachment endpoints: multipart upload (§81 validation) and §84 signed-URL
 * download. Signed tokens are minted only after backend authorization and
 * expire per §178 (15 minutes default).
 */
export function attachmentRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.use("*", requireAuthenticatedUser);

  app.post("/api/v1/groups/:groupId/attachments", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const groupId = c.req.param("groupId");
    await services.membership.requireMember(groupId, user.user_id);

    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) {
      throw new AppError("VALIDATION_FAILED", "multipart 'file' field is required.");
    }
    const projectId = (form.get("project_id") as string | null) ?? null;

    const limits = parseLimits(c.env.LIMITS_JSON);
    const bytes = new Uint8Array(await file.arrayBuffer());
    // §178 attachments-per-message cap counts against the linked message when
    // one is supplied — never silently zero.
    const messageId = (form.get("message_id") as string | null) ?? null;
    const currentCount = messageId
      ? (await services.attachments.listByMessage(messageId)).length
      : 0;
    const attachment = await services.attachments.upload({
      group_id: groupId,
      project_id: projectId,
      owner_user_id: user.user_id,
      original_name: file.name || "unnamed",
      declared_mime: file.type || "application/octet-stream",
      bytes,
      max_bytes: limits.attachment_max_bytes,
      attachments_per_message_max: limits.attachments_per_message_max,
      current_attachment_count: currentCount,
    });
    if (messageId) {
      await services.attachments.linkToMessage(messageId, attachment.id);
    }
    return c.json(attachment, 201);
  });

  // Mint a short-lived signed URL after authorization (§84).
  app.post("/api/v1/attachments/:attachmentId/sign", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const attachment = await services.attachments.requireReadable(
      c.req.param("attachmentId"),
      user.user_id,
      async (groupId, userId) => {
        try {
          await services.membership.requireMember(groupId, userId);
          return true;
        } catch {
          return false;
        }
      },
    );
    const limits = parseLimits(c.env.LIMITS_JSON);
    const token = await services.signedUrls.sign({
      attachment_id: attachment.id,
      expires_at: Date.now() + limits.signed_url_lifetime_seconds * 1000,
    });
    return c.json({
      attachment_id: attachment.id,
      url: `/api/v1/attachments/${attachment.id}/download?token=${token}`,
      expires_in_seconds: limits.signed_url_lifetime_seconds,
    });
  });

  app.get("/api/v1/attachments/:attachmentId/download", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const token = c.req.query("token") ?? "";
    const ok = await services.signedUrls.verify(
      token,
      c.req.param("attachmentId"),
      Date.now(),
    );
    if (!ok) {
      throw new AppError("FORBIDDEN", "This link is invalid or has expired.");
    }
    // §84/§185 #11: a valid token is necessary but not sufficient — current
    // Group membership is re-checked so removed members lose access at once.
    await services.attachments.requireReadable(
      c.req.param("attachmentId"),
      user.user_id,
      async (groupId, userId) => {
        try {
          await services.membership.requireMember(groupId, userId);
          return true;
        } catch {
          return false;
        }
      },
    );
    const file = await services.attachments.readObject(c.req.param("attachmentId"));
    if (!file) throw new AppError("NOT_FOUND", "File not found.");
    return new Response(file.bytes as unknown as BodyInit, {
      headers: {
        "content-type": file.contentType,
        "cache-control": "private, max-age=60",
      },
    });
  });

  return app;
}
