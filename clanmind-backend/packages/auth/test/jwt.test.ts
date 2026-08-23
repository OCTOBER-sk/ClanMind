import { describe, expect, it } from "vitest";
import { AppError } from "@clanmind/shared";
import { verifySupabaseJwt } from "../src/jwt";

const SECRET = "test-jwt-secret-value";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: Record<string, unknown>, secret = SECRET): Promise<string> {
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

const UUID = "00000000-0000-4000-8000-0000000000aa";

describe("§6 auth gateway — Supabase JWT verification", () => {
  it("accepts a valid token and extracts the identity", async () => {
    const token = await sign({
      sub: UUID,
      email: "santhosh@example.com",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    const user = await verifySupabaseJwt(token, SECRET);
    expect(user.user_id).toBe(UUID);
    expect(user.email).toBe("santhosh@example.com");
  });

  it("rejects an expired token", async () => {
    const token = await sign({
      sub: UUID,
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    await expect(verifySupabaseJwt(token, SECRET)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });

  it("rejects a tampered signature", async () => {
    const token = await sign({ sub: UUID, exp: Math.floor(Date.now() / 1000) + 600 });
    const wrong = await sign({ sub: UUID }, "other-secret");
    const forged = `${token.slice(0, token.lastIndexOf(".") + 1)}${wrong.split(".")[2]}`;
    await expect(verifySupabaseJwt(forged, SECRET)).rejects.toBeInstanceOf(AppError);
  });

  it("rejects garbage input", async () => {
    await expect(verifySupabaseJwt("not-a-jwt", SECRET)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });
});
