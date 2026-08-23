/**
 * Transport layer — the ONLY place raw network I/O happens for REST.
 *
 * The default transport is `fetch`. In demo mode (VITE_DEMO_MODE=1) a
 * deterministic in-process transport override is installed (src/mocks) that
 * implements the same backend contracts, so the entire app runs end-to-end
 * without a live deployment and production bundles contain zero mock code.
 */

export interface TransportRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Path beginning with `/`, relative to the API base (BE §103: /api/v1). */
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** BE §19 idempotency identity — required for state-changing requests. */
  idempotencyKey?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface TransportResponse {
  status: number;
  ok: boolean;
  json: unknown;
}

export interface Transport {
  send(req: TransportRequest): Promise<TransportResponse>;
}

/** Our own timeout fired; classified as transient (BE §121). */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

let transportOverride: Transport | null = null;

/** Installed by src/mocks when VITE_DEMO_MODE=1. Never set in production. */
export function setTransportOverride(transport: Transport | null): void {
  transportOverride = transport;
}

export function getActiveTransport(fallback: Transport): Transport {
  return transportOverride ?? fallback;
}

export interface FetchTransportOptions {
  baseUrl: string;
  /** Resolves the current bearer token (Supabase access token). */
  getToken: () => Promise<string | null>;
  timeoutMs?: number;
}

export function createFetchTransport(opts: FetchTransportOptions): Transport {
  const timeoutMs = opts.timeoutMs ?? 20_000;

  return {
    async send(req: TransportRequest): Promise<TransportResponse> {
      const url = new URL(`${opts.baseUrl}${req.path}`, window.location.origin);
      if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
          if (value !== undefined) url.searchParams.set(key, String(value));
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
      const onExternalAbort = () => controller.abort(req.signal?.reason);
      req.signal?.addEventListener('abort', onExternalAbort);

      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...req.headers,
      };
      const token = await opts.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      if (req.body !== undefined) headers['Content-Type'] = 'application/json';
      if (req.idempotencyKey && req.method !== 'GET') {
        // BE §19 — every state-changing request carries the idempotency identity.
        headers['Idempotency-Key'] = req.idempotencyKey;
        headers['X-Client-Operation-Id'] = req.idempotencyKey;
      }
      // Correlation id per BE §101.
      headers['X-Request-Id'] = `req_${crypto.randomUUID()}`;

      try {
        const res = await fetch(url.toString(), {
          method: req.method,
          headers,
          body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
          signal: controller.signal,
        });

        let json: unknown = null;
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          json = await res.json().catch(() => null);
        }

        return { status: res.status, ok: res.ok, json };
      } catch (err) {
        // Distinguish caller-abort from our own timeout (caller abort is never retried).
        if (controller.signal.aborted && !req.signal?.aborted) {
          throw new TimeoutError(`Request timed out after ${timeoutMs}ms`);
        }
        throw err;
      } finally {
        clearTimeout(timer);
        req.signal?.removeEventListener('abort', onExternalAbort);
      }
    },
  };
}
