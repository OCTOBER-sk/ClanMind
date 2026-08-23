import { Hono } from "hono";
import { AppError, newRequestId, toErrorEnvelope } from "@clanmind/shared";
import { getServiceClient } from "@clanmind/db";
import type { Env } from "./env";
import type { AppServices } from "./services";
import type { AuthVariables } from "./middleware/auth";
import { meRoutes } from "./handlers/me";
import { groupRoutes } from "./handlers/groups";
import { memberRoutes } from "./handlers/members";
import { inviteRoutes } from "./handlers/invites";
import { projectRoutes } from "./handlers/projects";
import { messageRoutes } from "./handlers/messages";
import { engagementRoutes } from "./handlers/engagement";
import { attachmentRoutes } from "./handlers/attachments";
import { searchRoutes } from "./handlers/search";
import { aiRoutes } from "./handlers/ai";
import { aiConfigRoutes } from "./handlers/ai-config";
import { memoryRoutes } from "./handlers/memory";
import { intelRoutes } from "./handlers/intel";
import { githubRoutes, githubWebhookRoutes } from "./handlers/github";

export type AppEnv = { Bindings: Env; Variables: AuthVariables };

/**
 * Application factory. `services` is injected so tests can substitute
 * in-memory repositories; production builds them from env bindings.
 */
export function createApp(services: AppServices): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // §101 correlation ids + §102 error contract + request logging on every
  // response: route, status, duration, request id.
  app.use("*", async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? newRequestId();
    c.set("requestId", requestId);
    c.set("services", services);
    const startedAt = Date.now();
    await next();
    c.header("x-request-id", requestId);
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        message: "http.request",
        request_id: requestId,
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        status: c.res.status,
        duration_ms: Date.now() - startedAt,
      }),
    );
  });

  app.onError((err, c) => {
    const { body, status } = toErrorEnvelope(err, c.get("requestId"));
    return c.json(body, status as 400);
  });

  app.notFound((c) =>
    c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Resource not found.",
          request_id: c.get("requestId"),
        },
      },
      404,
    ),
  );

  // §161 health endpoints. Readiness checks the database and required
  // configuration only — never optional AI providers.
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/health/live", (c) => c.json({ status: "live" }));
  app.get("/health/ready", async (c) => {
    const checks: Record<string, "ok" | "fail"> = {};
    try {
      const db = getServiceClient({
        url: c.env.SUPABASE_URL,
        serviceRoleKey: c.env.SUPABASE_SERVICE_ROLE_KEY,
      });
      const { error } = await db.from("groups").select("id", { head: true, count: "exact" }).limit(1);
      checks.database = error ? "fail" : "ok";
    } catch {
      checks.database = "fail";
    }
    checks.config = c.env.SUPABASE_URL && c.env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "fail";
    const ready = Object.values(checks).every((v) => v === "ok");
    return c.json({ status: ready ? "ready" : "degraded", checks }, ready ? 200 : 503);
  });

  // §165 client/protocol version metadata for desktop update gating.
  app.get("/api/v1/client-versions", (c) =>
    c.json({
      minimum_client_version: c.env.CLIENT_MINIMUM_VERSION,
      recommended_client_version: c.env.CLIENT_RECOMMENDED_VERSION,
      protocol_version: Number(c.env.PROTOCOL_VERSION),
    }),
  );

  // §80 webhook first: HMAC-verified, never JWT-gated. Sub-app `use("*")`
  // middleware composes globally in Hono, so auth-gated routers must mount
  // AFTER this one or they would 401 GitHub's deliveries.
  app.route("/", githubWebhookRoutes());
  app.route("/", meRoutes());
  app.route("/", groupRoutes());
  app.route("/", memberRoutes());
  app.route("/", inviteRoutes());
  app.route("/", projectRoutes());
  app.route("/", messageRoutes());
  app.route("/", engagementRoutes());
  app.route("/", attachmentRoutes());
  app.route("/", searchRoutes());
  // §106–§113: AI runs/config, memory, project intelligence, GitHub.
  app.route("/", aiRoutes());
  app.route("/", aiConfigRoutes());
  app.route("/", memoryRoutes());
  app.route("/", intelRoutes());
  app.route("/", githubRoutes());

  // Keep AppError referenced so tree-shaking never drops the contract import.
  void AppError;

  return app;
}
