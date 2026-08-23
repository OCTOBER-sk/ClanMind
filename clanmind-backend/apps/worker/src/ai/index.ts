import { AppError } from "@clanmind/shared";
import type { Env } from "../env";
import type { AppServices } from "../services";
import { buildAiRuntime, type AiRuntime, type AiRuntimeDeps } from "./runtime";

/**
 * The AI runtime is composed once per Worker isolate from env bindings and
 * reused across requests (§182 application-service layer).
 */
const runtimeCache = new WeakMap<object, AiRuntime>();

export function getAiRuntime(env: Env, services: AppServices): AiRuntime {
  let runtime = runtimeCache.get(env);
  if (!runtime) {
    const deps: AiRuntimeDeps = {
      db: services.db,
      env,
      membership: services.membership,
      memory: services.memory,
      agents: services.ai,
      realtime: services.realtime,
      outbox: services.outbox,
      jobs: services.jobs,
      limits: services.limits,
    };
    runtime = buildAiRuntime(deps);
    runtimeCache.set(env, runtime);
  }
  return runtime;
}

/**
 * §91 layered rate limiting — fixed-window counters keyed per isolate.
 * Workers are horizontally scaled, so this is a best-effort first layer; the
 * Durable Object room adds a second per-Group layer on WS paths. Windows and
 * caps come from LIMITS_JSON (§178), never hard-coded.
 */
const buckets = new Map<string, { windowStart: number; count: number }>();

/**
 * Throws the §102 contract error so Hono's onError renders 429 + Retry-After
 * details instead of a generic 500.
 */
export function enforceRateLimit(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): void {
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    if (buckets.size > 10_000) buckets.clear();
    buckets.set(key, { windowStart: now, count: 1 });
    return;
  }
  bucket.count += 1;
  if (bucket.count > max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStart + windowMs - now) / 1000));
    throw new AppError("RATE_LIMITED", "Too many requests; slow down.", {
      retry_after_seconds: retryAfterSeconds,
    });
  }
}
