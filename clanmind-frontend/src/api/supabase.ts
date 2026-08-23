/**
 * Supabase client — AUTH ONLY (BE §6/§86/§87).
 *
 * Supabase owns credentials, session lifecycle, token refresh, and password
 * recovery. ALL domain data flows through `/api/v1` — no table access from
 * the client. In demo mode (VITE_DEMO_MODE=1) this module is never called;
 * the session gateway routes to the demo transport instead.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    throw new Error(
      '[auth] Live mode requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY',
    );
  }
  client ??= createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
