/**
 * Typed REST client — the single gateway every feature uses for HTTP
 * (FE §9: components never call fetch directly).
 *
 * Responsibilities:
 *  - attach bearer token + correlation + idempotency identity (BE §19/§101)
 *  - map the BE §102 error envelope into typed ApiError
 *  - retry ONLY transient failures with exponential backoff + jitter (BE §121);
 *    mutations are retry-safe because they always carry an Idempotency-Key
 *  - runtime-validate responses through zod schemas (BE §152) when provided
 */

import { z } from 'zod';
import { getActiveTransport, createFetchTransport, TimeoutError, type Transport, type TransportRequest } from './transport';
import { ApiError, NetworkError, isTransientFailure } from './errors';
import { ErrorEnvelopeSchema } from './schemas';

let transport: Transport | null = null;
let tokenProvider: () => Promise<string | null> = async () => null;

/**
 * FE §197 — invoked when an authenticated domain call comes back 401.
 * Registered by the app shell at boot; flips the auth store into the
 * "session expired" gate WITHOUT clearing local work. Auth endpoints
 * themselves (/auth/*) are excluded — a failed LOGIN is not an expired
 * SESSION.
 */
let unauthorizedHandler: ((error: ApiError) => void) | null = null;

export function setUnauthorizedHandler(handler: ((error: ApiError) => void) | null): void {
  unauthorizedHandler = handler;
}

export function configureApiClient(opts: {
  baseUrl?: string;
  getToken: () => Promise<string | null>;
}): void {
  if (opts.baseUrl && !transport) {
    transport = createFetchTransport({ baseUrl: opts.baseUrl, getToken: opts.getToken });
  }
  tokenProvider = opts.getToken;
}

export function getTransportForTesting(): Transport | null {
  return transport;
}

function backoffDelay(attempt: number): number {
  const base = Math.min(8_000, 250 * 2 ** attempt);
  const jitter = base * (0.7 + Math.random() * 0.6);
  return jitter;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface RequestOptions<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  method?: TransportRequest['method'];
  query?: TransportRequest['query'];
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** When provided, a successful response body is runtime-validated into T. */
  schema?: TSchema;
  retries?: number;
}

function extractApiError(status: number, json: unknown): ApiError {
  const parsed = ErrorEnvelopeSchema.safeParse(json);
  if (parsed.success) {
    return new ApiError({
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      status,
      requestId: parsed.data.error.request_id,
      details: json,
    });
  }
  // Non-envelope failure — preserve status semantics without inventing codes.
  return new ApiError({
    code: `HTTP_${status}`,
    message: typeof (json as { message?: string })?.message === 'string'
      ? ((json as { message: string }).message)
      : `Request failed with status ${status}`,
    status,
    details: json,
  });
}

export async function request<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const active = getActiveTransport(transport ?? createFetchTransport({ baseUrl: '/', getToken: tokenProvider }));
  const maxRetries = opts.retries ?? 2;
  const method = opts.method ?? 'GET';

  let attempt = 0;
  for (;;) {
    try {
      const res = await active.send({
        method,
        path,
        query: opts.query,
        body: opts.body,
        idempotencyKey: opts.idempotencyKey,
        signal: opts.signal,
        headers: opts.timeoutMs ? { 'X-Timeout-Ms': String(opts.timeoutMs) } : undefined,
      });

      if (!res.ok) {
        const apiErr = extractApiError(res.status, res.json);
        if (apiErr.status === 401 && !path.startsWith('/auth/')) {
          unauthorizedHandler?.(apiErr);
        }
        if (isTransientFailure(apiErr) && attempt < maxRetries) {
          attempt += 1;
          // BE §178 — honor the server's RATE_LIMITED hint when present
          // instead of blind exponential backoff.
          const retryAfter =
            apiErr.code === 'RATE_LIMITED' ? apiErr.retryAfterSeconds : undefined;
          await sleep(
            retryAfter !== undefined ? Math.min(retryAfter * 1000, 30_000) : backoffDelay(attempt),
          );
          continue;
        }
        throw apiErr;
      }

      if (opts.schema) {
        const parsed = opts.schema.safeParse(res.json);
        if (!parsed.success) {
          // Contract violation — surface loudly rather than render garbage.
          throw new ApiError({
            code: 'CONTRACT_VIOLATION',
            message: `Response failed schema validation: ${parsed.error.issues
              .map((i) => `${i.path.join('.')}: ${i.message}`)
              .join('; ')}`,
            status: res.status,
            details: parsed.error,
          });
        }
        return parsed.data as T;
      }
      return res.json as T;
    } catch (err) {
      if (err instanceof TimeoutError && attempt < maxRetries) {
        attempt += 1;
        await sleep(backoffDelay(attempt));
        continue;
      }
      if (
        (err instanceof NetworkError || err instanceof TypeError) &&
        attempt < maxRetries &&
        (navigator.onLine !== false)
      ) {
        attempt += 1;
        await sleep(backoffDelay(attempt));
        continue;
      }
      throw err;
    }
  }
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions & { schema?: z.ZodType<T> }) =>
    request<T>(path, {
      ...opts,
      method: 'POST',
      body,
      idempotencyKey:
        opts?.idempotencyKey ?? `op_${crypto.randomUUID()}`,
    }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions & { schema?: z.ZodType<T> }) =>
    request<T>(path, {
      ...opts,
      method: 'PATCH',
      body,
      idempotencyKey: opts?.idempotencyKey ?? `op_${crypto.randomUUID()}`,
    }),
  delete: <T>(path: string, opts?: RequestOptions & { schema?: z.ZodType<T> }) =>
    request<T>(path, {
      ...opts,
      method: 'DELETE',
      idempotencyKey: opts?.idempotencyKey ?? `op_${crypto.randomUUID()}`,
    }),
};
