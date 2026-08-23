import { AppError } from "@clanmind/shared";

/**
 * Auth gateway token verification (§6).
 * Supabase Auth issues HS256 access tokens signed with the project's JWT
 * secret. The gateway verifies signature + expiry and extracts the stable
 * user id (`sub`). Credential lifecycle (login, reset, future OAuth, 2FA)
 * stays entirely inside Supabase Auth (Correction 1).
 */

export interface AuthenticatedUser {
  user_id: string;
  email: string | null;
  role: string | null;
}

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

/** Verifies a Supabase access token. Throws INVALID_TOKEN (§102) on any failure. */
export async function verifySupabaseJwt(
  token: string,
  secret: string,
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
  if (header.alg !== "HS256") {
    throw new AppError("INVALID_TOKEN", "Unsupported token algorithm.");
  }

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

  let payload: Record<string, unknown>;
  try {
    payload = decodeSegment(payloadSeg);
  } catch {
    throw new AppError("INVALID_TOKEN", "Malformed token payload.");
  }

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
