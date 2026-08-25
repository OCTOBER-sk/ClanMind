import type { Context, Next } from "hono";
import { verifySupabaseJwt, type AuthenticatedUser } from "@clanmind/auth";
import { AppError } from "@clanmind/shared";
import type { Env } from "../env";
import type { AppServices } from "../services";
import { applyIdempotency } from "./idempotency";

/**
 * §6 auth gateway: validate the Supabase session and attach identity to the
 * request (§3.3 Auth Gateway). Requests without a valid token never reach a
 * service.
 */
export type AuthVariables = {
  user: AuthenticatedUser;
  services: AppServices;
  requestId: string;
};

export async function requireAuthenticatedUser(
  c: Context<{ Bindings: Env; Variables: AuthVariables }>,
  next: Next,
): Promise<Response | void> {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    throw new AppError("UNAUTHENTICATED", "Authentication required.");
  }
  const user = await verifySupabaseJwt(token, c.env.SUPABASE_JWT_SECRET, {
    supabaseUrl: c.env.SUPABASE_URL,
  });
  c.set("user", user);
  return applyIdempotency(c, next);
}
