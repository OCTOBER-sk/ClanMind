import { describe, expect, it } from "vitest";
import {
  ApprovalEngine,
  type ActionRepository,
  type AiAction,
  type AiActionApproval,
} from "@clanmind/domain";
import { EnvelopeSecretStore } from "../src/repositories/ai-runtime.repo";
import { ProviderConfigService, type ProviderConfigRepository } from "@clanmind/domain";

const approvals: AiActionApproval[] = [];

function memoryActionRepo(): ActionRepository & { rows: AiAction[] } {
  const rows: AiAction[] = [];
  return {
    rows,
    async insert(input) {
      const now = new Date().toISOString();
      const action: AiAction = {
        ...input,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
        status: input.status ?? "PROPOSED",
      };
      rows.push(action);
      return action;
    },
    async findById(id) {
      return rows.find((a) => a.id === id) ?? null;
    },
    async setStatus(id, status) {
      const a = rows.find((x) => x.id === id);
      if (a) {
        a.status = status;
        a.updated_at = new Date().toISOString();
      }
    },
    async findApproval(actionId) {
      return approvals.find((ap) => ap.action_id === actionId) ?? null;
    },
    async insertApproval(input) {
      const approval: AiActionApproval = {
        ...input,
        id: crypto.randomUUID(),
        approved_at: new Date().toISOString(),
      };
      approvals.push(approval);
      return approval;
    },
    async completeApproval(actionId, result) {
      const approval = approvals.find((ap) => ap.action_id === actionId);
      if (approval) {
        approval.execution_result = result;
        approval.executed_at = new Date().toISOString();
      }
    },
  };
}

describe("§78A/§90 approval lifecycle", () => {
  async function propose(engine: ApprovalEngine, repo: ReturnType<typeof memoryActionRepo>) {
    return engine.propose({
      group_id: "g1",
      project_id: null,
      ai_run_id: null,
      initiated_by_user_id: "u1",
      action_kind: "github.create_pr",
      risk_level: "HIGH",
      requires_approval: true,
      payload: { branch: "feat/x", additions: 12 },
    });
  }

  it("approve binds hash+version; beginExecution re-verifies; complete succeeds", async () => {
    const repo = memoryActionRepo();
    const engine = new ApprovalEngine(repo);
    const action = await propose(engine, repo);

    // Wrong displayed hash is refused (Correction 5).
    await expect(
      engine.approve({
        action_id: action.id,
        approver_user_id: "owner",
        approver_role: "OWNER",
        displayed_payload_hash: "0".repeat(64),
        displayed_payload_version: action.payload_version,
      }),
    ).rejects.toMatchObject({ code: "ACTION_EXPIRED" });

    // Correct binding approves.
    const approval = await engine.approve({
      action_id: action.id,
      approver_user_id: "owner",
      approver_role: "OWNER",
      displayed_payload_hash: action.payload_hash,
      displayed_payload_version: action.payload_version,
    });
    expect(approval.approved_payload_hash).toBe(action.payload_hash);

    // Integrity gate passes and execution completes.
    const executing = await engine.beginExecution(action.id);
    expect(executing.status).toBe("EXECUTING");
    await engine.complete(action.id, { pr: 21 });
    const done = await repo.findById(action.id);
    expect(done?.status).toBe("SUCCEEDED");
  });

  it("reject sets REJECTED; MEMBER cannot approve HIGH risk", async () => {
    const repo = memoryActionRepo();
    const engine = new ApprovalEngine(repo);
    const action = await propose(engine, repo);

    await expect(
      engine.approve({
        action_id: action.id,
        approver_user_id: "member",
        approver_role: "MEMBER",
        displayed_payload_hash: action.payload_hash,
        displayed_payload_version: action.payload_version,
      }),
    ).rejects.toMatchObject({ code: "GROUP_PERMISSION_DENIED" });

    await engine.reject({ action_id: action.id, rejector_role: "ADMIN" });
    expect((await repo.findById(action.id))?.status).toBe("REJECTED");
  });

  it("expired actions cannot be approved or executed", async () => {
    const repo = memoryActionRepo();
    const engine = new ApprovalEngine(repo);
    const action = await engine.propose({
      group_id: "g1",
      project_id: null,
      ai_run_id: null,
      initiated_by_user_id: "u1",
      action_kind: "github.apply_patch",
      risk_level: "HIGH",
      requires_approval: true,
      payload: { patch: true },
      expiresAt: new Date(Date.now() - 1000).toISOString(), // already stale
    });

    await expect(
      engine.approve({
        action_id: action.id,
        approver_user_id: "owner",
        approver_role: "OWNER",
        displayed_payload_hash: action.payload_hash,
        displayed_payload_version: action.payload_version,
      }),
    ).rejects.toMatchObject({ code: "ACTION_EXPIRED" });
    expect((await repo.findById(action.id))?.status).toBe("EXPIRED");

    await expect(engine.beginExecution(action.id)).rejects.toMatchObject({
      code: "CONFLICT", // status EXPIRED ≠ APPROVED
    });
  });
});

describe("§63/§63.2 BYOK secret handling", () => {
  it("validate-and-store returns last4 only and never the raw key; envelope round-trips", async () => {
    const rawKey = "sk-super-secret-0000000000009999";
    const storedConfigs: unknown[] = [];
    const configRepo: ProviderConfigRepository = {
      async insert(input) {
        const row = {
          ...input,
          id: crypto.randomUUID(),
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        storedConfigs.push(row);
        return row as never;
      },
      async findById() {
        return null;
      },
      async listByGroup() {
        return [];
      },
      async setEnabled() {},
    };

    const secrets = new EnvelopeSecretStore("test-master");
    const service = new ProviderConfigService(configRepo, secrets, async () => ({
      valid: true,
      models: ["gpt-test"],
    }));
    const { config, models } = await service.validateAndStore({
      group_id: "g1",
      provider: "openai",
      api_key: rawKey,
      created_by: "owner",
    });

    // §107: response carries sanitized metadata only.
    const rendered = JSON.stringify({ config, models });
    expect(rendered).not.toContain(rawKey);
    expect(config.key_last4).toBe(rawKey.slice(-4));
    expect(rendered).not.toContain(rawKey.slice(0, -4));

    // §63.2: ciphertext at rest decrypts only under the same master key.
    expect(config.credential_ref?.startsWith("enc1:")).toBe(true);
    const decrypted = await secrets.getSecret(config.credential_ref!.replace(/^secret:/, ""));
    expect(decrypted).toBe(rawKey);

    // A different master secret cannot recover the key.
    const other = new EnvelopeSecretStore("other-master");
    expect(await other.getSecret(config.credential_ref!)).toBeNull();
  });
});
