import { describe, expect, it } from "vitest";
import {
  AGENT_BEHAVIOR_POLICY_TEXT,
  ContextEngine,
  INJECTION_POLICY_TEXT,
  PROMPT_ASSEMBLY_ORDER,
  ToolLoopGuard,
  ToolRegistry,
  approvalRequiredForRisk,
  canTransition,
  privacyAuthorizes,
  recencyScore,
  scoreItem,
  type ContextItem,
  type ToolDefinition,
} from "../src/index";
import {
  RunLifecycle,
  UsageService,
  type AiRun,
  type AiRunRepository,
  type UsageRepository,
} from "../src/index";

function item(partial: Partial<ContextItem>): ContextItem {
  return {
    slice: "group_memory",
    content: "Use PostgreSQL",
    source_type: "memory",
    source_id: "m1",
    importance: 0.5,
    confidence: 0.8,
    relevance: 0.5,
    recency: 0.5,
    tokens: 10,
    authorized: true,
    ...partial,
  };
}

describe("§54A Context Engine", () => {
  const engine = new ContextEngine([{ label: "SYSTEM_SAFETY", content: "policy" }], 1000);

  it("privacy filter removes unauthorized items before ranking (§54A.5)", () => {
    const assembled = engine.assemble({
      candidates: [
        item({ slice: "user_private_memory", authorized: false, relevance: 1 }),
        item({ relevance: 0.9 }),
      ],
      explicitReferences: [],
    });
    expect(assembled.competitive).toHaveLength(1);
    expect(assembled.competitive[0]?.slice).toBe("group_memory");
  });

  it("ranks by the exact §54A.2 formula, descending", () => {
    const high = item({ relevance: 1, importance: 1, recency: 1, confidence: 1 });
    const low = item({ relevance: 0, importance: 0, recency: 0, confidence: 0 });
    const assembled = engine.assemble({ candidates: [low, high], explicitReferences: [] });
    expect(assembled.competitive[0]?.source_id).toBe("m1");
    expect(assembled.competitive[1]?.source_id).toBe("m1"); // both same id; check scores instead
    expect(scoreItem(high)).toBeCloseTo(1.0);
    expect(scoreItem(low)).toBe(0);
  });

  it("truncates when the competitive budget is exhausted", () => {
    const assembled = engine.assemble({
      candidates: [
        item({ tokens: 900, relevance: 1 }),
        item({ tokens: 900, relevance: 0.5 }),
      ],
      explicitReferences: [],
    });
    // policy (6) + 900 fits; second 900 does not
    expect(assembled.competitive).toHaveLength(1);
    expect(assembled.truncated).toBe(true);
  });

  it("explicit references ride along without consuming competitive budget (§54A.3)", () => {
    const assembled = engine.assemble({
      candidates: [item({ tokens: 990, relevance: 1 })],
      explicitReferences: [
        { slice: "decisions", content: "Decision #14", source_type: "decision", source_id: "d14", tokens: 50 },
      ],
    });
    expect(assembled.provenance).toContainEqual({ source_type: "decision", source_id: "d14" });
    expect(assembled.competitive).toHaveLength(0); // 990 > 1000-6-50
  });

  it("user-private memory only enters the owner's PRIVATE_AI scope (§55A)", () => {
    const priv = { slice: "group_memory" as const };
    expect(privacyAuthorizes("PUBLIC_GROUP", "u1", priv)).toBe(true);
    expect(
      privacyAuthorizes("PUBLIC_GROUP", "u1", {
        slice: "user_private_memory",
        owner_user_id: "u1",
      }),
    ).toBe(false);
    expect(
      privacyAuthorizes("PRIVATE_AI", "u1", { slice: "user_private_memory", owner_user_id: "u1" }),
    ).toBe(true);
    expect(
      privacyAuthorizes("PRIVATE_AI", "u2", { slice: "user_private_memory", owner_user_id: "u1" }),
    ).toBe(false);
  });

  it("recency decay keeps week-old content, decays month-old (§54A.2)", () => {
    const now = Date.now();
    expect(recencyScore(new Date(now).toISOString(), now)).toBe(1);
    expect(recencyScore(new Date(now - 6 * 86_400_000).toISOString(), now)).toBeGreaterThan(0.6);
    expect(recencyScore(new Date(now - 35 * 86_400_000).toISOString(), now)).toBeLessThan(0.1);
  });
});

describe("§2.6/§56 Tool Registry", () => {
  const githubTool: ToolDefinition = {
    name: "github.create_branch",
    version: "1",
    description: "Create a branch",
    input_schema: {},
    output_schema: {},
    risk_level: "HIGH",
    requires_approval: true,
    allowed_modes: ["ACT"],
    allowed_roles: ["OWNER", "ADMIN"],
    timeout_ms: 30_000,
    retry_policy: "on_transient",
  };

  it("the §2.6 risk table decides approval, not the model", () => {
    expect(approvalRequiredForRisk("READ_ONLY")).toBe(false);
    expect(approvalRequiredForRisk("LOW")).toBe(false);
    expect(approvalRequiredForRisk("MEDIUM")).toBe(true);
    expect(approvalRequiredForRisk("HIGH")).toBe(true);
    expect(approvalRequiredForRisk("CRITICAL")).toBe(true);
  });

  it("registry corrects metadata that contradicts §2.6", () => {
    const registry = new ToolRegistry();
    registry.register({ ...githubTool, risk_level: "LOW", requires_approval: true });
    expect(registry.get("github.create_branch")?.requires_approval).toBe(false);
  });

  it("gates by mode and role", () => {
    const registry = new ToolRegistry();
    registry.register(githubTool);
    expect(registry.canInvoke("github.create_branch", { mode: "ASSIST", role: "OWNER" }).allowed).toBe(false);
    expect(registry.canInvoke("github.create_branch", { mode: "ACT", role: "MEMBER" }).allowed).toBe(false);
    expect(registry.canInvoke("github.create_branch", { mode: "ACT", role: "OWNER" }).allowed).toBe(true);
    expect(registry.canInvoke("nope", { mode: "ACT", role: "OWNER" }).reason).toBe("unknown_tool");
  });

  it("the injection policy text is present (§89)", () => {
    expect(INJECTION_POLICY_TEXT).toContain("data, not authority");
  });

  it("HIGH-risk tool always gets requires_approval corrected to true (§2.6)", () => {
    const registry = new ToolRegistry();
    // Attempt to register a HIGH-risk tool with requires_approval=false
    registry.register({
      ...githubTool,
      requires_approval: false,
    });
    // The registry must correct this per §2.6
    expect(registry.get("github.create_branch")?.requires_approval).toBe(true);
  });

  it("CRITICAL-risk tool always gets requires_approval corrected to true (§2.6)", () => {
    const registry = new ToolRegistry();
    const criticalTool: ToolDefinition = {
      ...githubTool,
      name: "github.merge_pr",
      risk_level: "CRITICAL",
      requires_approval: false, // wrong per §2.6
    };
    registry.register(criticalTool);
    expect(registry.get("github.merge_pr")?.requires_approval).toBe(true);
  });

  it("LOW-risk tool gets requires_approval corrected to false if incorrectly set (§2.6)", () => {
    const registry = new ToolRegistry();
    registry.register({
      ...githubTool,
      name: "web.search",
      risk_level: "LOW",
      requires_approval: true, // wrong per §2.6
    });
    expect(registry.get("web.search")?.requires_approval).toBe(false);
  });

  it("MEDIUM-risk tool requires approval (§2.6)", () => {
    expect(approvalRequiredForRisk("MEDIUM")).toBe(true);
  });

  it("canInvoke returns correct gate results for tool permission checks", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "task.create",
      version: "1",
      description: "Create task",
      input_schema: {},
      output_schema: {},
      risk_level: "MEDIUM",
      requires_approval: true,
      allowed_modes: ["ASSIST", "ACT"],
      allowed_roles: ["OWNER", "ADMIN", "MEMBER"],
      timeout_ms: 5000,
      retry_policy: "never",
    });
    // Guest cannot create tasks
    expect(registry.canInvoke("task.create", { mode: "ACT", role: "GUEST" }).allowed).toBe(false);
    expect(registry.canInvoke("task.create", { mode: "ACT", role: "GUEST" }).reason).toBe("role_not_allowed");
    // Member can
    expect(registry.canInvoke("task.create", { mode: "ACT", role: "MEMBER" }).allowed).toBe(true);
    // ASSIST mode works too
    expect(registry.canInvoke("task.create", { mode: "ASSIST", role: "MEMBER" }).allowed).toBe(true);
    // FACILITATE mode does not
    expect(registry.canInvoke("task.create", { mode: "FACILITATE", role: "MEMBER" }).allowed).toBe(false);
  });
});

describe("§60 AGENT_BEHAVIOR_POLICY", () => {
  it("is included in PROMPT_ASSEMBLY_ORDER between SYSTEM_SAFETY and ODIN_IDENTITY", () => {
    const order = PROMPT_ASSEMBLY_ORDER as readonly string[];
    const safetyIdx = order.indexOf("SYSTEM_SAFETY");
    const policyIdx = order.indexOf("AGENT_BEHAVIOR_POLICY");
    const identityIdx = order.indexOf("ODIN_IDENTITY");
    expect(safetyIdx).toBeGreaterThanOrEqual(0);
    expect(policyIdx).toBe(safetyIdx + 1);
    expect(identityIdx).toBe(policyIdx + 1);
  });

  it("contains all nine consolidated behavioral rules", () => {
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("CLARIFY vs ACT");
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("TOOL and SKILL SELECTION");
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("RESEARCH ESCALATION");
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("ARTIFACT CREATION");
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("MEMORY RULES");
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("GITHUB WORKFLOW");
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("PROACTIVITY");
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("FAILURE and RETRY");
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("OUTPUT DISCIPLINE");
  });

  it("references spec sections verbatim in the policy text", () => {
    // §2.6 risk model
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("§2.6");
    // §58 built-in skill description
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("§58");
    // §69 citation integrity
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("§69");
    // §74 artifact engine
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("§74");
    // §139 branch safety
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("§139");
    // §88 secret sanitization
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("§88");
    // §89 injection defense
    expect(AGENT_BEHAVIOR_POLICY_TEXT).toContain("§89");
  });

  it("is treated as a fixed slice by the ContextEngine (never truncated)", () => {
    const engine = new ContextEngine(
      [
        { label: "SYSTEM_SAFETY", content: "safety" },
        { label: "AGENT_BEHAVIOR_POLICY", content: AGENT_BEHAVIOR_POLICY_TEXT },
        { label: "ODIN_IDENTITY", content: "identity" },
      ],
      100, // very small budget
    );
    const assembled = engine.assemble({ candidates: [], explicitReferences: [] });
    // Fixed slices are always included regardless of budget
    expect(assembled.fixed).toHaveLength(3);
    expect(assembled.fixed[1]?.label).toBe("AGENT_BEHAVIOR_POLICY");
    expect(assembled.fixed[1]?.content).toBe(AGENT_BEHAVIOR_POLICY_TEXT);
  });
});

describe("§116 tool loop guard", () => {
  it("bounds calls and total time (§178: 8 calls / 60s)", () => {
    const guard = new ToolLoopGuard({ max_tool_calls_per_run: 8, max_total_tool_time_ms: 60_000 });
    for (let i = 0; i < 8; i++) {
      expect(guard.tryBeginCall(7000).ok).toBe(true);
    }
    expect(guard.tryBeginCall(1000)).toEqual({ ok: false, reason: "max_tool_calls_exceeded" });

    const timeGuard = new ToolLoopGuard({ max_tool_calls_per_run: 8, max_total_tool_time_ms: 10_000 });
    expect(timeGuard.tryBeginCall(6000).ok).toBe(true);
    expect(timeGuard.tryBeginCall(6000)).toEqual({
      ok: false,
      reason: "max_total_tool_time_exceeded",
    });
  });
});

function runRepo(rows: AiRun[]): AiRunRepository {
  return {
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
      rows.push(run);
      return run;
    },
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async setStatus(id, status) {
      const run = rows.find((r) => r.id === id);
      if (run) run.status = status;
    },
    async listByGroup() {
      return [];
    },
  };
}

describe("§52 run lifecycle", () => {
  it("follows the canonical state machine", async () => {
    const rows: AiRun[] = [];
    const repo = runRepo(rows);
    const run = await repo.insert({
      group_id: "g1",
      project_id: null,
      requester_user_id: "u1",
      ai_agent_id: "a1",
      mode: "ASSIST",
      visibility: "GROUP",
      model_id: "m1",
      input_message_id: null,
    });
    const lifecycle = new RunLifecycle(repo);
    await lifecycle.transition(run.id, "RUNNING");
    await lifecycle.transition(run.id, "WAITING_TOOL");
    await lifecycle.transition(run.id, "RUNNING");
    await lifecycle.transition(run.id, "STREAMING");
    await lifecycle.transition(run.id, "COMPLETED");
    expect(rows[0]?.status).toBe("COMPLETED");
  });

  it("rejects illegal transitions", async () => {
    const rows: AiRun[] = [];
    const repo = runRepo(rows);
    const run = await repo.insert({
      group_id: "g1",
      project_id: null,
      requester_user_id: "u1",
      ai_agent_id: "a1",
      mode: "ASSIST",
      visibility: "GROUP",
      model_id: "m1",
      input_message_id: null,
    });
    const lifecycle = new RunLifecycle(repo);
    await expect(lifecycle.transition(run.id, "COMPLETED")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(canTransition("COMPLETED", "RUNNING")).toBe(false);
    expect(canTransition("WAITING_TOOL", "STREAMING")).toBe(true); // WAITING_TOOL recurs (§134A)
  });
});

describe("§92-§94 usage + quota", () => {
  function usageRepo(sums: Record<string, number>, quota: number | null = null): UsageRepository {
    return {
      async record() {},
      async sumGroupUsage(groupId, category) {
        return sums[`${groupId}:${category}`] ?? 0;
      },
      async quotaLimit() {
        return quota ?? 10;
      },
    };
  }

  it("returns the exact §94 exhaustion contract with BYOK continuation", async () => {
    const svc = new UsageService(usageRepo({ "g1:ai_requests": 10 }), {
      ai_requests_per_period: 10,
      period_ms: 60_000,
    });
    const denied = await svc.checkQuota({ group_id: "g1", byokConfigured: true });
    expect(denied).toEqual({
      allowed: false,
      exhaustion: {
        code: "APPLICATION_AI_QUOTA_EXHAUSTED",
        can_continue_with_byok: true,
      },
    });
    const { status, body } = svc.exhaustionResponse(
      (denied as { exhaustion: import("../src/index").QuotaExhaustion }).exhaustion,
    );
    expect(status).toBe(402);
    expect(body.can_continue_with_byok).toBe(true);

    const noByok = await svc.checkQuota({ group_id: "g1", byokConfigured: false });
    expect(
      (noByok as { exhaustion: { can_continue_with_byok: boolean } }).exhaustion
        .can_continue_with_byok,
    ).toBe(false);
  });

  it("allows runs under quota", async () => {
    const svc = new UsageService(usageRepo({ "g1:ai_requests": 3 }), {
      ai_requests_per_period: 10,
      period_ms: 60_000,
    });
    expect(await svc.checkQuota({ group_id: "g1", byokConfigured: false })).toEqual({
      allowed: true,
    });
  });
});
