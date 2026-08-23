import { z } from "zod";

/**
 * §178 recommended initial limits. Every value must be read from
 * configuration rather than hard-coded in application logic. These constants
 * are the documented fallback defaults only; environments override them via
 * LIMITS_JSON, and per-Group overrides live in quota_states.
 */
export const limitsSchema = z.object({
  message_body_max_chars: z.number().int().positive().default(8000),
  attachment_max_bytes: z.number().int().positive().default(26_214_400), // 25 MB
  attachments_per_message_max: z.number().int().positive().default(10),
  ai_context_token_budget: z.number().int().positive().default(32_000),
  ai_run_soft_timeout_seconds: z.number().int().positive().default(120),
  ai_run_hard_timeout_seconds: z.number().int().positive().default(300),
  tool_calls_per_run_max: z.number().int().positive().default(8),
  tool_total_time_per_run_seconds: z.number().int().positive().default(60),
  deep_research_search_batches_max: z.number().int().positive().default(6),
  deep_research_sources_considered_max: z.number().int().positive().default(25),
  deep_research_sources_cited_max: z.number().int().positive().default(8),
  artifact_text_max_bytes: z.number().int().positive().default(512_000), // 500 KB
  artifact_binary_max_bytes: z.number().int().positive().default(10_485_760), // 10 MB
  group_members_initial_max: z.number().int().positive().default(25),
  projects_active_per_group_max: z.number().int().positive().default(20),
  messages_per_minute_per_user: z.number().int().positive().default(30),
  ai_requests_per_minute_per_group: z.number().int().positive().default(10),
  github_actions_per_hour_per_group: z.number().int().positive().default(20),
  invite_token_lifetime_days: z.number().int().positive().default(7),
  signed_url_lifetime_seconds: z.number().int().positive().default(900), // 15 min
  group_soft_delete_recovery_days: z.number().int().positive().default(30),
});

export type Limits = z.infer<typeof limitsSchema>;

/** Parse a LIMITS_JSON string, falling back to §178 defaults per-field. */
export function parseLimits(raw: string | undefined | null): Limits {
  if (!raw) return limitsSchema.parse({});
  try {
    return limitsSchema.parse(JSON.parse(raw));
  } catch {
    // Malformed configuration must not take the service down; fall back to
    // the documented defaults and let observability flag the bad input.
    return limitsSchema.parse({});
  }
}
