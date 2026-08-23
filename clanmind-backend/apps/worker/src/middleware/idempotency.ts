import type { Context, Next } from "hono";
import { hashRequest } from "@clanmind/domain";
import type { AuthVariables } from "./auth";
import type { Env } from "../env";

/**
 * §19 idempotency guard. Runs after authentication for state-changing
 * methods. The client sends `Idempotency-Key` (or `client_operation_id` in
 * the JSON body) and must reuse the identical key AND payload on retry.
 * Replays return the originally recorded result with
 * `Idempotency-Replayed: true`; a key reused with a different payload is a
 * 409 conflict.
 */
export async function applyIdempotency(
  c: Context<{ Bindings: Env; Variables: AuthVariables }>,
  next: Next,
): Promise<Response | void> {
  const method = c.req.method.toUpperCase();
  if (method !== "POST" && method !== "PATCH" && method !== "DELETE" && method !== "PUT") {
    await next();
    return;
  }

  const services = c.get("services");
  if (!services.idempotency) {
    await next();
    return;
  }

  let bodyText = "";
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("application/json")) {
    bodyText = await c.req.text();
  }

  let operationId = c.req.header("idempotency-key") ?? "";
  if (!operationId && bodyText) {
    try {
      const parsed = JSON.parse(bodyText) as { client_operation_id?: unknown };
      if (typeof parsed.client_operation_id === "string") operationId = parsed.client_operation_id;
    } catch {
      /* non-JSON body with no header key — opts out */
    }
  }

  const requestHash = await hashRequest(method, new URL(c.req.url).pathname, bodyText);
  const actorId = c.get("user").user_id;

  const checked = await services.idempotency.check(actorId, operationId, requestHash);
  if (!checked) {
    await next();
    return;
  }

  if ("replay" in checked && checked.replay.result_status !== null) {
    c.header("Idempotency-Replayed", "true");
    return c.json(checked.replay.result_body, checked.replay.result_status as 200);
  }

  // First submission (possibly still in-flight from a concurrent duplicate):
  // execute and record the outcome.
  if ("replay" in checked) {
    // In-flight duplicate: the original request has not finished yet.
    await next();
    return;
  }

  await next();

  const res = c.res;
  const status = res.status;
  let recordedBody: unknown = null;
  let reference: string | null = null;
  const resContentType = res.headers.get("content-type") ?? "";
  if (resContentType.includes("application/json")) {
    try {
      recordedBody = await res.clone().json();
      if (recordedBody && typeof recordedBody === "object" && "id" in (recordedBody as Record<string, unknown>)) {
        const id = (recordedBody as Record<string, unknown>)["id"];
        if (typeof id === "string") reference = id;
      }
    } catch {
      /* body not JSON — record status only */
    }
  }
  await services.idempotency.record({
    operation_id: operationId,
    actor_id: actorId,
    result_status: status,
    result_body: recordedBody,
    result_reference: reference,
  });
}
