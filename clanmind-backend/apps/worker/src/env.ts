/**
 * Worker environment bindings (spec §162).
 * Secrets are provided via `wrangler secret put`; non-secret config lives in
 * wrangler.toml [vars]. LIMITS_JSON carries the §178 default limits — they are
 * configuration, never hard-coded in business logic.
 */
export interface Env {
  // Infrastructure
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string; // secret — service layer only (§87A)
  SUPABASE_JWT_SECRET: string; // secret — auth gateway token verification (§6)

  // Bindings
  GROUP_ROOM: DurableObjectNamespace;
  SHARED_OBJECTS: R2Bucket;

  // Secrets (§162) — provided via `wrangler secret put`, never committed
  BYOK_ENCRYPTION_KEY?: string; // §63.2 envelope-encryption master secret
  APPLICATION_AI_API_KEY?: string; // §65 application provider pool key
  TAVILY_API_KEY?: string; // §67 search providers
  EXA_API_KEY?: string;
  GITHUB_WEBHOOK_SECRET?: string; // §80 webhook signature verification
  GITHUB_APP_PRIVATE_KEY?: string; // GitHub App installation auth
  GITHUB_APP_ID?: string;

  // Non-secret vars
  ENVIRONMENT: "local" | "staging" | "production";
  LOG_LEVEL: string;
  LIMITS_JSON: string;
  CLIENT_MINIMUM_VERSION: string;
  CLIENT_RECOMMENDED_VERSION: string;
  PROTOCOL_VERSION: string;
  /** §149: minimum supported WS protocol version — old clients get an
   * explicit CLIENT_UPDATE_REQUIRED event. Defaults to 1 when unset. */
  MIN_PROTOCOL_VERSION?: string;
}
