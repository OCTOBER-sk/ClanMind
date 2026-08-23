/**
 * ClanMind environment configuration — validated once at boot (fail-fast).
 *
 * Live mode requires VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and
 * VITE_WS_URL. Demo mode (VITE_DEMO_MODE=1) runs the full app against the
 * in-repo deterministic demo runtime (src/mocks) which implements the exact
 * backend contracts — it must never be bundled into production builds.
 */

import { z } from 'zod';

const RawEnvSchema = z.object({
  VITE_API_BASE_URL: z.string().min(1).default('/api/v1'),
  VITE_WS_URL: z.string().optional(),
  VITE_SUPABASE_URL: z.string().optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
});

declare const __APP_VERSION__: string;
/** Compile-time gate (vite define) — enables dead-code elimination of src/mocks. */
declare const __DEMO_MODE__: boolean;

function parseRawEnv(): z.infer<typeof RawEnvSchema> {
  const result = RawEnvSchema.safeParse(import.meta.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`[config] Invalid environment configuration → ${issues}`);
  }
  return result.data;
}

const raw = parseRawEnv();

/** Compile-time gate mirrored for readability; hot paths use __DEMO_MODE__ directly. */
export const demoMode: boolean = __DEMO_MODE__;

export const env = {
  apiBaseUrl: raw.VITE_API_BASE_URL.replace(/\/+$/, ''),
  wsUrl: raw.VITE_WS_URL ?? '',
  supabaseUrl: raw.VITE_SUPABASE_URL ?? '',
  supabasePublishableKey: raw.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  /** Injected at build time from package.json via vite `define`. */
  appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
  demoMode,
} as const;

/** Throws when live mode is selected but required endpoints are missing. */
export function assertLiveConfig(): void {
  if (demoMode) return;
  const missing: string[] = [];
  if (!env.wsUrl) missing.push('VITE_WS_URL');
  if (!env.supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!env.supabasePublishableKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (missing.length > 0) {
    throw new Error(
      `[config] Live mode requires ${missing.join(', ')} — set them or enable VITE_DEMO_MODE for local development.`,
    );
  }
}
