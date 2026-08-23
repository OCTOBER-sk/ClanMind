import { describe, expect, it } from "vitest";
import {
  ApprovalEngine,
  assertBranchSafety,
  buildDiffPreview,
  canonicalize,
  githubActionWithStatus,
  hashPayload,
  validateMergePayload,
  verifyWebhookSignature,
  WebhookProcessor,
  type ActionRepository,
  type AiAction,
  type AiActionApproval,
} from "../src/approval/approval-engine";

function repo() {
  const actions: AiAction[] = [];
  const approvals: AiActionApproval[] = [];
  const persisted: { deliveryId: string; groupId: string | null }[] = [];
  const r: ActionRepository = {
    async insert(input) {
      const action: AiAction = {
        ...input,
        payload_version: input.payload_version ?? 1,
        status: input.status ?? "WAITING_APPROVAL",
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      actions.push(action);
      return action;
    },
    async findById(id) {
      return actions.find((a) => a.id === id) ?? null;
    },
    async setStatus(id, status) {
      const a = actions.find((x) => x.id === id);
      if (a) a.status = status;
    },
    async findApproval(actionId) {
      return approvals.find((p) => p.action_id === actionId) ?? null;
    },
    async insertApproval(input) {
      const approval: AiActionApproval = { ...input, id: crypto.randomUUID(), approved_at: new Date().toISOString() };
      approvals.push(approval);
      return approval;
    },
    async completeApproval(actionId, result) {
      const p = approvals.find((x) => x.action_id === actionId);
      if (p) {
        p.execution_result = result;
        p.executed_at = new Date().toISOString();
      }
    },
  };
  return { actions, approvals, persisted, r };
}

async function proposePr(engine: ApprovalEngine, r: ActionRepository) {
  return engine.propose({
    group_id: "g1",
    project_id: "p1",
    ai_run_id: null,
    initiated_by_user_id: "u1",
    action_kind: "github.create_pr",
    risk_level: "HIGH",
    payload: { branch: "feat/auth", files: ["auth.ts"], base_sha: "abc" },
    requires_approval: true,
  });
}

describe("§78A payload hashing", () => {
  it("canonicalization is key-order independent", async () => {
    expect(canonicalize({ a: 1, b: [2, { c: 3 }] })).toBe(canonicalize({ b: [2, { c: 3 }], a: 1 }));
    expect(await hashPayload({ x: 1, y: 2 })).toBe(await hashPayload({ y: 2, x: 1 }));
    expect(await hashPayload({ x: 1 })).not.toBe(await hashPayload({ x: 2 }));
  });
});

describe("§78A/§90 approval binding", () => {
  it("approval captures the displayed hash; execution verifies it", async () => {
    const { r, actions: actionRows } = repo();
    const engine = new ApprovalEngine(r);
    const action = await proposePr(engine, r);

    const approval = await engine.approve({
      action_id: action.id,
      approver_user_id: "u2",
      approver_role: "ADMIN",
      displayed_payload_hash: action.payload_hash,
      displayed_payload_version: action.payload_version,
    });
    expect(approval.approved_payload_hash).toBe(action.payload_hash);

    const begun = await engine.beginExecution(action.id);
    expect(begun.status).toBe("EXECUTING");
    await engine.complete(action.id, { pr_number: 17 });
    expect(actionRows.find((a) => a.id === action.id)?.status).toBe("SUCCEEDED");
  });

  it("a stale displayed hash is refused — the card must re-fetch (§164A.2)", async () => {
    const { r, actions: actionRows } = repo();
    const engine = new ApprovalEngine(r);
    const action = await proposePr(engine, r);
    await expect(
      engine.approve({
        action_id: action.id,
        approver_user_id: "u2",
        approver_role: "ADMIN",
        displayed_payload_hash: "0".repeat(64),
        displayed_payload_version: 1,
      }),
    ).rejects.toMatchObject({ code: "ACTION_EXPIRED" });
  });

  it("a mutated payload after approval expires the action (§78A.1 confused deputy)", async () => {
    const { r, actions: actionRows } = repo();
    const engine = new ApprovalEngine(r);
    const action = await proposePr(engine, r);
    await engine.approve({
      action_id: action.id,
      approver_user_id: "u2",
      approver_role: "OWNER",
      displayed_payload_hash: action.payload_hash,
      displayed_payload_version: action.payload_version,
    });
    // Server-side mutation between approval and execution:
    const stored = actionRows.find((a) => a.id === action.id)!;
    stored.payload = { ...stored.payload, files: ["auth.ts", "backdoor.sh"] };
    stored.payload_hash = await hashPayload(stored.payload);
    stored.payload_version += 1;

    await expect(engine.beginExecution(action.id)).rejects.toMatchObject({
      code: "ACTION_EXPIRED",
    });
    expect(stored.status).toBe("EXPIRED");
  });

  it("MEMBERs cannot approve HIGH-risk actions (§2.6/§56)", async () => {
    const { r, actions: actionRows } = repo();
    const engine = new ApprovalEngine(r);
    const action = await proposePr(engine, r);
    await expect(
      engine.approve({
        action_id: action.id,
        approver_user_id: "u3",
        approver_role: "MEMBER",
        displayed_payload_hash: action.payload_hash,
        displayed_payload_version: action.payload_version,
      }),
    ).rejects.toMatchObject({ code: "GROUP_PERMISSION_DENIED" });
  });

  it("expired actions require a fresh proposal (§117 expiry)", async () => {
    const { r, actions: actionRows } = repo();
    const engine = new ApprovalEngine(r);
    const action = await engine.propose({
      group_id: "g1",
      project_id: null,
      ai_run_id: null,
      initiated_by_user_id: "u1",
      action_kind: "artifact.bulk_delete",
      risk_level: "MEDIUM",
      payload: { ids: [1, 2, 3] },
      requires_approval: true,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(
      engine.approve({
        action_id: action.id,
        approver_user_id: "u2",
        approver_role: "ADMIN",
        displayed_payload_hash: action.payload_hash,
        displayed_payload_version: 1,
      }),
    ).rejects.toMatchObject({ code: "ACTION_EXPIRED" });
    expect(actionRows.find((a) => a.id === action.id)?.status).toBe("EXPIRED");
  });

  it("unapproved actions never execute", async () => {
    const { r, actions: actionRows } = repo();
    const engine = new ApprovalEngine(r);
    const action = await proposePr(engine, r);
    await expect(engine.beginExecution(action.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("github_actions status reads through the ai_actions join (§78)", () => {
    const aiAction: AiAction = {
      id: "aa1",
      group_id: "g1",
      project_id: null,
      ai_run_id: null,
      initiated_by_user_id: null,
      action_kind: "github.create_pr",
      risk_level: "HIGH",
      payload: { branch: "x" },
      payload_hash: "h",
      payload_version: 1,
      status: "WAITING_APPROVAL",
      requires_approval: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: null,
    };
    const joined = githubActionWithStatus(
      { id: "ga1", ai_action_id: "aa1", branch_name: "feat/x" },
      aiAction,
    );
    expect(joined.status).toBe("WAITING_APPROVAL");
    expect(joined.risk_level).toBe("HIGH");
    expect(joined.payload).toEqual({ branch: "x" });
  });
});

describe("§139-§141 GitHub safety", () => {
  it("the default branch is protected", () => {
    expect(() => assertBranchSafety({ branch_name: "main", default_branch: "main" })).toThrowError();
    expect(() => assertBranchSafety({ branch_name: "feat/x", default_branch: "main" })).not.toThrow();
    expect(() => assertBranchSafety({ branch_name: "  ", default_branch: null })).toThrowError();
  });

  it("diff previews carry exact files + SHAs (§140)", () => {
    const preview = buildDiffPreview({
      changed_files: [
        { path: "a.ts", additions: 10, deletions: 2 },
        { path: "b.ts", additions: 1, deletions: 0 },
      ],
      branch_name: "feat/x",
      base_sha: "b1",
      target_sha: "t1",
    });
    expect(preview.additions).toBe(11);
    expect(preview.deletions).toBe(2);
    expect(preview.base_sha).toBe("b1");
  });

  it("merge requires current SHAs and APPROVED status (§141)", () => {
    const base = {
      id: "a1",
      group_id: "g1",
      project_id: null,
      ai_run_id: null,
      initiated_by_user_id: null,
      action_kind: "github.merge_pr",
      risk_level: "CRITICAL",
      payload: { base_sha: "old", head_sha: "h1" },
      payload_hash: "h",
      payload_version: 1,
      requires_approval: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: null,
      status: "APPROVED",
    } satisfies AiAction;
    expect(validateMergePayload({ action: base, current_base_sha: "new", current_head_sha: "h1" })).toEqual({
      ok: false,
      reason: "base_sha_changed",
    });
    expect(validateMergePayload({ action: base, current_base_sha: "old", current_head_sha: "h1" })).toEqual({ ok: true });
    expect(
      validateMergePayload({ action: { ...base, status: "WAITING_APPROVAL" }, current_base_sha: "old", current_head_sha: "h1" }),
    ).toEqual({ ok: false, reason: "status_WAITING_APPROVAL" });
  });
});

describe("§80 webhooks", () => {
  it("verifies HMAC signatures", async () => {
    const secret = "whsec";
    const body = '{"action":"opened"}';
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(await verifyWebhookSignature(body, `sha256=${hex}`, secret)).toBe(true);
    expect(await verifyWebhookSignature(body, `sha256=${hex}`, "wrong")).toBe(false);
    expect(await verifyWebhookSignature(body + "x", `sha256=${hex}`, secret)).toBe(false);
  });

  it("dedupes deliveries, maps installations to groups, rejects unknown ones", async () => {
    const { persisted, r } = repo();
    const processor = new WebhookProcessor(
      async (installationId) => (installationId === 42 ? "g1" : null),
      async (delivery, groupId) => {
        persisted.push({ deliveryId: delivery.deliveryId, groupId });
      },
    );
    const delivery = {
      deliveryId: "d-1",
      eventType: "pull_request",
      installationId: 42,
      payload: { action: "opened" },
    };
    const first = await processor.process(delivery, async () => true);
    expect(first.accepted).toBe(true);
    expect(first.group_id).toBe("g1");

    const dup = await processor.process(delivery, async () => true);
    expect(dup.accepted).toBe(false);

    await expect(
      processor.process(
        { deliveryId: "d-2", eventType: "push", installationId: 999, payload: {} },
        async () => true,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      processor.process(
        { deliveryId: "d-3", eventType: "push", installationId: 42, payload: {} },
        async () => false,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    void r;
  });
});
