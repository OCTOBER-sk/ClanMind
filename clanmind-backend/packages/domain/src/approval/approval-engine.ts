import type { RiskLevel } from "@clanmind/contracts";
import { AppError } from "@clanmind/shared";

/** §78A */
export interface AiAction {
  id: string;
  group_id: string;
  project_id: string | null;
  ai_run_id: string | null;
  initiated_by_user_id: string | null;
  action_kind: string;
  risk_level: RiskLevel;
  payload: Record<string, unknown>;
  payload_hash: string;
  payload_version: number;
  status:
    | "PROPOSED"
    | "WAITING_APPROVAL"
    | "APPROVED"
    | "EXECUTING"
    | "SUCCEEDED"
    | "FAILED"
    | "REJECTED"
    | "EXPIRED";
  requires_approval: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface AiActionApproval {
  id: string;
  action_id: string;
  approved_by: string;
  approver_role: string;
  approved_payload_hash: string;
  approved_payload_version: number;
  approved_at: string;
  execution_result: Record<string, unknown> | null;
  executed_at: string | null;
}

export interface ActionRepository {
  insert(input: Omit<AiAction, "id" | "created_at" | "updated_at" | "status"> & { status?: AiAction["status"] }): Promise<AiAction>;
  findById(id: string): Promise<AiAction | null>;
  setStatus(id: string, status: AiAction["status"], bumpVersion?: boolean): Promise<void>;
  findApproval(actionId: string): Promise<AiActionApproval | null>;
  insertApproval(input: Omit<AiActionApproval, "id" | "approved_at">): Promise<AiActionApproval>;
  completeApproval(actionId: string, result: Record<string, unknown>): Promise<void>;
  /** §78A lifecycle: transition stale WAITING_APPROVAL/APPROVED rows past
   * their expires_at to EXPIRED. Returns the number of rows expired. */
  expireStale?(nowIso: string): Promise<number>;
}

/** Deterministic JSON canonicalization for payload hashing (§78A). */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

export async function hashPayload(payload: Record<string, unknown>): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalize(payload)),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * §78A Generalized Approval Engine. Every risky AI action — GitHub writes,
 * bulk artifact deletion, task reassignment, memory purge — routes through
 * this single lifecycle with payload-hash binding. An `approved=true`
 * boolean from a client is never sufficient (Correction 5): the approval row
 * captures the exact hash shown to the human, and execution re-verifies it.
 */
/**
 * Default approval window: an unapproved action cannot sit in
 * WAITING_APPROVAL forever — §78A expiry requires a bounded lifetime. 24h is
 * the v1 default (config may override via expiresAt).
 */
export const DEFAULT_ACTION_TTL_MS = 24 * 60 * 60 * 1000;

export class ApprovalEngine {
  constructor(private readonly actions: ActionRepository) {}

  async propose(input: {
    group_id: string;
    project_id: string | null;
    ai_run_id: string | null;
    initiated_by_user_id: string | null;
    action_kind: string;
    risk_level: RiskLevel;
    payload: Record<string, unknown>;
    requires_approval: boolean;
    expiresAt?: string | null;
  }): Promise<AiAction> {
    const payloadHash = await hashPayload(input.payload);
    // Bounded lifetime by default so approvals never execute stale payloads.
    const expiresAt =
      input.expiresAt ??
      (input.requires_approval
        ? new Date(Date.now() + DEFAULT_ACTION_TTL_MS).toISOString()
        : null);
    return this.actions.insert({
      ...input,
      payload_hash: payloadHash,
      payload_version: 1,
      status: input.requires_approval ? "WAITING_APPROVAL" : "APPROVED",
      expires_at: expiresAt,
    });
  }

  /**
   * §78A lifecycle sweeper: lazily expire everything past its window. Called
   * from the cron job runner; safe to run concurrently.
   */
  async expireStaleActions(now = new Date()): Promise<number> {
    if (!this.actions.expireStale) return 0;
    return this.actions.expireStale(now.toISOString());
  }

  /**
   * Approval binds to action id + payload hash + version + approver + role +
   * timestamp (§90). The client submits the hash/version it displayed
   * (frontend §164A.2) — never a boolean.
   */
  async approve(input: {
    action_id: string;
    approver_user_id: string;
    approver_role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
    displayed_payload_hash: string;
    displayed_payload_version: number;
  }): Promise<AiActionApproval> {
    const action = await this.actions.findById(input.action_id);
    if (!action) throw new AppError("NOT_FOUND", "Action not found.");
    if (action.status !== "WAITING_APPROVAL") {
      throw new AppError("CONFLICT", `Action is ${action.status}, not awaiting approval.`);
    }
    if (this.expired(action)) {
      await this.actions.setStatus(action.id, "EXPIRED");
      throw new AppError("ACTION_EXPIRED", "This action expired; a fresh proposal is required.");
    }
    // §164A.2: the approval must reference the exact payload the human saw.
    if (
      action.payload_hash !== input.displayed_payload_hash ||
      action.payload_version !== input.displayed_payload_version
    ) {
      throw new AppError(
        "ACTION_EXPIRED",
        "The action changed since it was displayed. Review the latest version.",
      );
    }
    // §56/§2.6: HIGH/CRITICAL approvals need OWNER or ADMIN.
    if (
      (action.risk_level === "HIGH" || action.risk_level === "CRITICAL") &&
      !(input.approver_role === "OWNER" || input.approver_role === "ADMIN")
    ) {
      throw new AppError("GROUP_PERMISSION_DENIED", "Only Owners and Admins can approve this.");
    }
    const approval = await this.actions.insertApproval({
      action_id: action.id,
      approved_by: input.approver_user_id,
      approver_role: input.approver_role,
      approved_payload_hash: action.payload_hash,
      approved_payload_version: action.payload_version,
      execution_result: null,
      executed_at: null,
    });
    await this.actions.setStatus(action.id, "APPROVED");
    return approval;
  }

  async reject(input: { action_id: string; rejector_role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST" }): Promise<void> {
    const action = await this.actions.findById(input.action_id);
    if (!action) throw new AppError("NOT_FOUND", "Action not found.");
    if (action.status !== "WAITING_APPROVAL" && action.status !== "APPROVED") {
      throw new AppError("CONFLICT", `Action is ${action.status}.`);
    }
    if (
      (action.risk_level === "HIGH" || action.risk_level === "CRITICAL") &&
      !(input.rejector_role === "OWNER" || input.rejector_role === "ADMIN")
    ) {
      throw new AppError("GROUP_PERMISSION_DENIED", "Only Owners and Admins can reject this.");
    }
    await this.actions.setStatus(action.id, "REJECTED");
  }

  /**
   * §78A.1 integrity gate: before executing, the CURRENT payload hash and
   * version must equal what the human approved. Any mutation ⇒ refuse and
   * EXPIRE — the confused-deputy defense (§90).
   */
  async beginExecution(actionId: string): Promise<AiAction> {
    const action = await this.actions.findById(actionId);
    if (!action) throw new AppError("NOT_FOUND", "Action not found.");
    if (action.status !== "APPROVED") {
      throw new AppError("CONFLICT", `Action is ${action.status}; only APPROVED actions execute.`);
    }
    if (this.expired(action)) {
      await this.actions.setStatus(action.id, "EXPIRED");
      throw new AppError("ACTION_EXPIRED", "This action expired before execution.");
    }
    const approval = await this.actions.findApproval(actionId);
    if (action.requires_approval) {
      if (!approval) {
        throw new AppError("CONFLICT", "No approval bound to this action.");
      }
      if (
        action.payload_hash !== approval.approved_payload_hash ||
        action.payload_version !== approval.approved_payload_version
      ) {
        await this.actions.setStatus(action.id, "EXPIRED");
        throw new AppError(
          "ACTION_EXPIRED",
          "Payload changed after approval; a fresh proposal and approval are required.",
        );
      }
    }
    await this.actions.setStatus(actionId, "EXECUTING");
    return action;
  }

  async complete(actionId: string, result: Record<string, unknown>): Promise<void> {
    await this.actions.setStatus(actionId, "SUCCEEDED");
    await this.actions.completeApproval(actionId, result);
  }

  async fail(actionId: string, _errorCode: string): Promise<void> {
    await this.actions.setStatus(actionId, "FAILED");
  }

  /** Resumed executions must reverify the hash (§117). */
  expired(action: AiAction, now = Date.now()): boolean {
    return action.expires_at !== null && new Date(action.expires_at).getTime() <= now;
  }
}

/** §78: GitHub action status is read via join through ai_action_id. */
export function githubActionWithStatus<T extends { ai_action_id: string }>(
  githubAction: T,
  aiAction: AiAction,
): T & { status: AiAction["status"]; risk_level: RiskLevel; payload: Record<string, unknown> } {
  return {
    ...githubAction,
    status: aiAction.status,
    risk_level: aiAction.risk_level,
    payload: aiAction.payload,
  };
}

/** §139: the AI never writes to the default branch. */
export function assertBranchSafety(input: {
  branch_name: string;
  default_branch: string | null;
}): void {
  const branch = input.branch_name.trim();
  if (branch.length === 0) {
    throw new AppError("VALIDATION_FAILED", "Branch name is required.");
  }
  if (input.default_branch && branch === input.default_branch) {
    throw new AppError(
      "GROUP_PERMISSION_DENIED",
      "The default branch is protected; AI work flows through a branch + PR.",
    );
  }
}

/**
 * §140/§141: approval payloads must reference the exact diff, and merges
 * additionally require current base/head SHAs and an unexpired action.
 */
export function buildDiffPreview(input: {
  changed_files: { path: string; additions: number; deletions: number }[];
  branch_name: string;
  base_sha: string;
  target_sha: string;
}): Record<string, unknown> {
  return {
    changed_files: input.changed_files,
    additions: input.changed_files.reduce((s, f) => s + f.additions, 0),
    deletions: input.changed_files.reduce((s, f) => s + f.deletions, 0),
    branch: input.branch_name,
    base_sha: input.base_sha,
    target_sha: input.target_sha,
  };
}

export function validateMergePayload(input: {
  action: AiAction;
  current_base_sha: string | null;
  current_head_sha: string | null;
}): { ok: true } | { ok: false; reason: string } {
  const payloadBase = input.action.payload["base_sha"];
  const payloadHead = input.action.payload["head_sha"];
  if (typeof payloadBase === "string" && input.current_base_sha && payloadBase !== input.current_base_sha) {
    return { ok: false, reason: "base_sha_changed" };
  }
  if (typeof payloadHead === "string" && input.current_head_sha && payloadHead !== input.current_head_sha) {
    return { ok: false, reason: "head_sha_changed" };
  }
  if (input.action.status !== "APPROVED") {
    return { ok: false, reason: `status_${input.action.status}` };
  }
  return { ok: true };
}

/**
 * §80 webhook pipeline: verify signature → dedupe delivery id → authorize
 * installation → map to Group → persist → emit normalized event.
 */
export interface WebhookEventRow {
  delivery_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  installation_id: number | null;
}

/** GitHub HMAC-SHA256 webhook signature verification (x-hub-signature-256). */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const expected = signatureHeader.replace("sha256=", "");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === expected;
}

export class WebhookProcessor<TDelivery extends { deliveryId: string; eventType: string; installationId: number | null; payload: Record<string, unknown> }> {
  private readonly seen = new Set<string>();

  constructor(
    private readonly resolveGroupId: (installationId: number | null) => Promise<string | null>,
    private readonly persist: (delivery: TDelivery, groupId: string | null) => Promise<void>,
    /** §80 step 2 durable dedupe — e.g. insert-on-conflict into
     * github_webhook_events. When omitted, an in-process set is used, which
     * is only correct within a single isolate lifetime. */
    private readonly isDuplicate?: (deliveryId: string) => Promise<boolean>,
  ) {}

  /** Returns false for duplicates (§80 step 2: deduplicate event ID). */
  async process(
    delivery: TDelivery,
    verify: () => Promise<boolean>,
  ): Promise<{ accepted: boolean; group_id: string | null }> {
    if (!(await verify())) {
      throw new AppError("FORBIDDEN", "Webhook signature verification failed.");
    }
    if (this.isDuplicate) {
      if (await this.isDuplicate(delivery.deliveryId)) {
        return { accepted: false, group_id: null };
      }
    } else if (this.seen.has(delivery.deliveryId)) {
      return { accepted: false, group_id: null };
    } else {
      this.seen.add(delivery.deliveryId);
    }
    // §80 step 3: authorize the connected installation.
    const groupId = await this.resolveGroupId(delivery.installationId);
    if (delivery.installationId !== null && !groupId) {
      throw new AppError("NOT_FOUND", "No Group is connected to this installation.");
    }
    await this.persist(delivery, groupId);
    return { accepted: true, group_id: groupId };
  }
}
