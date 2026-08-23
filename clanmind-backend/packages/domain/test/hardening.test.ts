import { describe, expect, it } from "vitest";
import {
  FEATURE_FLAGS,
  FeatureFlagService,
  RateLimiter,
  aiContextAllowed,
  nextIndexState,
  type FeatureFlagRepository,
  type IndexedFile,
  type RateLimiterStore,
} from "../src/common/hardening";
import { AppError } from "@clanmind/shared";

function memoryStore(): RateLimiterStore & { counts: Map<string, number> } {
  const counts = new Map<string, number>();
  return {
    counts,
    async increment(key, windowStart) {
      const composite = `${key}:${windowStart}`;
      const next = (counts.get(composite) ?? 0) + 1;
      counts.set(composite, next);
      return next;
    },
  };
}

describe("§91 rate limiting", () => {
  it("allows up to the limit per window, then RATE_LIMITED", async () => {
    const store = memoryStore();
    const limiter = new RateLimiter(store);
    const windowMs = 60_000;
    // Frozen clock so the loop cannot straddle a window boundary.
    const frozen = new Date();
    for (let i = 0; i < 30; i++) {
      await limiter.enforce({ scope: "messages/user", identifier: "u1", limit: 30, windowMs, now: frozen });
    }
    await expect(
      limiter.enforce({ scope: "messages/user", identifier: "u1", limit: 30, windowMs }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    // A different user is unaffected.
    await expect(
      limiter.enforce({ scope: "messages/user", identifier: "u2", limit: 30, windowMs }),
    ).resolves.toBeUndefined();
    // The next window resets.
    const nextWindow = new Date(
      Math.floor(frozen.getTime() / windowMs) * windowMs + windowMs + 1000,
    );
    await expect(
      limiter.enforce({
        scope: "messages/user",
        identifier: "u1",
        limit: 30,
        windowMs,
        now: nextWindow,
      }),
    ).resolves.toBeUndefined();
  });
});

function flagRepo(): FeatureFlagRepository & { map: Map<string, boolean> } {
  const map = new Map<string, boolean>();
  return {
    map,
    async get(groupId, flag) {
      return map.get(`${groupId}:${flag}`) ?? null;
    },
    async set(groupId, flag, enabled) {
      map.set(`${groupId}:${flag}`, enabled);
    },
  };
}

describe("§166 feature flags", () => {
  it("covers exactly the spec's eight flags, per-Group", async () => {
    expect(FEATURE_FLAGS).toHaveLength(8);
    const repo = flagRepo();
    const svc = new FeatureFlagService(repo);
    expect(await svc.isEnabled("g1", "deep_research")).toBe(true);
    await svc.set("g1", "deep_research", false);
    expect(await svc.isEnabled("g1", "deep_research")).toBe(false);
    // Per-Group: another group keeps the default (§166/frontend §165A.3).
    expect(await svc.isEnabled("g2", "deep_research")).toBe(true);
    await expect(svc.set("g1", "bogus_flag" as never, true)).rejects.toBeInstanceOf(AppError);
  });
});

const file = (indexed_version: number | null): IndexedFile => ({
  object_id: "o1",
  source_version: 3,
  indexed_version,
  status: indexed_version !== null ? "READY" : "INDEXING",
  indexed_at: indexed_version !== null ? new Date().toISOString() : null,
});

describe("§127/§128 file indexing", () => {
  it("walks the pipeline states", () => {
    expect(nextIndexState({ current: file(null), event: "upload" })).toBe("INDEXING");
    expect(nextIndexState({ current: file(null), event: "index_ok" })).toBe("READY");
    expect(nextIndexState({ current: file(3), event: "index_fail" })).toBe("FAILED");
    expect(nextIndexState({ current: file(3), event: "delete" })).toBe("DELETED");
  });

  it("a newer source version marks the index STALE, not silently current", () => {
    expect(nextIndexState({ current: file(3), event: "source_changed", sourceVersion: 4 })).toBe("STALE");
    expect(nextIndexState({ current: file(3), event: "source_changed", sourceVersion: 3 })).toBe("READY");
  });
});

describe("§129 AI file permissions", () => {
  it("private files feed only the owner's private context", () => {
    expect(aiContextAllowed("private", { scope: "PRIVATE_AI", isOwner: true })).toBe(true);
    expect(aiContextAllowed("private", { scope: "PRIVATE_AI", isOwner: false })).toBe(false);
    expect(aiContextAllowed("private", { scope: "PUBLIC_GROUP", isOwner: true })).toBe(false);
    expect(aiContextAllowed("group", { scope: "PUBLIC_GROUP", isOwner: false })).toBe(true);
    expect(aiContextAllowed("ai_context_enabled", { scope: "PUBLIC_GROUP", isOwner: false })).toBe(true);
  });
});
