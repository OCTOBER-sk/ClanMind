import { describe, expect, it } from "vitest";
import type { ModelEvent, ModelProviderAdapter } from "@clanmind/ai-providers";
import { AppError } from "@clanmind/shared";
import { AiOrchestrator, sanitizeToolOutput } from "../src/ai/orchestrator";
import {
  AiAgentService,
  ContextEngine,
  MembershipService,
  NOOP_OUTBOX,
  RunLifecycle,
  ToolRegistry,
  UsageService,
  type AiAgent,
  type AiAgentRepository,
  type AiRun,
  type AiRunRepository,
  type GroupRepository,
  type MembershipRepository,
  type UsageRepository,
} from "../src/index";
import { NOOP_REALTIME } from "../src/index";

const U1 = "00000000-0000-4000-8000-000000000001";
const G1 = "00000000-0000-4000-8000-0000000000g1".replace("g1", "001");

function makeHarness(overrides: {
  adapter?: ModelProviderAdapter;
  approval?: import("../src/ai/orchestrator").ApprovalGate["requestApproval"];
  quotaUsed?: number;
}) {
  const runs: AiRun[] = [];
  const runRepo: AiRunRepository = {
    async insert(input) {
      const run: AiRun = {
        ...input,
        id: crypto.randomUUID(),
        provider_config_id: null,
        status: "QUEUED",
        started_at: new Date().toISOString(),
        completed_at: null,
        failure_code: null,
        usage_json: null,
      };
      runs.push(run);
      return run;
    },
    async findById(id) {
      return runs.find((r) => r.id === id) ?? null;
    },
    async setStatus(id, status, extra) {
      const run = runs.find((r) => r.id === id);
      if (run) {
        run.status = status;
        if (extra?.usage_json) run.usage_json = extra.usage_json;
      }
    },
    async listByGroup() {
      return [];
    },
  };

  const groupRepo: GroupRepository = {
    async insert(input) {
      return {
        id: input.owner_user_id,
        name: input.name,
        description: null,
        avatar_object_id: null,
        owner_user_id: input.owner_user_id,
        status: "ACTIVE",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
    },
    async findById(id) {
      return {
        id,
        name: "G",
        description: null,
        avatar_object_id: null,
        owner_user_id: U1,
        status: "ACTIVE",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
    },
    async update() {
      return null;
    },
    async setStatus() {
      return null;
    },
    async listForUser() {
      return [];
    },
  };
  const memberRepo: MembershipRepository = {
    async insert(input) {
      return {
        ...input,
        joined_at: new Date().toISOString(),
        removed_at: null,
        group_display_name: null,
        group_avatar_object_id: null,
      };
    },
    async findActive() {
      return {
        group_id: G1,
        user_id: U1,
        role: "OWNER",
        joined_at: new Date().toISOString(),
        removed_at: null,
        group_display_name: null,
        group_avatar_object_id: null,
      };
    },
    async listActive() {
      return [];
    },
    async countActive() {
      return 1;
    },
    async updateRole() {
      return null;
    },
    async markRemoved() {},
    async transferOwnership() {},
  };
  const agentRows: AiAgent[] = [];
  const agentRepo: AiAgentRepository = {
    async findByGroup(groupId) {
      return agentRows.find((a) => a.group_id === groupId) ?? null;
    },
    async insert(input) {
      const agent: AiAgent = {
        id: "odin-1",
        avatar_object_id: null,
        language: null,
        tone: null,
        personality_config: {},
        mode_policy: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...input,
      };
      agentRows.push(agent);
      return agent;
    },
  };

  const usageRepo: UsageRepository = {
    async record() {},
    async sumGroupUsage(groupId, category) {
      return category === "ai_requests" ? (overrides.quotaUsed ?? 0) : 0;
    },
    async quotaLimit() {
      return 10;
    },
  };

  const ledger: { recorded: unknown[]; completed: unknown[] } = { recorded: [], completed: [] };
  const enqueued: string[] = [];
  const publishedEvents: string[] = [];
  const persistedMessages: string[] = [];

  const adapter: ModelProviderAdapter =
    overrides.adapter ??
    ({
      provider: "test",
      async validateCredentials() {
        return { valid: true, models: [], error_code: null };
      },
      async listModels() {
        return [];
      },
      async *generate(): AsyncGenerator<ModelEvent> {
        yield { type: "text_delta", text: "Hello " };
        yield { type: "text_delta", text: "team" };
        yield { type: "usage", input_tokens: 10, output_tokens: 5 };
        yield { type: "completed", finish_reason: "stop" };
      },
    } as ModelProviderAdapter);

  const registry = new ToolRegistry();
  const orchestrator = new AiOrchestrator(
    new MembershipService(groupRepo, memberRepo),
    new AiAgentService(agentRepo),
    runRepo,
    new RunLifecycle(runRepo),
    new ContextEngine([{ label: "SYSTEM_SAFETY", content: "policy" }], 32_000),
    registry,
    { async resolveAdapter() { return adapter; } },
    {
      async resolveChain() {
        return [{ id: "r1", provider_config_id: "pc1", model_id: "m1" }];
      },
    },
    new UsageService(usageRepo, { ai_requests_per_period: 10, period_ms: 60_000 }),
    {
      async record(input) {
        ledger.recorded.push(input);
        return "tc-1";
      },
      async complete(id, status, output, errorCode) {
        ledger.completed.push({ id, status, output, errorCode });
      },
    },
    {
      async requestApproval(input) {
        if (overrides.approval) return overrides.approval(input);
        return { status: "APPROVED" as const };
      },
    },
    new Map(),
    {
      async persistAiMessage(input) {
        persistedMessages.push(input.body);
        return { id: "msg-ai-1" };
      },
    },
    {
      ...NOOP_REALTIME,
      async publish(input: { event_type: string }) {
        publishedEvents.push(input.event_type);
      },
    },
    NOOP_OUTBOX,
    {
      async enqueue(input) {
        enqueued.push(input.job_type);
      },
    },
    { tool_calls_per_run_max: 8, tool_total_time_per_run_seconds: 60, ai_context_token_budget: 32_000 },
  );

  return { orchestrator, runs, ledger, enqueued, publishedEvents, persistedMessages, registry };
}

describe("§115 orchestrator", () => {
  it("runs the full lifecycle and enqueues memory extraction", async () => {
    const h = makeHarness({});
    const run = await h.orchestrator.startRun({
      group_id: G1,
      requester_user_id: U1,
      project_id: null,
      mode: "ASSIST",
      visibility: "GROUP",
      input_message_id: null,
      private_conversation_id: null,
      byokConfigured: false,
    });
    const result = await h.orchestrator.executeRun({
      run,
      requester_role: "OWNER",
      userRequest: "hi",
      contextCandidates: { candidates: [], explicitReferences: [] },
      requestedToolCalls: [],
    });
    expect(result.response).toBe("Hello team");
    expect(h.runs[0]?.status).toBe("COMPLETED");
    expect(h.runs[0]?.usage_json).toEqual({ input_tokens: 10, output_tokens: 5 });
    expect(h.persistedMessages[0]).toBe("Hello team");
    expect(h.enqueued).toContain("memory.extraction");
    // Deltas stream over realtime; run start/completion go through the
    // durable outbox (§122/§124), not the low-latency port.
    expect(h.publishedEvents).toContain("ai.response.delta");
    expect(h.publishedEvents.every((e) => e === "ai.response.delta")).toBe(true);
  });

  it("throws the §94 exhaustion contract when quota is spent", async () => {
    const h = makeHarness({ quotaUsed: 10 });
    await expect(
      h.orchestrator.startRun({
        group_id: G1,
        requester_user_id: U1,
        project_id: null,
        mode: "ASSIST",
        visibility: "GROUP",
        input_message_id: null,
        private_conversation_id: null,
        byokConfigured: false,
      }),
    ).rejects.toMatchObject({ code: "APPLICATION_AI_QUOTA_EXHAUSTED" });
  });

  it("HIGH-risk tools pause the run awaiting approval (§117)", async () => {
    const h = makeHarness({
      approval: async () => ({ status: "WAITING_APPROVAL", action_id: "act-1" }),
    });
    h.registry.register({
      name: "github.create_branch",
      version: "1",
      description: "",
      input_schema: {},
      output_schema: {},
      risk_level: "HIGH",
      requires_approval: true,
      allowed_modes: ["ACT"],
      allowed_roles: ["OWNER", "ADMIN"],
      timeout_ms: 30_000,
      retry_policy: "on_transient",
    });
    const run = await h.orchestrator.startRun({
      group_id: G1,
      requester_user_id: U1,
      project_id: null,
      mode: "ACT",
      visibility: "GROUP",
      input_message_id: null,
      private_conversation_id: null,
      byokConfigured: false,
    });
    const result = await h.orchestrator.executeRun({
      run,
      requester_role: "OWNER",
      userRequest: "make a branch",
      contextCandidates: { candidates: [], explicitReferences: [] },
      requestedToolCalls: [{ tool_name: "github.create_branch", input: { name: "feat/x" } }],
    });
    expect(result.truncated).toBe(true);
    expect(h.runs[0]?.status).toBe("WAITING_TOOL");
  });

  it("denied approvals mark the tool call DENIED and continue", async () => {
    const h = makeHarness({ approval: async () => ({ status: "DENIED" }) });
    h.registry.register({
      name: "artifact.bulk_delete",
      version: "1",
      description: "",
      input_schema: {},
      output_schema: {},
      risk_level: "MEDIUM",
      requires_approval: true,
      allowed_modes: ["ACT"],
      allowed_roles: ["OWNER", "ADMIN"],
      timeout_ms: 30_000,
      retry_policy: "never",
    });
    const run = await h.orchestrator.startRun({
      group_id: G1,
      requester_user_id: U1,
      project_id: null,
      mode: "ACT",
      visibility: "GROUP",
      input_message_id: null,
      private_conversation_id: null,
      byokConfigured: false,
    });
    const result = await h.orchestrator.executeRun({
      run,
      requester_role: "OWNER",
      userRequest: "clean up",
      contextCandidates: { candidates: [], explicitReferences: [] },
      requestedToolCalls: [{ tool_name: "artifact.bulk_delete", input: { ids: [] } }],
    });
    expect(result.truncated).toBe(false);
    expect(h.ledger.completed).toContainEqual(
      expect.objectContaining({ status: "DENIED", errorCode: "approval_denied" }),
    );
  });

  it("sanitizes secrets out of tool output before model injection (§88)", () => {
    const cleaned = sanitizeToolOutput({
      note: "key sk-abcdefghijklmnop1234 leaked",
      token: "ghp_" + "a".repeat(30),
      count: 5,
    });
    expect(JSON.stringify(cleaned)).not.toContain("sk-abcdefghijklmnop1234");
    expect(JSON.stringify(cleaned)).not.toContain("ghp_");
    expect(cleaned.count).toBe(5);
  });
});
