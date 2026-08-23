import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ApprovalEngine,
  ArtifactService,
  AiAgentService,
  AiOrchestrator,
  ContextEngine,
  DecisionService,
  ModelRouterService,
  ProviderConfigService,
  RunLifecycle,
  TaskService,
  ToolRegistry,
  UsageService,
  privacyAuthorizes,
  type ActionRepository,
  type AiMessageSink,
  type AiRunRepository,
  type ApprovalGate,
  type ContextItem,
  type EventOutbox,
  type JobQueue,
  type MemoryService,
  type MembershipService,
  type RealtimePort,
  type ToolCallLedger,
  type ToolExecutor,
  type UsageRepository,
} from "@clanmind/domain";
import { OpenAICompatibleAdapter } from "@clanmind/ai-providers";
import { ExaProvider, TavilyProvider } from "@clanmind/search";
import type { Limits } from "@clanmind/shared";
import {
  EnvelopeSecretStore,
  SupabaseActionRepository,
  SupabaseAiRunRepository,
  SupabaseModelRouteRepository,
  SupabaseProviderConfigRepository,
  SupabaseToolCallLedger,
  SupabaseUsageRepository,
} from "../repositories/ai-runtime.repo";
import {
  SupabaseArtifactRepository,
  SupabaseDecisionRepository,
  SupabaseTaskRepository,
} from "../repositories/project-intel.repo";
import { SupabaseMessageRepository } from "../repositories/message.repo";

/**
 * §62 provider → OpenAI-compatible endpoint mapping. Every supported vendor
 * (including Google's and Anthropic's compatibility surfaces) speaks the
 * same wire format, so one adapter class covers the pool without vendor
 * lock-in.
 */
const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
  anthropic: "https://api.anthropic.com/v1/",
};

export interface AiRuntimeDeps {
  db: SupabaseClient;
  env: {
    SUPABASE_JWT_SECRET?: string;
    BYOK_ENCRYPTION_KEY?: string;
    APPLICATION_AI_API_KEY?: string;
    TAVILY_API_KEY?: string;
    EXA_API_KEY?: string;
  };
  membership: MembershipService;
  memory: MemoryService;
  agents: AiAgentService;
  realtime: RealtimePort;
  outbox: EventOutbox;
  jobs: JobQueue;
  limits: Limits;
}

/** §115/§182 AI runtime composition shared by REST handlers and the DO room. */
export interface AiRuntime {
  orchestrator: AiOrchestrator;
  engine: ContextEngine;
  registry: ToolRegistry;
  router: ModelRouterService;
  providers: ProviderConfigService;
  usage: UsageService;
  lifecycle: RunLifecycle;
  runs: AiRunRepository;
  approvalEngine: ApprovalEngine;
  artifacts: ArtifactService;
  decisions: DecisionService;
  tasks: TaskService;
  expireStaleActions(): Promise<number>;
  buildContextCandidates(input: {
    group_id: string;
    project_id: string | null;
    requester_user_id: string;
    visibility: "GROUP" | "PRIVATE_PAIR" | "PRIVATE_AI";
    query: string;
  }): Promise<ContextItem[]>;
}

export function buildAiRuntime(deps: AiRuntimeDeps): AiRuntime {
  const { db, env, limits } = deps;

  const runs = new SupabaseAiRunRepository(db);
  const lifecycle = new RunLifecycle(runs);
  const usageRepo: UsageRepository = new SupabaseUsageRepository(db);
  const usage = new UsageService(usageRepo, {
    // Application-AI pool defaults (§92); per-group overrides live in
    // quota_states and win over these numbers (§178 configuration rule).
    ai_requests_per_period: 2000,
    period_ms: 30 * 24 * 60 * 60 * 1000,
  });

  // §63.2 envelope encryption — the key lives outside the database. Local/dev
  // falls back to the JWT secret so BYOK stays testable without an extra
  // provisioned secret; production sets BYOK_ENCRYPTION_KEY via wrangler.
  const secrets = new EnvelopeSecretStore(
    env.BYOK_ENCRYPTION_KEY ?? env.SUPABASE_JWT_SECRET ?? "clanmind-dev-secret",
  );

  const configRepo = new SupabaseProviderConfigRepository(db);
  const routeRepo = new SupabaseModelRouteRepository(db);

  const providers = new ProviderConfigService(configRepo, secrets, async (provider, apiKey) => {
    // §64 validate-before-store: a real listing call decides validity.
    try {
      const adapter = new OpenAICompatibleAdapter(
        provider,
        apiKey,
        PROVIDER_BASE_URLS[provider] ?? PROVIDER_BASE_URLS["openai"],
      );
      const result = await adapter.validateCredentials();
      return { valid: result.valid, models: result.models.map((m) => m.model_id) };
    } catch {
      return { valid: false, models: [] };
    }
  });

  const router = new ModelRouterService(routeRepo);
  const ledger: ToolCallLedger = new SupabaseToolCallLedger(db);
  const actionRepo: ActionRepository = new SupabaseActionRepository(db);
  const approvalEngine = new ApprovalEngine(actionRepo);

  /** §78A-backed approval gate for HIGH/CRITICAL tool calls (§2.6). */
  const approvals: ApprovalGate = {
    async requestApproval(input) {
      const action = await approvalEngine.propose({
        group_id: input.group_id,
        project_id: input.project_id,
        ai_run_id: input.ai_run_id,
        initiated_by_user_id: input.initiated_by_user_id,
        action_kind: input.action_kind,
        risk_level: input.risk_level,
        payload: input.payload,
        requires_approval: true,
      });
      await deps.outbox.publish({
        event_type: "ai.action.proposed",
        aggregate_type: "ai_action",
        aggregate_id: action.id,
        group_id: input.group_id,
        actor_id: input.initiated_by_user_id,
        payload: {
          action_id: action.id,
          action_kind: input.action_kind,
          risk_level: input.risk_level,
          payload_hash: action.payload_hash,
          payload_version: action.payload_version,
          payload: action.payload,
        },
      });
      return { status: "WAITING_APPROVAL", action_id: action.id };
    },
  };

  const engine = new ContextEngine([], limits.ai_context_token_budget);
  const registry = new ToolRegistry();

  // --- §56 tool definitions + executors ---------------------------------

  const tavily = env.TAVILY_API_KEY ? new TavilyProvider(env.TAVILY_API_KEY) : null;
  const exa = env.EXA_API_KEY ? new ExaProvider(env.EXA_API_KEY) : null;

  registry.register({
    name: "web.search",
    version: "1",
    description: "Search the web for current information; returns cited sources.",
    input_schema: { query: "string", max_results: "number?" },
    output_schema: { hits: [{ title: "string", url: "string", snippet: "string?" }] },
    risk_level: "READ_ONLY",
    requires_approval: false,
    allowed_modes: ["ASSIST", "FACILITATE", "ACT"],
    allowed_roles: ["OWNER", "ADMIN", "MEMBER", "GUEST"],
    timeout_ms: 15000,
    retry_policy: "on_transient",
  });

  registry.register({
    name: "task.create",
    version: "1",
    description: "Create a task in a project.",
    input_schema: { project_id: "string", title: "string", description: "string?" },
    output_schema: { task_id: "string" },
    risk_level: "MEDIUM",
    requires_approval: true,
    allowed_modes: ["ASSIST", "ACT"],
    allowed_roles: ["OWNER", "ADMIN", "MEMBER"],
    timeout_ms: 5000,
    retry_policy: "never",
  });

  registry.register({
    name: "decision.propose",
    version: "1",
    description: "Propose a decision for team approval.",
    input_schema: { project_id: "string", title: "string", context: "string?" },
    output_schema: { decision_id: "string" },
    risk_level: "MEDIUM",
    requires_approval: true,
    allowed_modes: ["ASSIST", "FACILITATE", "ACT"],
    allowed_roles: ["OWNER", "ADMIN", "MEMBER"],
    timeout_ms: 5000,
    retry_policy: "never",
  });

  registry.register({
    name: "artifact.create",
    version: "1",
    description: "Create a draft artifact version in the Garage.",
    input_schema: {
      project_id: "string",
      name: "string",
      artifact_type: "string",
      content: "string",
    },
    output_schema: { artifact_id: "string", version_number: "number" },
    risk_level: "LOW",
    requires_approval: false,
    allowed_modes: ["ASSIST", "FACILITATE", "ACT"],
    allowed_roles: ["OWNER", "ADMIN", "MEMBER"],
    timeout_ms: 10000,
    retry_policy: "never",
  });

  const artifacts = new ArtifactService(new SupabaseArtifactRepository(db), {
    artifact_text_max_bytes: limits.artifact_text_max_bytes,
    artifact_binary_max_bytes: limits.artifact_binary_max_bytes,
  });

  // §134: approved decisions become high-priority project memory candidates.
  const decisions = new DecisionService(new SupabaseDecisionRepository(db), async (decision) => {
    const groupId = await projectIdToGroupId(db, decision.project_id);
    if (!groupId) return;
    await deps.memory
      .registerMemory({
        group_id: groupId,
        project_id: decision.project_id,
        memory_type: "decision",
        content: decision.title,
        confidence: 0.95,
        source_type: "approved_decision",
        fromApprovedDecision: true,
      })
      .catch(() => undefined);
  });
  const tasks = new TaskService(new SupabaseTaskRepository(db));

  const executors = new Map<string, ToolExecutor>();

  executors.set("web.search", {
    tool_name: "web.search",
    async execute(input) {
      if (!tavily && !exa) throw new Error("no_search_provider_configured");
      const provider = tavily ?? exa!;
      const response = await provider.search({
        query: String(input.query ?? ""),
        max_results: typeof input.max_results === "number" ? input.max_results : 5,
      });
      // §66: web-tool use is disclosed; citations come from tool output.
      return {
        output: { provider: response.provider, hits: response.hits, disclosure: "web_search_used" },
        duration_ms: 0,
      };
    },
  });

  executors.set("task.create", {
    tool_name: "task.create",
    async execute(input) {
      const groupId = await projectIdToGroupId(db, String(input.project_id));
      const task = await tasks.create({
        project_id: String(input.project_id),
        title: String(input.title ?? ""),
        description: input.description != null ? String(input.description) : null,
        owner_user_id: null,
        created_by_user_id: null,
      });
      await deps.outbox.publish({
        event_type: "task.created",
        aggregate_type: "task",
        aggregate_id: task.id,
        group_id: groupId,
        actor_id: null,
        payload: { task_id: task.id, title: task.title },
      });
      return { output: { task_id: task.id }, duration_ms: 0 };
    },
  });

  executors.set("decision.propose", {
    tool_name: "decision.propose",
    async execute(input) {
      const decision = await decisions.propose({
        project_id: String(input.project_id),
        title: String(input.title ?? ""),
        context: input.context != null ? String(input.context) : null,
        proposed_by: "00000000-0000-0000-0000-000000000000",
      });
      const groupId = await projectIdToGroupId(db, decision.project_id);
      await deps.outbox.publish({
        event_type: "decision.proposed",
        aggregate_type: "decision",
        aggregate_id: decision.id,
        group_id: groupId,
        actor_id: null,
        payload: { decision_id: decision.id, title: decision.title },
      });
      return { output: { decision_id: decision.id }, duration_ms: 0 };
    },
  });

  executors.set("artifact.create", {
    tool_name: "artifact.create",
    async execute(input) {
      const { artifact, version } = await artifacts.create({
        project_id: String(input.project_id),
        name: String(input.name ?? "Untitled"),
        artifact_type: String(input.artifact_type ?? "DOCUMENT") as Parameters<
          ArtifactService["create"]
        >[0]["artifact_type"],
        created_by_user_id: null,
        content_type: "text/markdown",
        content: String(input.content ?? ""),
        is_binary: false,
      });
      const groupId = await projectIdToGroupId(db, artifact.project_id);
      await deps.outbox.publish({
        event_type: "artifact.created",
        aggregate_type: "artifact",
        aggregate_id: artifact.id,
        group_id: groupId,
        actor_id: null,
        payload: { artifact_id: artifact.id, version: version.version_number },
      });
      return {
        output: { artifact_id: artifact.id, version_number: version.version_number },
        duration_ms: 0,
      };
    },
  });

  const messageSink: AiMessageSink = {
    async persistAiMessage(input) {
      // §122 atomic write path — same RPC human sends use; the RPC also
      // emits message.created for realtime fan-out.
      const repo = new SupabaseMessageRepository(db);
      const created = await repo.createWithMentions({
        group_id: input.group_id,
        project_id: input.project_id,
        visibility: input.visibility,
        private_conversation_id: input.private_conversation_id,
        body: input.body,
        client_message_id: input.client_message_id,
        reply_to_id: input.reply_to_id,
        mention_user_ids: [],
        sender_user_id: null,
        sender_type: "AI",
        sender_ai_id: input.ai_agent_id,
      } as Parameters<typeof repo.createWithMentions>[0]);
      return { id: created.id };
    },
  };

  // §115 lifecycle steps 1–24 in one composed unit.
  const orchestrator = new AiOrchestrator(
    deps.membership,
    deps.agents,
    runs,
    lifecycle,
    engine,
    registry,
    {
      async resolveAdapter(route) {
        const config = await configRepo.findById(route.provider_config_id);
        if (!config || !config.enabled || !config.credential_ref) return null;
        const apiKey =
          config.kind === "BYOK"
            ? await secrets.getSecret(config.credential_ref.replace(/^secret:/, ""))
            : env.APPLICATION_AI_API_KEY;
        if (!apiKey) return null;
        return new OpenAICompatibleAdapter(
          config.provider,
          apiKey,
          PROVIDER_BASE_URLS[config.provider] ?? PROVIDER_BASE_URLS["openai"],
        );
      },
    },
    { resolveChain: (groupId) => router.resolveChain(groupId) },
    usage,
    ledger,
    approvals,
    executors,
    messageSink,
    deps.realtime,
    deps.outbox,
    deps.jobs,
    {
      tool_calls_per_run_max: limits.tool_calls_per_run_max,
      tool_total_time_per_run_seconds: limits.tool_total_time_per_run_seconds,
      ai_context_token_budget: limits.ai_context_token_budget,
    },
  );

  const runtime: AiRuntime = {
    orchestrator,
    engine,
    registry,
    router,
    providers,
    usage,
    lifecycle,
    runs,
    approvalEngine,
    artifacts,
    decisions,
    tasks,
    expireStaleActions: () => approvalEngine.expireStaleActions(),
    buildContextCandidates: (input) => buildContextCandidates(db, deps.memory, input),
  };
  return runtime;
}

async function projectIdToGroupId(db: SupabaseClient, projectId: string): Promise<string | null> {
  const { data } = await db
    .from("projects")
    .select("group_id")
    .eq("id", projectId)
    .maybeSingle();
  return (data as { group_id: string } | null)?.group_id ?? null;
}

/**
 * §54 candidate assembly (worker side): authorized memories + recent public
 * conversation. Privacy authorization is decided HERE, before any scoring
 * (§54A.5).
 */
async function buildContextCandidates(
  db: SupabaseClient,
  memory: MemoryService,
  input: {
    group_id: string;
    project_id: string | null;
    requester_user_id: string;
    visibility: "GROUP" | "PRIVATE_PAIR" | "PRIVATE_AI";
    query: string;
  },
): Promise<ContextItem[]> {
  const items: ContextItem[] = [];
  const scope = input.visibility === "PRIVATE_AI" ? "PRIVATE_AI" : "PUBLIC_GROUP";

  const memories = await memory.retrieveForContext({
    group_id: input.group_id,
    project_id: input.project_id,
    user_id: input.requester_user_id,
    include_user_private: input.visibility === "PRIVATE_AI",
    limit: 12,
  });
  for (const m of memories) {
    const slice: ContextItem["slice"] =
      m.scope_type === "PROJECT"
        ? "project_memory"
        : m.scope_type === "USER_PRIVATE"
          ? "user_private_memory"
          : "group_memory";
    items.push({
      slice,
      content: m.content,
      source_type: "memory",
      source_id: m.id,
      importance: Number(m.importance),
      confidence: Number(m.confidence),
      relevance: keywordRelevance(m.content, input.query),
      recency: recencyOf(m.updated_at),
      tokens: Math.ceil(m.content.length / 4),
      authorized: privacyAuthorizes(scope, input.requester_user_id, {
        slice,
        owner_user_id: m.user_id,
      }),
    });
  }

  // Recent public conversation only — private rows never enter context (§55).
  const { data } = await db
    .from("messages")
    .select("sender_type, body")
    .eq("group_id", input.group_id)
    .eq("visibility", "GROUP")
    .is("deleted_at", null)
    .order("server_sequence", { ascending: false })
    .limit(12);
  const recent = (data as { sender_type: string; body: string }[] | null) ?? [];
  const transcript = recent
    .slice()
    .reverse()
    .map((m) => `${m.sender_type === "AI" ? "Odin" : "member"}: ${m.body.slice(0, 400)}`)
    .join("\n");
  if (transcript.length > 0) {
    items.push({
      slice: "recent_conversation",
      content: transcript,
      source_type: "messages",
      source_id: input.group_id,
      importance: 0.4,
      confidence: 1,
      relevance: keywordRelevance(transcript, input.query),
      recency: 1,
      tokens: Math.ceil(transcript.length / 4),
      authorized: true,
    });
  }

  return items;
}

function keywordRelevance(content: string, query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return 0.3;
  const c = content.toLowerCase();
  const hits = terms.filter((t) => c.includes(t)).length;
  return Math.min(1, hits / terms.length);
}

function recencyOf(updatedAt: string): number {
  const ageDays = (Date.now() - new Date(updatedAt).getTime()) / 86_400_000;
  if (ageDays <= 0) return 1;
  return Math.exp(-ageDays / 14);
}
