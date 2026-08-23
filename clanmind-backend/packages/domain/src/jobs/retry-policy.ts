import { AppError } from "@clanmind/shared";

/**
 * §121 error classification and retry policy.
 * Retries: transient yes (limited); rate-limited delayed; auth/permission/
 * invalid input never; conflict reconcile; provider unavailable fallback if
 * configured. Backoff is exponential with jitter.
 */

export type RetryClassification =
  | { kind: "RETRYABLE"; delayMs: number }
  | { kind: "PERMANENT" };

/** Error codes that must never be retried (§121). */
const PERMANENT_APP_CODES = new Set([
  "UNAUTHENTICATED",
  "INVALID_TOKEN",
  "FORBIDDEN",
  "GROUP_PERMISSION_DENIED",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "CONFLICT",
  "INVITE_INVALID",
  "GROUP_LIMIT_REACHED",
  "GROUP_DELETED",
  "ACTION_EXPIRED",
  "CLIENT_UPDATE_REQUIRED",
]);

export function classifyForRetry(
  error: unknown,
  retryCount: number,
  maxRetries: number,
  baseDelayMs = 1000,
  maxDelayMs = 60000,
): RetryClassification {
  if (retryCount >= maxRetries) return { kind: "PERMANENT" };
  if (error instanceof AppError && PERMANENT_APP_CODES.has(error.code)) {
    return { kind: "PERMANENT" };
  }
  const exponential = Math.min(baseDelayMs * 2 ** retryCount, maxDelayMs);
  const jitter = Math.random() * (exponential * 0.25);
  return { kind: "RETRYABLE", delayMs: Math.round(exponential + jitter) };
}
