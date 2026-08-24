/**
 * Typed API error surface mapped from the backend error contract (BE §102):
 *   { "error": { "code": "...", "message": "...", "request_id": "...", "details": … } }
 *
 * Special codes with dedicated UX paths:
 *   RATE_LIMITED (429)            — details.retry_after_seconds honored on retry
 *   APPLICATION_AI_QUOTA_EXHAUSTED (402, BE §94 / FE §141)
 *                                 — details.body.can_continue_with_byok branch
 *   CLIENT_UPDATE_REQUIRED        (BE §165 / FE §309A.2)
 *   409 CONFLICT                  (optimistic concurrency, BE §21.2)
 */

import { QuotaErrorDetailsSchema } from './schemas';

export class ApiError extends Error {
  /** Stable machine-readable backend code (BE §102). Unknown codes are preserved verbatim. */
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  /** Raw body when the backend attached extra fields (e.g. can_continue_with_byok). */
  readonly details: unknown;

  constructor(init: {
    code: string;
    message?: string;
    status: number;
    requestId?: string;
    details?: unknown;
  }) {
    super(init.message ?? init.code);
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status;
    this.requestId = init.requestId;
    this.details = init.details;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  /**
   * BE §178 rate limiting — seconds to wait before retrying, parsed out of
   * the §102 envelope's `details.retry_after_seconds`. Undefined when the
   * backend did not supply a hint.
   */
  get retryAfterSeconds(): number | undefined {
    const details =
      (this.details as { error?: { details?: { retry_after_seconds?: unknown } } } | undefined)
        ?.error?.details?.retry_after_seconds;
    const n = Number(details);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
}

export interface QuotaExhaustionInfo {
  canContinueWithByok: boolean;
}

/**
 * BE §94 / FE §141 — extract the APPLICATION_AI_QUOTA_EXHAUSTED contract from
 * an ApiError. The real orchestrator throws AppError(code, JSON.stringify(body),
 * { status, body }), so the exhaustion body may surface in ANY of:
 *   details.error.details.body · details.error.details · message (JSON)
 * This parser tolerates all three shapes without inventing fields.
 */
export function quotaExhaustionOf(err: unknown): QuotaExhaustionInfo | null {
  if (!(err instanceof ApiError) || err.code !== 'APPLICATION_AI_QUOTA_EXHAUSTED') return null;

  const errDetails = (err.details as { error?: { details?: unknown } } | undefined)?.error?.details as
    | { body?: unknown; code?: unknown; can_continue_with_byok?: unknown }
    | undefined;

  const candidates: unknown[] = [];
  if (errDetails && typeof errDetails === 'object') {
    candidates.push(errDetails.body);
    candidates.push(errDetails);
  }
  if (typeof err.message === 'string' && err.message.trim().startsWith('{')) {
    try {
      candidates.push(JSON.parse(err.message));
    } catch {
      /* message was not JSON after all */
    }
  }

  for (const candidate of candidates) {
    const parsed = QuotaErrorDetailsSchema.safeParse(candidate);
    if (parsed.success && parsed.data.code === 'APPLICATION_AI_QUOTA_EXHAUSTED') {
      return { canContinueWithByok: parsed.data.can_continue_with_byok ?? false };
    }
  }
  // Code already identifies exhaustion; absence of the flag means no BYOK path.
  return { canContinueWithByok: false };
}

/** Network-level failure (socket dropped, DNS, timeout before response). */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Network request failed');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/** The request was aborted by the caller (user cancel / timeout). Never retried. */
export class AbortedError extends Error {
  constructor(message = 'Request aborted') {
    super(message);
    this.name = 'AbortedError';
  }
}

/**
 * Retry classification per BE §121: retry transient failures only —
 * network errors, 408 request timeout, 429 rate-limited (delayed), 5xx.
 * Never retry auth/permission/validation/not-found/conflict classes.
 */
export function isTransientFailure(err: unknown): boolean {
  if (err instanceof AbortedError) return false;
  if (err instanceof NetworkError) return true;
  // fetch() throws TypeError on network-level failures
  if (typeof TypeError !== 'undefined' && err instanceof TypeError) return true;
  if (err instanceof ApiError) {
    return err.status === 408 || err.status === 429 || (err.status >= 500 && err.status <= 599);
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return false;
}
