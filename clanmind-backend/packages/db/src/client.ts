import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase access for the Worker service layer (§87A).
 *
 * This is the service-role connection used by domain services for writes that
 * involve business rules (role checks, risk classification, approval binding,
 * quota checks). RLS remains defense-in-depth for any direct client reads;
 * authorization is enforced in the §86 chain inside services, never trusted
 * from clients.
 *
 * Migrations live in `supabase/migrations/` (§150: versioned, reversible
 * where practical, tested on staging, seeds separate from migrations).
 */

export interface DbConfig {
  url: string;
  serviceRoleKey: string;
}

let cached: SupabaseClient | null = null;

/** Returns the shared service-layer client. Created once per isolate. */
export function getServiceClient(config: DbConfig): SupabaseClient {
  if (cached) return cached;
  cached = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Test helper: reset the cached client between test cases. */
export function __resetServiceClientForTests(): void {
  cached = null;
}
