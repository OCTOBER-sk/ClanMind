/**
 * ClanMind environment configuration — validated once at boot (fail-fast).
 *
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY;
 * the realtime socket derives from the API origin (`/api/v1/groups/:id/ws`,
 * BE §16/§104) unless VITE_WS_URL overrides it explicitly.
 */

import { z } from 'zod';

const RawEnvSchema = z.object({
  VITE_API_BASE_URL: z.string().min(1).default('/api/v1'),
  VITE_WS_URL: z.string().optional(),
  VITE_SUPABASE_URL: z.string().optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
});

declare const __APP_VERSION__: string;

function parseRawEnv(): z.infer<typeof RawEnvSchema> {
  const result = RawEnvSchema.safeParse(import.meta.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`[config] Invalid environment configuration → ${issues}`);
  }
  return result.data;
}

const raw = parseRawEnv();

/** @deprecated Always false — demo mode has been removed from runtime. */
export const demoMode: boolean = false;

export const env = {
  apiBaseUrl: raw.VITE_API_BASE_URL.replace(/\/+$/, ''),
  /** Optional explicit WS origin/base; when empty the API origin is upgraded. */
  wsUrl: raw.VITE_WS_URL ?? '',
  supabaseUrl: raw.VITE_SUPABASE_URL ?? '',
  supabasePublishableKey: raw.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  /** Injected at build time from package.json via vite `define`. */
  appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
  demoMode,
} as const;

/** Throws when live mode is selected but required endpoints are missing. */
export function assertLiveConfig(): void {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!env.supabasePublishableKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (missing.length > 0) {
    throw new Error(
      `[config] Live mode requires ${missing.join(', ')}.`,
    );
  }
}

/**
 * BE §16/§104 — one Durable-Object room per Group, reached through
 * `GET /api/v1/groups/:groupId/ws?token=…`. Builds the absolute WS URL for
 * that room: `ws(s)://<API origin>/api/v1/groups/<id>/ws`. An explicit
 * VITE_WS_URL overrides the origin (useful when the Worker fronts a
 * different host than the page origin).
 */
export function wsRoomEndpoint(groupId: string): string {
  const path = `${env.apiBaseUrl}/groups/${encodeURIComponent(groupId)}/ws`;
  let overrideOrigin: string | null = null;
  if (env.wsUrl) {
    try {
      overrideOrigin = new URL(env.wsUrl).origin;
    } catch {
      overrideOrigin = null; // malformed override — fall back to API origin
    }
  }
  const url = new URL(path, overrideOrigin ?? window.location.origin);
  if (url.protocol === 'https:') url.protocol = 'wss:';
  else if (url.protocol === 'http:') url.protocol = 'ws:';
  return url.toString();
}
