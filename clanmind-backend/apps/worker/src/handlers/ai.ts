import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "@clanmind/shared";
import type { AiRun } from "@clanmind/domain";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuthenticatedUser } from "../middleware/auth";
import { getAiRuntime, enforceRateLimit } from "../ai";

/** §115 step 1 body contract. */
const startRunBody = z.object({
  message: z.string().min(1),
  project_id: z.string().uuid().nullable().optional(),
  mode: z.enum(["ASSIST", "FACILITATE", "ACT"]).optional(),
  visibility: z.enum(["GROUP", "PRIVATE_PAIR", "PRIVATE_AI"]).optional(),
  input_message_id: z.string().uuid().nullable().optional(),
  private_conversation_id: z.string().uuid().nullable().optional(),
  /** Explicit tool invocations requested by the client (§115 step 15). */
  tool_calls: z
    .array(z.object({ tool_name: z.string().min(1), input: z.record(z.unknown()) }))
    .max(8)
    .optional(),
});

/**
 * §106 AI endpoints. REST is the canonical persistence path (§105): runs are
 * started, observed and cancelled here; streaming deltas travel over WS.
 */
export function aiRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.use("*", requireAuthenticatedUser);

  app.post("/api/v1/groups/:groupId/ai/runs", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const groupId = c.req.param("groupId");
    const { member } = await services.membership.requireMember(groupId, user.user_id);

    // §178 per-Group AI burst cap (configuration-driven).
    const limits = services.limits;
    enforceRateLimit(
      `ai:${groupId}`,
      limits.ai_requests_per_minute_per_group,
      60_000,
    );

    const parsed = startRunBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid request body.");
    const body = parsed.data;

    const rt = getAiRuntime(c.env, services);
    const byokConfigured = await anyByokEnabled(services.db, groupId);

    const run = await rt.orchestrator.startRun({
      group_id: groupId,
      requester_user_id: user.user_id,
      project_id: body.project_id ?? null,
      mode: body.mode ?? "ASSIST",
      visibility: body.visibility ?? "GROUP",
      input_message_id: body.input_message_id ?? null,
      private_conversation_id: body.private_conversation_id ?? null,
      byokConfigured,
    });

    // §54A.5: privacy authorization happens during candidate assembly, before
    // any ranking/scoring inside the ContextEngine.
    const candidates = await rt.buildContextCandidates({
      group_id: groupId,
      project_id: body.project_id ?? null,
      requester_user_id: user.user_id,
      visibility: run.visibility,
      query: body.message,
    });

    const result = await rt.orchestrator.executeRun({
      run,
      requester_role: member.role,
      userRequest: body.message,
      contextCandidates: { candidates, explicitReferences: [] },
      requestedToolCalls: body.tool_calls ?? [],
      // §40 claim — validated + authoritative-resolved inside the orchestrator.
      private_conversation_id: body.private_conversation_id ?? null,
    });
    // truncated=true ⇒ a HIGH-risk action awaits approval (WAITING_APPROVAL).
    return c.json(result, 202);
  });

  app.get("/api/v1/ai/runs/:runId", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const rt = getAiRuntime(c.env, services);
    const run = await requireRun(rt.runs, c.req.param("runId"));
    await services.membership.requireMember(run.group_id, user.user_id);
    return c.json(run);
  });

  app.post("/api/v1/ai/runs/:runId/cancel", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const rt = getAiRuntime(c.env, services);
    const run = await requireRun(rt.runs, c.req.param("runId"));
    const { member } = await services.membership.requireMember(run.group_id, user.user_id);
    // §120: the requester cancels their own run; OWNER/ADMIN may cancel any.
    if (
      run.requester_user_id !== user.user_id &&
      member.role !== "OWNER" &&
      member.role !== "ADMIN"
    ) {
      throw new AppError(
        "GROUP_PERMISSION_DENIED",
        "Only the requester or an Owner/Admin can cancel a run.",
      );
    }
    await rt.orchestrator.cancel(run.id);
    return c.json({ ok: true, run_id: run.id, status: "CANCELLED" });
  });

  return app;
}

async function requireRun(runs: { findById(id: string): Promise<AiRun | null> }, runId: string): Promise<AiRun> {
  const run = await runs.findById(runId);
  if (!run) throw new AppError("NOT_FOUND", "AI run not found.");
  return run;
}

/** §92/§63: BYOK presence lifts the application-pool exhaustion gate. */
async function anyByokEnabled(db: import("@supabase/supabase-js").SupabaseClient, groupId: string): Promise<boolean> {
  const { data, error } = await db
    .from("ai_provider_configs")
    .select("id")
    .eq("group_id", groupId)
    .eq("kind", "BYOK")
    .eq("enabled", true)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}
