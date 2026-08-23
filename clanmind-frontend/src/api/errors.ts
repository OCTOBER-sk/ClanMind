/**
 * Typed API error surface mapped from the backend error contract (BE §102):
 *   { "error": { "code": "...", "message": "...", "request_id": "..." } }
 *
 * Special codes with dedicated UX paths:
 *   APPLICATION_AI_QUOTA_EXHAUSTED (+ can_continue_with_byok payload, BE §94 / FE §141)
 *   CLIENT_UPDATE_REQUIRED        (BE §165 / FE §309A.2)
 *   409 CONFLICT                  (optimistic concurrency, BE §21.2)
 */

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
  constructor() {
    super('Request aborted');
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
