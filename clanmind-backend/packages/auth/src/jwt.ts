import { AppError } from "@clanmind/shared";

/**
 * Auth gateway token verification (§6).
 * Supabase Auth issues access tokens signed with the project's JWT secret.
 * Some projects issue HS256 tokens (signed with a shared secret), while others
 * issue ES256 tokens (signed with an ECDSA P-256 key published via JWKS).
 * The gateway verifies signature + expiry and extracts the stable user id
 * (`sub`). Credential lifecycle (login, reset, future OAuth, 2FA) stays
 * entirely inside Supabase Auth (Correction 1).
 */

export interface AuthenticatedUser {
  user_id: string;
  email: string | null;
  role: string | null;
}

export interface VerifyOpts {
  /** The Supabase project URL, required for ES256 JWKS verification. */
  supabaseUrl?: string;
}

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                          */
/* -------------------------------------------------------------------------- */

function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

function decodeSegment(segment: string): Record<string, unknown> {
  const bytes = base64UrlToBytes(segment);
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*  JWKS cache (module-level, 5 min TTL)                                      */
/* -------------------------------------------------------------------------- */

interface CachedJwks {
  keys: JwksKey[];
  fetchedAt: number;
}

/** A JWKS key entry — extends JsonWebKey with `kid` which the standard type omits. */
interface JwksKey extends JsonWebKey {
  kid?: string;
}

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const jwksCache = new Map<string, CachedJwks>();

async function fetchJwks(supabaseUrl: string): Promise<JwksKey[]> {
  const now = Date.now();
  const cached = jwksCache.get(supabaseUrl);
  if (cached && now - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cached.keys;
  }

  const jwksUrl = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/.well-known/jwks.json`;
  let resp: Response;
  try {
    resp = await fetch(jwksUrl);
  } catch {
    throw new AppError("INVALID_TOKEN", "JWKS fetch failed.");
  }
  if (!resp.ok) {
    throw new AppError("INVALID_TOKEN", "JWKS fetch failed.");
  }

  let body: { keys?: JwksKey[] };
  try {
    body = (await resp.json()) as { keys?: JwksKey[] };
  } catch {
    throw new AppError("INVALID_TOKEN", "JWKS fetch failed.");
  }

  const keys = body.keys ?? [];
  jwksCache.set(supabaseUrl, { keys, fetchedAt: now });
  return keys;
}

/** Allow tests to clear the cache between runs. */
export function _clearJwksCache(): void {
  jwksCache.clear();
}

/* -------------------------------------------------------------------------- */
/*  ES256 signature verification                                              */
/* -------------------------------------------------------------------------- */

async function verifyEs256(
  signingInputBytes: ArrayBuffer,
  signatureBytes: ArrayBuffer,
  kid: string,
  supabaseUrl: string,
): Promise<boolean> {
  const keys = await fetchJwks(supabaseUrl);
  const jwk = keys.find(
    (k) =>
      k.kid === kid &&
      k.kty === "EC" &&
      k.crv === "P-256",
  );
  if (!jwk || !jwk.x || !jwk.y) {
    throw new AppError("INVALID_TOKEN", "JWKS key not found.");
  }

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    signatureBytes,
    signingInputBytes,
  );
  return valid;
}

/* -------------------------------------------------------------------------- */
/*  Shared payload validation (runs AFTER signature success)                  */
/* -------------------------------------------------------------------------- */

function validatePayload(payload: Record<string, unknown>): AuthenticatedUser {
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp <= now) {
    throw new AppError("INVALID_TOKEN", "Token has expired.");
  }

  const sub = payload.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    throw new AppError("INVALID_TOKEN", "Token has no subject.");
  }

  return {
    user_id: sub,
    email: typeof payload.email === "string" ? payload.email : null,
    role: typeof payload.role === "string" ? payload.role : null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Verifies a Supabase access token. Supports both HS256 (shared secret) and
 * ES256 (ECDSA P-256 via JWKS). Throws INVALID_TOKEN (§102) on any failure.
 */
export async function verifySupabaseJwt(
  token: string,
  secret: string,
  opts?: VerifyOpts,
): Promise<AuthenticatedUser> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AppError("INVALID_TOKEN", "Malformed authentication token.");
  }
  const [headerSeg, payloadSeg, signatureSeg] = parts as [string, string, string];

  let header: Record<string, unknown>;
  try {
    header = decodeSegment(headerSeg);
  } catch {
    throw new AppError("INVALID_TOKEN", "Malformed authentication token.");
  }

  const alg = header.alg;

  // --- Signature verification (branch by algorithm) ---

  if (alg === "HS256") {
    const key = await hmacKey(secret);
    const data = new TextEncoder().encode(`${headerSeg}.${payloadSeg}`);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signatureSeg).buffer as ArrayBuffer,
      data.buffer as ArrayBuffer,
    );
    if (!valid) {
      throw new AppError("INVALID_TOKEN", "Invalid token signature.");
    }
  } else if (alg === "ES256") {
    const kid = header.kid;
    if (typeof kid !== "string" || kid.length === 0) {
      throw new AppError("INVALID_TOKEN", "ES256 token missing kid header.");
    }
    const supabaseUrl = opts?.supabaseUrl;
    if (!supabaseUrl) {
      throw new AppError("INVALID_TOKEN", "ES256 verification requires supabaseUrl option.");
    }

    const signingInputBytes = new TextEncoder().encode(`${headerSeg}.${payloadSeg}`);
    const signatureBytes = base64UrlToBytes(signatureSeg);

    let valid: boolean;
    try {
      valid = await verifyEs256(
        signingInputBytes.buffer as ArrayBuffer,
        signatureBytes.buffer as ArrayBuffer,
        kid,
        supabaseUrl,
      );
    } catch (e) {
      // Re-throw known AppErrors; wrap unexpected errors
      if (e instanceof AppError) throw e;
      throw new AppError("INVALID_TOKEN", "Invalid token signature.");
    }
    if (!valid) {
      throw new AppError("INVALID_TOKEN", "Invalid token signature.");
    }
  } else {
    throw new AppError("INVALID_TOKEN", "Unsupported token algorithm.");
  }

  // --- Payload validation (shared, runs only after signature success) ---

  let payload: Record<string, unknown>;
  try {
    payload = decodeSegment(payloadSeg);
  } catch {
    throw new AppError("INVALID_TOKEN", "Malformed token payload.");
  }

  return validatePayload(payload);
}
