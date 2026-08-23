import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "@clanmind/shared";
import { OpenAICompatibleAdapter } from "@clanmind/ai-providers";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuthenticatedUser } from "../middleware/auth";
import { getAiRuntime } from "../ai";

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
  anthropic: "https://api.anthropic.com/v1/",
};

const patchConfigBody = z.object({
  routes: z
    .array(
      z.object({
        provider_config_id: z.string().uuid(),
        role: z.enum(["PRIMARY", "FALLBACK_1", "FALLBACK_2", "FALLBACK_3"]),
        model_id: z.string().min(1),
      }),
    )
    .min(1)
    .max(4),
});

/** §107 AI config — Owner/Admin only; secrets never leave the backend. */
export function aiConfigRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.use("*", requireAuthenticatedUser);

  app.get("/api/v1/groups/:groupId/ai/config", async (c) => {
    const services = c.get("services");
    await services.membership.requireRole(
      c.req.param("groupId"),
      c.get("user").user_id,
      ["OWNER", "ADMIN"],
    );
    const rt = getAiRuntime(c.env, services);
    const groupId = c.req.param("groupId");
    const configs = (await rt.configRepo.listByGroup(groupId)).map((cfg) =>
      // §63.1/§107: sanitized metadata only — no credential material.
      rt.providers.sanitize(cfg),
    );
    const routes = await rt.routeRepo.listByGroup(groupId);
    return c.json({ configs, routes });
  });

  app.patch("/api/v1/groups/:groupId/ai/config", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const groupId = c.req.param("groupId");
    await services.membership.requireRole(groupId, user.user_id, ["OWNER", "ADMIN"]);
    const parsed = patchConfigBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid route list.");
    const rt = getAiRuntime(c.env, services);

    // §61/§32: exactly one PRIMARY, ≤3 fallbacks, all configs owned by the Group.
    await rt.router.validateRoutes({ group_id: groupId, routes: parsed.data.routes });
    for (const entry of parsed.data.routes) {
      const cfg = await rt.configRepo.findById(entry.provider_config_id);
      if (!cfg || cfg.group_id !== groupId) {
        throw new AppError("VALIDATION_FAILED", "Unknown provider config for this Group.");
      }
      await rt.routeRepo.insert({
        group_id: groupId,
        provider_config_id: entry.provider_config_id,
        role: entry.role,
        model_id: entry.model_id,
        priority: entry.role === "PRIMARY" ? 0 : Number(entry.role.slice(-1)),
      });
    }
    return c.json({ ok: true, routes: await rt.routeRepo.listByGroup(groupId) });
  });

  app.post("/api/v1/groups/:groupId/ai/providers/validate", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const groupId = c.req.param("groupId");
    await services.membership.requireRole(groupId, user.user_id, ["OWNER", "ADMIN"]);
    const body = (await c.req.json().catch(() => ({}))) as {
      provider?: unknown;
      api_key?: unknown;
    };
    if (
      typeof body.provider !== "string" ||
      typeof body.api_key !== "string" ||
      body.api_key.length < 8
    ) {
      throw new AppError("VALIDATION_FAILED", "provider and api_key are required.");
    }
    const rt = getAiRuntime(c.env, services);
    // §64 validate-before-store. The raw key is consumed here and never
    // returned or logged.
    const { config, models } = await rt.providers.validateAndStore({
      group_id: groupId,
      provider: body.provider,
      api_key: body.api_key,
      created_by: user.user_id,
    });
    return c.json({ config: rt.providers.sanitize(config), models }, 201);
  });

  app.post("/api/v1/groups/:groupId/ai/providers/:id/models", async (c) => {
    const services = c.get("services");
    const groupId = c.req.param("groupId");
    await services.membership.requireRole(groupId, c.get("user").user_id, ["OWNER", "ADMIN"]);
    const rt = getAiRuntime(c.env, services);
    const config = await rt.configRepo.findById(c.req.param("id"));
    if (!config || config.group_id !== groupId) {
      throw new AppError("NOT_FOUND", "Provider config not found.");
    }
    let apiKey: string | null = null;
    if (config.kind === "BYOK") {
      apiKey = await rt.secrets.getSecret(config.credential_ref?.replace(/^secret:/, "") ?? "");
    } else {
      apiKey = c.env.APPLICATION_AI_API_KEY ?? null;
    }
    if (!apiKey) throw new AppError("CONFLICT", "No usable credential for this provider config.");
    const adapter = new OpenAICompatibleAdapter(
      config.provider,
      apiKey,
      PROVIDER_BASE_URLS[config.provider] ?? PROVIDER_BASE_URLS["openai"]!,
    );
    const result = await adapter.listModels();
    return c.json({ provider: config.provider, models: result });
  });

  return app;
}
