import { describe, expect, it } from "vitest";
import { parseLimits } from "../src/limits";

describe("§178 limits configuration", () => {
  it("returns documented defaults when no config is provided", () => {
    const limits = parseLimits(undefined);
    expect(limits.message_body_max_chars).toBe(8000);
    expect(limits.ai_context_token_budget).toBe(32000);
    expect(limits.tool_calls_per_run_max).toBe(8);
    expect(limits.group_members_initial_max).toBe(25);
    expect(limits.invite_token_lifetime_days).toBe(7);
    expect(limits.signed_url_lifetime_seconds).toBe(900);
    expect(limits.group_soft_delete_recovery_days).toBe(30);
  });

  it("parses overrides from LIMITS_JSON", () => {
    const limits = parseLimits(
      JSON.stringify({ message_body_max_chars: 100, group_members_initial_max: 5 }),
    );
    expect(limits.message_body_max_chars).toBe(100);
    expect(limits.group_members_initial_max).toBe(5);
    // Unspecified fields keep defaults.
    expect(limits.ai_context_token_budget).toBe(32000);
  });

  it("falls back to defaults on malformed JSON instead of throwing", () => {
    const limits = parseLimits("{not json");
    expect(limits.message_body_max_chars).toBe(8000);
  });
});
