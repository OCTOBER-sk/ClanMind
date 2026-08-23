import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "@clanmind/shared";
import {
  assertBranchSafety,
  buildDiffPreview,
  verifyWebhookSignature,
  WebhookProcessor,
  type AiAction,
} from "@clanmind/domain";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuthenticatedUser } from "../middleware/auth";
import { enforceRateLimit } from "../ai";
import type { GithubConnectionRow } from "../repositories/github.repo";

const connectBody = z.object({
  installation_id: z.number().int().positive(),
  owner_login: z.string().min(1).max(100),
  repo_name: z.string().min(1).max(200),
  default_branch: z.string().min(1).max(200).nullable().optional(),
  permission_mode: z.enum(["READ_ONLY", "READ_WRITE"]).optional(),
});

const proposeActionBody = z.object({
  action_type: z.enum(["create_branch", "apply_patch", "create_pr"]),
  branch_name: z.string().min(1).max(200),
  base_sha: z.string().min(1).max(80),
  head_sha: z.string().min(1).max(80),
  changed_files: z
    .array(
      z.object({
        path: z.string().min(1).max(400),
        additions: z.number().int().nonnegative(),
        deletions: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(100),
});

const approvalBody = z.object({
  displayed_payload_hash: z.string().min(8),
  displayed_payload_version: z.number().int().positive(),
});

/**
 * §113 GitHub endpoints + §80 webhook. Writes are always HIGH risk: they are
 * proposed with a diff preview and executed only after §78A-bound approval.
 */
export function githubRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.use("*", requireAuthenticatedUser);
  app.post("/api/v1/groups/:groupId/github/connect", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const groupId = c.req.param("groupId");
    await services.membership.requireRole(groupId, user.user_id, ["OWNER", "ADMIN"]);
    const parsed = connectBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid connection body.");
    const connection = await services.githubConnections.connect({
      group_id: groupId,
      installation_id: parsed.data.installation_id,
      owner_login: parsed.data.owner_login,
      repo_name: parsed.data.repo_name,
      default_branch: parsed.data.default_branch ?? null,
      permission_mode: parsed.data.permission_mode ?? "READ_ONLY",
    });
    await services.outbox.publish({
      event_type: "github.connected",
      aggregate_type: "github_connection",
      aggregate_id: connection.id,
      group_id: groupId,
      actor_id: user.user_id,
      payload: { repo_full_name: connection.repo_full_name },
    });
    return c.json(connection, 201);
  });

  app.get("/api/v1/groups/:groupId/github/status", async (c) => {
    const services = c.get("services");
    const groupId = c.req.param("groupId");
    await services.membership.requireMember(groupId, c.get("user").user_id);
    const connection = await services.githubConnections.findByGroup(groupId);
    return c.json({
      connected: !!connection && !connection.disconnected_at && connection.installation_id !== null,
      connection,
    });
  });

  app.post("/api/v1/groups/:groupId/github/disconnect", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const groupId = c.req.param("groupId");
    await services.membership.requireRole(groupId, user.user_id, ["OWNER", "ADMIN"]);
    // §142: invalidate the cached installation; keep history rows.
    await services.githubConnections.disconnect(groupId);
    await services.outbox.publish({
      event_type: "github.disconnected",
      aggregate_type: "github_connection",
      aggregate_id: groupId,
      group_id: groupId,
      actor_id: user.user_id,
      payload: {},
    });
    return c.json({ ok: true });
  });

  app.get("/api/v1/projects/:projectId/github/actions", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const project = await services.projects.get(c.req.param("projectId"), user.user_id);
    const items = await services.githubActions.listByProjectWithStatus(project.id);
    return c.json({ items });
  });

  app.post("/api/v1/projects/:projectId/github/actions", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const project = await services.projects.get(c.req.param("projectId"), user.user_id);
    const groupId = project.group_id;

    const connection = await services.githubConnections.findByGroup(groupId);
    if (!connection || !connection.installation_id || connection.disconnected_at) {
      throw new AppError("CONFLICT", "No GitHub repository is connected to this Group.");
    }

    const parsed = proposeActionBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid action body.");
    const body = parsed.data;

    // §139: the AI never writes the default branch.
    assertBranchSafety({ branch_name: body.branch_name, default_branch: connection.default_branch });
    // §140: the approval payload must show the exact diff.
    const preview = buildDiffPreview({
      changed_files: body.changed_files,
      branch_name: body.branch_name,
      base_sha: body.base_sha,
      target_sha: body.head_sha,
    });

    // §178 per-Group write-proposal cap.
    enforceRateLimit(`gh:${groupId}`, services.limits.github_actions_per_hour_per_group, 3_600_000);

    const action = await services.approvals.propose({
      group_id: groupId,
      project_id: project.id,
      ai_run_id: null,
      initiated_by_user_id: user.user_id,
      action_kind: `github.${body.action_type}`,
      risk_level: "HIGH",
      requires_approval: true,
      payload: {
        ...preview,
        repo_full_name: connection.repo_full_name,
        installation_id: connection.installation_id,
      },
    });
    const row = await services.githubActions.insert({
      ai_action_id: action.id,
      group_id: groupId,
      project_id: project.id,
      action_type: body.action_type,
      branch_name: body.branch_name,
      target_sha: body.head_sha,
      preview_json: preview,
    });
    await services.outbox.publish({
      event_type: "github.action.proposed",
      aggregate_type: "ai_action",
      aggregate_id: action.id,
      group_id: groupId,
      actor_id: user.user_id,
      payload: {
        action_id: action.id,
        github_action_id: row.id,
        action_kind: action.action_kind,
        payload_hash: action.payload_hash,
        payload_version: action.payload_version,
        preview,
      },
    });
    return c.json({ action, github_action: row }, 202);
  });

  app.post("/api/v1/github/actions/:actionId/approve", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const action = await requireAction(services, c.req.param("actionId"));
    const { member } = await services.membership.requireMember(action.group_id, user.user_id);
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      throw new AppError("GROUP_PERMISSION_DENIED", "Only Owners/Admins can approve GitHub writes.");
    }
    const parsed = approvalBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Approval binding fields required.");
    // §78A/§90: binds hash+version; the engine re-checks HIGH-risk roles.
    await services.approvals.approve({
      action_id: action.id,
      approver_user_id: user.user_id,
      approver_role: member.role,
      displayed_payload_hash: parsed.data.displayed_payload_hash,
      displayed_payload_version: parsed.data.displayed_payload_version,
    });
    const fresh = await requireAction(services, action.id);

    // Transparent execution state (§79): without App credentials the action
    // stays APPROVED for a later executor run — never silently dropped.
    const credsConfigured = !!(c.env.GITHUB_APP_ID && c.env.GITHUB_APP_PRIVATE_KEY);
    if (!credsConfigured) {
      return c.json({
        executed: false,
        reason: "github_credentials_not_configured",
        action: fresh,
      });
    }
    await services.approvals.beginExecution(action.id);
    try {
      // Real GitHub API execution ships behind the App credentials flow
      // (§189 Phase G stretch). Until that lands, an EXECUTING action fails
      // closed with an honest audit trail — never a fabricated success.
      await services.approvals.fail(action.id, "executor_not_implemented");
      return c.json({
        executed: false,
        reason: "executor_not_implemented",
        action: await requireAction(services, action.id),
      });
    } catch (error) {
      await services.approvals.fail(action.id, "execution_failed");
      throw error;
    }
  });

  app.post("/api/v1/github/actions/:actionId/reject", async (c) => {
    const services = c.get("services");
    const user = c.get("user");
    const action = await requireAction(services, c.req.param("actionId"));
    const { member } = await services.membership.requireMember(action.group_id, user.user_id);
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      throw new AppError("GROUP_PERMISSION_DENIED", "Only Owners/Admins can reject GitHub writes.");
    }
    await services.approvals.reject({ action_id: action.id, rejector_role: member.role });
    return c.json({ ok: true });
  });

  return app;
}

/**
 * §80 webhook endpoint. HMAC-signed by GitHub — never behind the JWT auth
 * gateway; verification happens inside the §80 pipeline below.
 */
export function githubWebhookRoutes(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

  app.post("/api/v1/webhooks/github", async (c) => {
    const services = c.get("services");
    const secret = c.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      return c.json(
        {
          error: {
            code: "NOT_CONFIGURED",
            message: "GitHub webhook secret is not configured.",
          },
        },
        503 as 503,
      );
    }
    const raw = await c.req.text();
    const signature = c.req.header("x-hub-signature-256") ?? "";
    const deliveryId = c.req.header("x-github-delivery");
    const eventType = c.req.header("x-github-event") ?? "unknown";
    if (!deliveryId) {
      throw new AppError("VALIDATION_FAILED", "x-github-delivery header is required.");
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new AppError("VALIDATION_FAILED", "Webhook body must be JSON.");
    }
    const installationId =
      typeof (payload["installation"] as Record<string, unknown> | undefined)?.["id"] === "number"
        ? ((payload["installation"] as Record<string, unknown>)["id"] as number)
        : null;

    // §80 pipeline steps 1–5 live in the domain processor; persistence goes to
    // the durable store first (dedupe), then the Group is attached.
    const processor = new WebhookProcessor<{
      deliveryId: string;
      eventType: string;
      installationId: number | null;
      payload: Record<string, unknown>;
    }>(
      async (installation) => {
        if (installation === null) return null;
        const conn: GithubConnectionRow | null = await services.githubConnections.findByInstallation(
          installation,
        );
        return conn?.group_id ?? null;
      },
      async (delivery, groupId) => {
        if (groupId) {
          await services.webhookEvents.attachGroup(delivery.deliveryId, groupId);
          await services.outbox.publish({
            event_type: "github.webhook.received",
            aggregate_type: "github_event",
            aggregate_id: delivery.deliveryId,
            group_id: groupId,
            actor_id: null,
            payload: {
              delivery_id: delivery.deliveryId,
              event_type: delivery.eventType,
            },
          });
        }
      },
      async (dupDeliveryId) =>
        services.webhookEvents.beginDelivery({
          delivery_id: dupDeliveryId,
          event_type: eventType,
          installation_id: installationId,
          payload,
        }),
    );

    const result = await processor.process(
      { deliveryId, eventType, installationId, payload },
      async () => verifyWebhookSignature(raw, signature, secret),
    );
    return c.json(result, result.accepted ? 202 : 200);
  });

  return app;
}

async function requireAction(
  services: import("../services").AppServices,
  id: string,
): Promise<AiAction> {
  const action = await services.actions.findById(id);
  if (!action) throw new AppError("NOT_FOUND", "Action not found.");
  return action;
}
