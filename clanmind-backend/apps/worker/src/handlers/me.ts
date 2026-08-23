import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuthenticatedUser } from "../middleware/auth";

/**
 * §104: GET/PATCH /api/v1/me. Thin handler — parse/validate, call one
 * service, translate the result (§3.3).
 */
const patchMeBody = z.object({
  display_name: z.string().min(1).max(100).optional(),
  avatar_object_id: z.string().uuid().nullable().optional(),
});

export function meRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.use("*", requireAuthenticatedUser);

  app.get("/api/v1/me", async (c) => {
    const user = c.get("user");
    const profile = await c.get("services").profiles.getOrCreate({
      user_id: user.user_id,
      email: user.email,
    });
    void c.get("services").profiles.markSeen(user.user_id);
    return c.json(profile);
  });

  app.patch("/api/v1/me", async (c) => {
    const user = c.get("user");
    const parsed = patchMeBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid request body.",
            request_id: c.get("requestId"),
          },
        },
        400,
      );
    }
    // Provision on first contact so PATCH works without a prior GET.
    await c.get("services").profiles.getOrCreate({
      user_id: user.user_id,
      email: user.email,
    });
    const profile = await c.get("services").profiles.updateMe(
      user.user_id,
      parsed.data,
    );
    return c.json(profile);
  });

  return app;
}
