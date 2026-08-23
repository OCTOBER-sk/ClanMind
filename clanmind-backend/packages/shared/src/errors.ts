/**
 * Stable machine-readable error contract (spec §102).
 * Never expose stack traces, provider secrets, raw SQL, or internal service
 * credentials through these payloads.
 */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "INVALID_TOKEN",
  "FORBIDDEN",
  "GROUP_PERMISSION_DENIED",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "CONFLICT",
  "RATE_LIMITED",
  "IDEMPOTENCY_REPLAY",
  "GROUP_LIMIT_REACHED",
  "GROUP_DELETED",
  "INVITE_INVALID",
  "APPLICATION_AI_QUOTA_EXHAUSTED",
  "CLIENT_UPDATE_REQUIRED",
  "ACTION_EXPIRED",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  INVALID_TOKEN: 401,
  FORBIDDEN: 403,
  GROUP_PERMISSION_DENIED: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  IDEMPOTENCY_REPLAY: 409,
  GROUP_LIMIT_REACHED: 403,
  GROUP_DELETED: 403,
  INVITE_INVALID: 404,
  APPLICATION_AI_QUOTA_EXHAUSTED: 402,
  CLIENT_UPDATE_REQUIRED: 426,
  ACTION_EXPIRED: 409,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code] ?? 500;
    this.details = details;
  }
}

/** §102 response envelope: `{ error: { code, message, request_id } }`. */
export interface ErrorEnvelope {
  error: {
    code: ErrorCode | "INTERNAL";
    message: string;
    request_id: string;
    details?: unknown;
  };
}

export function toErrorEnvelope(
  error: unknown,
  requestId: string,
): { body: ErrorEnvelope; status: number } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          request_id: requestId,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
    };
  }
  // Unknown errors never leak internals (§102).
  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL",
        message: "An unexpected error occurred.",
        request_id: requestId,
      },
    },
  };
}
