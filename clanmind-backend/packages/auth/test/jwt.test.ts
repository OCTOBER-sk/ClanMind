import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AppError } from "@clanmind/shared";
import { verifySupabaseJwt, _clearJwksCache } from "../src/jwt";

const SECRET = "test-jwt-secret-value";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Parse a DER-encoded ECDSA P-256 signature into raw r||s (64 bytes).
 * DER: SEQUENCE { INTEGER r, INTEGER s } where each INTEGER may have a
 * leading 0x00 byte if the MSB of the magnitude is set.
 */
function derToRawP256(der: Uint8Array): Uint8Array {
  let off = 0;
  // SEQUENCE tag (0x30) + length byte
  if (der[off] !== 0x30) throw new Error("Expected DER SEQUENCE");
  off += 2;

  // INTEGER r
  if (der[off] !== 0x02) throw new Error("Expected INTEGER for r");
  const rLen = der[off + 1]!;
  off += 2;
  // Strip leading zero padding if present
  const rStart = der[off] === 0x00 ? off + 1 : off;
  const rValueLen = der[off] === 0x00 ? rLen - 1 : rLen;
  off += rLen;

  // INTEGER s
  if (der[off] !== 0x02) throw new Error("Expected INTEGER for s");
  const sLen = der[off + 1]!;
  off += 2;
  const sStart = der[off] === 0x00 ? off + 1 : off;
  const sValueLen = der[off] === 0x00 ? sLen - 1 : sLen;
  off += sLen;

  const r = new Uint8Array(32);
  r.set(der.slice(rStart, rStart + rValueLen), 32 - rValueLen);
  const s = new Uint8Array(32);
  s.set(der.slice(sStart, sStart + sValueLen), 32 - sValueLen);

  const raw = new Uint8Array(64);
  raw.set(r);
  raw.set(s, 32);
  return raw;
}

/** Normalize a signature to raw r||s (64 bytes). Handles both DER and raw formats. */
function normalizeSignature(sig: Uint8Array): Uint8Array {
  // Node.js returns raw r||s (64 bytes); WebCrypto browsers may return DER.
  if (sig.length === 64) return sig;
  return derToRawP256(sig);
}

/** JWK with optional `kid` for JWKS responses. */
interface JwkWithKid extends JsonWebKey {
  kid?: string;
}

async function signHs256(payload: Record<string, unknown>, secret = SECRET): Promise<string> {
  const header = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  );
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${body}`),
  );
  return `${header}.${body}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

/**
 * Generate a P-256 ECDSA key pair, sign a JWT with ES256, and return the
 * token + the JWK public key for stubbing JWKS responses.
 */
async function signEs256(
  payload: Record<string, unknown>,
  kid = "test-key-1",
): Promise<{ token: string; publicKeyJwk: JwkWithKid }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );

  const header = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ alg: "ES256", typ: "JWT", kid })),
  );
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = new TextEncoder().encode(`${header}.${body}`);

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.privateKey,
    signingInput,
  );

  // Convert signature to raw r||s (64 bytes)
  const rawSig = normalizeSignature(new Uint8Array(sig));

  const token = `${header}.${body}.${bytesToBase64Url(rawSig)}`;

  // Export public key as JWK and attach kid
  const publicKeyJwk = (await crypto.subtle.exportKey("jwk", keyPair.publicKey)) as JwkWithKid;
  publicKeyJwk.kid = kid;

  return { token, publicKeyJwk };
}

const UUID = "00000000-0000-4000-8000-0000000000aa";
const FAKE_URL = "https://example.supabase.co";

function stubJwks(jwks: { keys: JwkWithKid[] }): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(jwks), { status: 200, headers: { "content-type": "application/json" } }),
  );
}

describe("§6 auth gateway — Supabase JWT verification", () => {
  beforeEach(() => {
    _clearJwksCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  //  HS256 backward compatibility
  // -------------------------------------------------------------------------

  describe("HS256 path", () => {
    it("accepts a valid HS256 token and extracts the identity", async () => {
      const token = await signHs256({
        sub: UUID,
        email: "santhosh@example.com",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 600,
      });
      const user = await verifySupabaseJwt(token, SECRET);
      expect(user.user_id).toBe(UUID);
      expect(user.email).toBe("santhosh@example.com");
      expect(user.role).toBe("authenticated");
    });

    it("rejects an expired HS256 token", async () => {
      const token = await signHs256({
        sub: UUID,
        exp: Math.floor(Date.now() / 1000) - 10,
      });
      await expect(verifySupabaseJwt(token, SECRET)).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: "Token has expired.",
      });
    });

    it("rejects a tampered HS256 signature", async () => {
      const token = await signHs256({ sub: UUID, exp: Math.floor(Date.now() / 1000) + 600 });
      const wrong = await signHs256({ sub: UUID }, "other-secret");
      const forged = `${token.slice(0, token.lastIndexOf(".") + 1)}${wrong.split(".")[2]}`;
      await expect(verifySupabaseJwt(forged, SECRET)).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: "Invalid token signature.",
      });
    });

    it("rejects HS256 token with missing sub", async () => {
      const token = await signHs256({
        email: "test@example.com",
        exp: Math.floor(Date.now() / 1000) + 600,
      });
      await expect(verifySupabaseJwt(token, SECRET)).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: "Token has no subject.",
      });
    });

    it("rejects garbage input", async () => {
      await expect(verifySupabaseJwt("not-a-jwt", SECRET)).rejects.toMatchObject({
        code: "INVALID_TOKEN",
      });
    });
  });

  // -------------------------------------------------------------------------
  //  ES256 path
  // -------------------------------------------------------------------------

  describe("ES256 path", () => {
    it("accepts a valid ES256 token verified against JWKS", async () => {
      const { token, publicKeyJwk } = await signEs256({
        sub: UUID,
        email: "alice@example.com",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 600,
      });

      vi.stubGlobal("fetch", stubJwks({ keys: [publicKeyJwk] }));

      const user = await verifySupabaseJwt(token, "", { supabaseUrl: FAKE_URL });
      expect(user.user_id).toBe(UUID);
      expect(user.email).toBe("alice@example.com");
      expect(user.role).toBe("authenticated");
    });

    it("rejects ES256 token signed with a different key", async () => {
      const { token } = await signEs256({
        sub: UUID,
        exp: Math.floor(Date.now() / 1000) + 600,
      }, "key-a");

      // JWKS returns a DIFFERENT key
      const otherKeyPair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
      );
      const otherJwk = (await crypto.subtle.exportKey("jwk", otherKeyPair.publicKey)) as JwkWithKid;
      otherJwk.kid = "key-a"; // same kid but different key material

      vi.stubGlobal("fetch", stubJwks({ keys: [otherJwk] }));

      await expect(
        verifySupabaseJwt(token, "", { supabaseUrl: FAKE_URL }),
      ).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: "Invalid token signature.",
      });
    });

    it("rejects ES256 token when JWKS has no matching kid", async () => {
      const { token } = await signEs256({
        sub: UUID,
        exp: Math.floor(Date.now() / 1000) + 600,
      }, "key-unknown");

      // JWKS returns a key with a different kid
      const otherKeyPair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
      );
      const otherJwk = (await crypto.subtle.exportKey("jwk", otherKeyPair.publicKey)) as JwkWithKid;
      otherJwk.kid = "key-other";

      vi.stubGlobal("fetch", stubJwks({ keys: [otherJwk] }));

      await expect(
        verifySupabaseJwt(token, "", { supabaseUrl: FAKE_URL }),
      ).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: "JWKS key not found.",
      });
    });

    it("rejects ES256 token when JWKS fetch fails (network error)", async () => {
      const { token } = await signEs256({
        sub: UUID,
        exp: Math.floor(Date.now() / 1000) + 600,
      });

      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

      await expect(
        verifySupabaseJwt(token, "", { supabaseUrl: FAKE_URL }),
      ).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: "JWKS fetch failed.",
      });
    });

    it("rejects ES256 token when JWKS fetch returns non-200", async () => {
      const { token } = await signEs256({
        sub: UUID,
        exp: Math.floor(Date.now() / 1000) + 600,
      });

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("not found", { status: 404 })),
      );

      await expect(
        verifySupabaseJwt(token, "", { supabaseUrl: FAKE_URL }),
      ).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: "JWKS fetch failed.",
      });
    });

    it("rejects ES256 token with missing kid header", async () => {
      // Manually craft a token with ES256 but no kid
      const header = bytesToBase64Url(
        new TextEncoder().encode(JSON.stringify({ alg: "ES256", typ: "JWT" })),
      );
      const body = bytesToBase64Url(
        new TextEncoder().encode(JSON.stringify({ sub: UUID, exp: Math.floor(Date.now() / 1000) + 600 })),
      );
      const token = `${header}.${body}.${bytesToBase64Url(new Uint8Array(64))}`;

      await expect(
        verifySupabaseJwt(token, "", { supabaseUrl: FAKE_URL }),
      ).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: "ES256 token missing kid header.",
      });
    });

    it("rejects ES256 token when supabaseUrl is missing", async () => {
      const { token } = await signEs256({
        sub: UUID,
        exp: Math.floor(Date.now() / 1000) + 600,
      });

      await expect(
        verifySupabaseJwt(token, ""),
      ).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: "ES256 verification requires supabaseUrl option.",
      });
    });

    it("rejects expired ES256 token", async () => {
      const { token, publicKeyJwk } = await signEs256({
        sub: UUID,
        exp: Math.floor(Date.now() / 1000) - 10,
      });

      vi.stubGlobal("fetch", stubJwks({ keys: [publicKeyJwk] }));

      await expect(
        verifySupabaseJwt(token, "", { supabaseUrl: FAKE_URL }),
      ).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: "Token has expired.",
      });
    });

    it("rejects ES256 token with missing sub", async () => {
      const { token, publicKeyJwk } = await signEs256({
        email: "test@example.com",
        exp: Math.floor(Date.now() / 1000) + 600,
      });

      vi.stubGlobal("fetch", stubJwks({ keys: [publicKeyJwk] }));

      await expect(
        verifySupabaseJwt(token, "", { supabaseUrl: FAKE_URL }),
      ).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: "Token has no subject.",
      });
    });

    it("caches JWKS and does not refetch within TTL", async () => {
      const { token, publicKeyJwk } = await signEs256({
        sub: UUID,
        exp: Math.floor(Date.now() / 1000) + 600,
      });

      const fetchMock = stubJwks({ keys: [publicKeyJwk] });
      vi.stubGlobal("fetch", fetchMock);

      // First call — fetches JWKS
      await verifySupabaseJwt(token, "", { supabaseUrl: FAKE_URL });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call — should use cache, no additional fetch
      await verifySupabaseJwt(token, "", { supabaseUrl: FAKE_URL });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  //  General error cases (both algorithms)
  // -------------------------------------------------------------------------

  describe("general error cases", () => {
    it("rejects unsupported algorithm", async () => {
      const header = bytesToBase64Url(
        new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })),
      );
      const body = bytesToBase64Url(
        new TextEncoder().encode(JSON.stringify({ sub: UUID })),
      );
      const token = `${header}.${body}.${bytesToBase64Url(new Uint8Array(256))}`;

      await expect(verifySupabaseJwt(token, SECRET)).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: "Unsupported token algorithm.",
      });
    });

    it("rejects malformed header", async () => {
      // base64url that decodes to invalid JSON
      const badHeader = bytesToBase64Url(new TextEncoder().encode("not-json"));
      const body = bytesToBase64Url(
        new TextEncoder().encode(JSON.stringify({ sub: UUID })),
      );
      const token = `${badHeader}.${body}.${bytesToBase64Url(new Uint8Array(64))}`;

      await expect(verifySupabaseJwt(token, SECRET)).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: "Malformed authentication token.",
      });
    });

    it("rejects token with wrong number of segments", async () => {
      await expect(verifySupabaseJwt("a.b", SECRET)).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: "Malformed authentication token.",
      });
    });
  });
});
