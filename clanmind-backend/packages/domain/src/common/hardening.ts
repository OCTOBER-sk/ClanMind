import { AppError } from "@clanmind/shared";

/**
 * §91 rate limiting — per-account, per-Group, per-IP layers. Fixed-window
 * counters keyed by scope; limits come from §178 configuration.
 */
export interface RateLimiterStore {
  /** Atomically increments the window counter; returns the new count. */
  increment(key: string, windowStart: string): Promise<number>;
}

export class RateLimiter {
  constructor(private readonly store: RateLimiterStore) {}

  async check(input: {
    scope: string;
    identifier: string;
    limit: number;
    windowMs: number;
    now?: Date;
  }): Promise<{ allowed: true } | { allowed: false; retry_after_seconds: number }> {
    const now = input.now ?? new Date();
    const windowStart = new Date(
      Math.floor(now.getTime() / input.windowMs) * input.windowMs,
    ).toISOString();
    const count = await this.store.increment(`${input.scope}:${input.identifier}`, windowStart);
    if (count > input.limit) {
      const windowEnd = new Date(
        Math.floor(now.getTime() / input.windowMs) * input.windowMs + input.windowMs,
      );
      return {
        allowed: false,
        retry_after_seconds: Math.max(1, Math.ceil((windowEnd.getTime() - now.getTime()) / 1000)),
      };
    }
    return { allowed: true };
  }

  /** Throws RATE_LIMITED (§102) when over budget. */
  async enforce(input: Parameters<RateLimiter["check"]>[0]): Promise<void> {
    const result = await this.check(input);
    if (!result.allowed) {
      throw new AppError(
        "RATE_LIMITED",
        `Too many requests. Retry in ${result.retry_after_seconds}s.`,
        { retry_after_seconds: result.retry_after_seconds },
      );
    }
  }
}

/** §166 server-controlled feature flags — per-Group, never client-side. */
export const FEATURE_FLAGS = [
  "meeting_mode",
  "proactive_ai",
  "github_write",
  "github_merge",
  "custom_skills",
  "deep_research",
  "offline_sync_v2",
  "interactive_artifacts",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export interface FeatureFlagRepository {
  get(groupId: string, flag: FeatureFlag): Promise<boolean | null>;
  set(groupId: string, flag: FeatureFlag, enabled: boolean): Promise<void>;
}

export class FeatureFlagService {
  constructor(
    private readonly flags: FeatureFlagRepository,
    private readonly defaults: Record<FeatureFlag, boolean> = {
      meeting_mode: true,
      proactive_ai: true,
      github_write: true,
      github_merge: true,
      custom_skills: true,
      deep_research: true,
      offline_sync_v2: true,
      interactive_artifacts: true,
    },
  ) {}

  async isEnabled(groupId: string, flag: FeatureFlag): Promise<boolean> {
    const override = await this.flags.get(groupId, flag);
    return override ?? this.defaults[flag];
  }

  async all(groupId: string): Promise<Record<FeatureFlag, boolean>> {
    const result = { ...this.defaults };
    for (const flag of FEATURE_FLAGS) {
      const override = await this.flags.get(groupId, flag);
      if (override !== null) result[flag] = override;
    }
    return result;
  }

  async set(groupId: string, flag: FeatureFlag, enabled: boolean): Promise<void> {
    if (!(FEATURE_FLAGS as readonly string[]).includes(flag)) {
      throw new AppError("VALIDATION_FAILED", "Unknown feature flag.");
    }
    await this.flags.set(groupId, flag, enabled);
  }
}

/**
 * §127/§128 file indexing pipeline: upload → validate → scan → extract →
 * chunk → index → ready, with freshness tracking so stale content is never
 * silently treated as current (§128).
 */
export type FileIndexStatus = "INDEXING" | "READY" | "FAILED" | "STALE" | "DELETED";

export interface IndexedFile {
  object_id: string;
  source_version: number;
  indexed_version: number | null;
  status: FileIndexStatus;
  indexed_at: string | null;
}

export function nextIndexState(input: {
  current: IndexedFile;
  event: "upload" | "scan_ok" | "extract_ok" | "index_ok" | "index_fail" | "source_changed" | "delete";
  sourceVersion?: number;
}): FileIndexStatus {
  switch (input.event) {
    case "upload":
    case "scan_ok":
    case "extract_ok":
      return "INDEXING";
    case "index_ok":
      return "READY";
    case "index_fail":
      return "FAILED";
    case "source_changed":
      // §128: source newer than the index ⇒ STALE, never silently current.
      return input.current.indexed_version !== null &&
        (input.sourceVersion ?? input.current.source_version) > (input.current.indexed_version ?? -Infinity)
        ? "STALE"
        : input.current.status;
    case "delete":
      return "DELETED";
  }
}

/** §129 AI-context permission levels for shared files. */
export type FileAiPermission = "group" | "project" | "private" | "ai_context_enabled";

export function aiContextAllowed(
  permission: FileAiPermission,
  context: { scope: "PUBLIC_GROUP" | "PRIVATE_AI"; isOwner: boolean },
): boolean {
  if (permission === "ai_context_enabled") return true;
  if (permission === "private") return context.scope === "PRIVATE_AI" && context.isOwner;
  return context.scope === "PUBLIC_GROUP";
}
