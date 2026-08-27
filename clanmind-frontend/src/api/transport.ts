/**
 * Transport layer — the ONLY place raw network I/O happens for REST.
 *
 * The default transport is `fetch` (JSON) + XHR (multipart uploads, the only
 * browser API with upload progress). Tests can install a transport override
 * via `setTransportOverride()` (used by src/mocks and test files).
 */

import { AbortedError, NetworkError } from './errors';

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

/**
 * Multipart binary upload (attachments, BE §43/§104) with progress + abort.
 * A separate capability from `send` because browsers only expose UPLOAD
 * progress through XHR — fetch cannot report bytes sent. No timeout applies:
 * large transfers must not be killed mid-flight; cancellation is explicit.
 */
export interface TransportUploadRequest {
  path: string;
  form: FormData;
  /** 0..1, driven by XHR upload progress events. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  /** BE §19 — uploads are state-changing and carry the identity too. */
  idempotencyKey?: string;
}

export interface Transport {
  send(req: TransportRequest): Promise<TransportResponse>;
  /**
   * Optional capability — implemented by the fetch transport (live) and the
   * demo transport alike. Callers go through `api.upload` which throws a
   * typed error when a custom transport lacks it.
   */
  upload?(req: TransportUploadRequest): Promise<TransportResponse>;
}

/** Our own timeout fired; classified as transient (BE §121). */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

let transportOverride: Transport | null = null;

/** Installed by tests and src/mocks. Never set in production. */
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

    async upload(req: TransportUploadRequest): Promise<TransportResponse> {
      const url = new URL(`${opts.baseUrl}${req.path}`, window.location.origin);
      const headers: Record<string, string> = {};
      const token = await opts.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      if (req.idempotencyKey) {
        headers['Idempotency-Key'] = req.idempotencyKey;
        headers['X-Client-Operation-Id'] = req.idempotencyKey;
      }
      // Correlation id per BE §101.
      headers['X-Request-Id'] = `req_${crypto.randomUUID()}`;
      return xhrUpload(url.toString(), req, headers);
    },
  };
}

/**
 * Pure response shaping for XHR uploads so the mapping is unit-testable
 * without a real network stack.
 */
export function parseUploadResponse(status: number, responseText: string | null): TransportResponse {
  let json: unknown = null;
  if (responseText) {
    try {
      json = JSON.parse(responseText) as unknown;
    } catch {
      json = null;
    }
  }
  return { status, ok: status >= 200 && status < 300, json };
}

/**
 * Browser upload progress requires XMLHttpRequest (fetch cannot report bytes
 * sent). Abort maps to `AbortedError` — caller-requested cancellation is never
 * retried or surfaced as a failure (§48 cancelled state).
 */
export function xhrUpload(
  url: string,
  req: TransportUploadRequest,
  headers: Record<string, string>,
): Promise<TransportResponse> {
  return new Promise<TransportResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    for (const [name, value] of Object.entries(headers)) {
      // Let the browser set Content-Type — it owns the multipart boundary.
      if (name.toLowerCase() !== 'content-type') xhr.setRequestHeader(name, value);
    }

    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      xhr.abort();
      req.signal?.removeEventListener('abort', onAbort);
      reject(new AbortedError('Upload cancelled'));
    };

    xhr.upload.onprogress = (e: ProgressEvent) => {
      if (e.lengthComputable && e.total > 0) req.onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (settled) return;
      settled = true;
      req.signal?.removeEventListener('abort', onAbort);
      resolve(parseUploadResponse(xhr.status, xhr.responseText));
    };
    xhr.onerror = () => {
      if (settled) return;
      settled = true;
      req.signal?.removeEventListener('abort', onAbort);
      reject(new NetworkError(new Error('Upload failed — the network connection was interrupted.')));
    };
    xhr.onabort = () => {
      if (!settled) {
        settled = true;
        req.signal?.removeEventListener('abort', onAbort);
        reject(new AbortedError('Upload cancelled'));
      }
    };

    req.signal?.addEventListener('abort', onAbort, { once: true });
    xhr.send(req.form);
  });
}
