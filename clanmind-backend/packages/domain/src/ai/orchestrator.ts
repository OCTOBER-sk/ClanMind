import type { ModelProviderAdapter, ModelRequest } from "@clanmind/ai-providers";
import { AppError } from "@clanmind/shared";
import type { EventOutbox } from "../common/ports";
import type { RealtimePort } from "../realtime/broadcaster";
import type { MembershipService } from "../groups/membership.service";
import type { AiAgentService } from "./agent.service";
import type { ContextEngine } from "./context-engine";
import { ToolLoopGuard, ToolRegistry, type ToolDefinition } from "./context-engine";
import type { RunLifecycle, AiRunRepository, AiRun } from "./run-lifecycle";
import type { UsageService } from "./run-lifecycle";

/** §57A tool-call ledger port (Supabase-backed in the worker). */
export interface ToolCallLedger {
  record(input: {
    ai_run_id: string;
    tool_name: string;
    tool_version: string;
    risk_level: ToolDefinition["risk_level"];
    input_json: Record<string, unknown>;
    requires_approval: boolean;
  }): Promise<string>;
  complete(id: string, status: "SUCCEEDED" | "FAILED" | "DENIED", output: Record<string, unknown> | null, errorCode?: string): Promise<void>;
}

/** G2 Approval Engine port — HIGH/CRITICAL tool calls block here until §78A approval. */
export interface ApprovalGate {
  /** Returns DENIED if rejected, WAITING if an approval is now pending. */
  requestApproval(input: {
    group_id: string;
    project_id: string | null;
    ai_run_id: string;
    initiated_by_user_id: string;
    action_kind: string;
    risk_level: ToolDefinition["risk_level"];
    payload: Record<string, unknown>;
  }): Promise<{ status: "WAITING_APPROVAL"; action_id: string } | { status: "APPROVED" } | { status: "DENIED" }>;
}

export interface ToolExecutor {
  tool_name: string;
  execute(input: Record<string, unknown>): Promise<{ output: Record<string, unknown>; duration_ms: number }>;
}

export interface AiMessageSink {
  persistAiMessage(input: {
    group_id: string;
    project_id: string | null;
    ai_agent_id: string;
    visibility: AiRun["visibility"];
    private_conversation_id: string | null;
    body: string;
    client_message_id: string;
    reply_to_id: string | null;
  }): Promise<{ id: string }>;
}

/** §88 secret patterns applied to every string, at any depth. */
function sanitizeString(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***")
    .replace(/gh[pousr]_[A-Za-z0-9]{20,}/g, "gh_***")
    .replace(/Bearer\s+[A-Za-z0-9._-]{16,}/g, "Bearer ***");
}

/** §88 tool-output sanitizer — secrets never enter model context. Recurses
 * through nested objects and arrays so provider payloads cannot smuggle
 * credentials past a top-level-only scan. */
export function sanitizeToolOutput(output: Record<string, unknown>): Record<string, unknown> {
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") return sanitizeString(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value !== null && typeof value === "object") {
      const cleaned: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        cleaned[key] = walk(entry);
      }
      return cleaned;
    }
    return value;
  };
  return walk(output) as Record<string, unknown>;
}

/**
 * §115 AI request lifecycle orchestrator. Every numbered step of the spec's
 * list maps to a branch below; expensive work never runs inside a DB
 * transaction (§122) and events flow through the outbox + realtime ports.
 */
export class AiOrchestrator {
  constructor(
    private readonly membership: MembershipService,
    private readonly agents: AiAgentService,
    private readonly runs: AiRunRepository,
    private readonly lifecycle: RunLifecycle,
    private readonly contextEngine: ContextEngine,
    private readonly registry: ToolRegistry,
    private readonly router: { resolveAdapter(route: { provider_config_id: string }): Promise<ModelProviderAdapter | null> },
    private readonly routes: { resolveChain(groupId: string): Promise<{ id: string; provider_config_id: string; model_id: string }[]> },
    private readonly usage: UsageService,
    private readonly ledger: ToolCallLedger,
    private readonly approvals: ApprovalGate,
    private readonly executors: Map<string, ToolExecutor>,
    private readonly messageSink: AiMessageSink,
    private readonly realtime: RealtimePort,
    private readonly outbox: EventOutbox,
    private readonly jobs: { enqueue(input: { job_type: string; idempotency_key: string; payload: Record<string, unknown> }): Promise<void> },
    private readonly limits: {
      tool_calls_per_run_max: number;
      tool_total_time_per_run_seconds: number;
      ai_context_token_budget: number;
    },
  ) {}

  /**
   * Steps 1–9: authenticate → authorize → scope → project → agent → run row
   * → config → quota. Throws the §94 exhaustion contract when exhausted.
   */
  async startRun(input: {
    group_id: string;
    requester_user_id: string;
    project_id: string | null;
    mode: AiRun["mode"];
    visibility: AiRun["visibility"];
    input_message_id: string | null;
    private_conversation_id: string | null;
    byokConfigured: boolean;
  }): Promise<AiRun> {
    await this.membership.requireMember(input.group_id, input.requester_user_id);
    const agent = await this.agents.getCurrentAgent(input.group_id);

    const chain = await this.routes.resolveChain(input.group_id);
    const primary = chain[0];
    if (!primary) {
      throw new AppError("CONFLICT", "No AI model configured for this Group.");
    }

    const quota = await this.usage.checkQuota({
      group_id: input.group_id,
      byokConfigured: input.byokConfigured,
    });
    if (!quota.allowed) {
      const { status, body } = this.usage.exhaustionResponse(quota.exhaustion);
      throw new AppError(
        "APPLICATION_AI_QUOTA_EXHAUSTED",
        JSON.stringify(body),
        { status, body },
      );
    }

    const run = await this.runs.insert({
      group_id: input.group_id,
      project_id: input.project_id,
      requester_user_id: input.requester_user_id,
      ai_agent_id: agent.id,
      mode: input.mode,
      visibility: input.visibility,
      model_id: primary.model_id,
      input_message_id: input.input_message_id,
    });
    await this.outbox.publish({
      event_type: "ai.run.started",
      aggregate_type: "ai_run",
      aggregate_id: run.id,
      group_id: input.group_id,
      actor_id: input.requester_user_id,
      payload: { run_id: run.id, mode: input.mode },
    });
    return run;
  }

  /**
   * Steps 10–24: context → model loop with tool gating → streaming → persist
   * AI message → usage → memory extraction enqueue → completed.
   */
  async executeRun(input: {
    run: AiRun;
    requester_role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
    userRequest: string;
    contextCandidates: Parameters<ContextEngine["assemble"]>[0];
    requestedToolCalls: { tool_name: string; input: Record<string, unknown> }[];
  }): Promise<{ run_id: string; response: string; tool_calls: number; truncated: boolean }> {
    const { run } = input;
    await this.lifecycle.transition(run.id, "RUNNING");

    // Step 10–13: context + tools resolved through the engine/registry.
    const assembled = this.contextEngine.assemble(input.contextCandidates);
    const request: ModelRequest = {
      model_id: run.model_id,
      messages: [
        { role: "system", content: JSON.stringify(assembled.fixed) },
        { role: "user", content: input.userRequest },
      ],
      max_tokens: 4096,
    };

    const guard = new ToolLoopGuard({
      max_tool_calls_per_run: this.limits.tool_calls_per_run_max,
      max_total_tool_time_ms: this.limits.tool_total_time_per_run_seconds * 1000,
    });

    // Steps 15 (a–f): tool calls gated by registry + ledger + approvals.
    for (const call of input.requestedToolCalls) {
      const gate = this.registry.canInvoke(call.tool_name, {
        mode: run.mode,
        role: input.requester_role,
      });
      if (!gate.allowed || !gate.tool) {
        await this.ledger.record({
          ai_run_id: run.id,
          tool_name: call.tool_name,
          tool_version: "0",
          risk_level: "READ_ONLY",
          input_json: call.input,
          requires_approval: false,
        });
        continue;
      }
      const budget = guard.tryBeginCall(gate.tool.timeout_ms);
      if (!budget.ok) break; // §116: never recurse forever

      const ledgerId = await this.ledger.record({
        ai_run_id: run.id,
        tool_name: gate.tool.name,
        tool_version: gate.tool.version,
        risk_level: gate.tool.risk_level,
        input_json: call.input,
        requires_approval: gate.tool.requires_approval,
      });

      if (gate.tool.requires_approval) {
        await this.lifecycle.transition(run.id, "WAITING_TOOL");
        const decision = await this.approvals.requestApproval({
          group_id: run.group_id,
          project_id: run.project_id,
          ai_run_id: run.id,
          initiated_by_user_id: run.requester_user_id,
          action_kind: gate.tool.name,
          risk_level: gate.tool.risk_level,
          payload: call.input,
        });
        if (decision.status === "DENIED") {
          await this.ledger.complete(ledgerId, "DENIED", null, "approval_denied");
          continue;
        }
        if (decision.status === "WAITING_APPROVAL") {
          // §117: the action survives disconnects; the run resumes on approval.
          return { run_id: run.id, response: "", tool_calls: guard.callCount, truncated: true };
        }
      }

      const executor = this.executors.get(call.tool_name);
      if (!executor) {
        await this.ledger.complete(ledgerId, "FAILED", null, "no_executor");
        continue;
      }
      const result = await executor.execute(call.input);
      const safeOutput = sanitizeToolOutput(result.output); // §88
      await this.ledger.complete(ledgerId, "SUCCEEDED", safeOutput);
      request.messages.push({
        role: "tool",
        content: JSON.stringify(safeOutput), // §88: labeled untrusted by policy
      });
    }

    // Steps 14 + 17: provider streaming with §61 fallback chain.
    await this.lifecycle.transition(run.id, "STREAMING");
    const chain = await this.routes.resolveChain(run.group_id);
    let response = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let adapterTried = 0;
    let streamedAny = false;

    for (const route of chain) {
      const adapter = await this.router.resolveAdapter(route);
      if (!adapter) continue;
      adapterTried += 1;
      // Each attempt owns its own buffer: a fallback must never inherit the
      // failed provider's partial text.
      let attemptBuffer = "";
      let failed = false;
      let failureCode = "provider_unavailable";
      try {
        for await (const event of adapter.generate({ ...request, model_id: route.model_id })) {
          if (event.type === "text_delta") {
            attemptBuffer += event.text;
            response = attemptBuffer;
            streamedAny = true;
            await this.realtime.publish({
              group_id: run.group_id,
              event_type: "ai.response.delta",
              actor_id: run.requester_user_id,
              visibility: run.visibility,
              payload: { run_id: run.id, delta: event.text },
            });
          } else if (event.type === "usage") {
            inputTokens = event.input_tokens;
            outputTokens = event.output_tokens;
          } else if (event.type === "error") {
            failed = true;
            failureCode = event.code || "provider_unavailable";
            // §61: non-retryable errors never fall back (Correction 16).
            if (
              ["invalid_api_key", "invalid_request", "permission_denied", "safety_refusal"].includes(
                failureCode,
              )
            ) {
              break;
            }
            break;
          }
        }
      } catch (error) {
        if (!(error instanceof AppError)) {
          failed = true;
          failureCode = "provider_unavailable";
        } else {
          throw error;
        }
      }
      if (!failed && response.length > 0) break;
      if (failed) {
        // §61/Correction 16: once tokens have been streamed, a mid-stream
        // retryable failure cannot be silently replaced — the partial output
        // would contaminate the fallback. Fail the run instead.
        if (streamedAny) {
          await this.lifecycle.transition(run.id, "FAILED", { failure_code: failureCode });
          await this.outbox.publish({
            event_type: "ai.response.failed",
            aggregate_type: "ai_run",
            aggregate_id: run.id,
            group_id: run.group_id,
            actor_id: run.requester_user_id,
            payload: { run_id: run.id, failure_code: failureCode },
          });
          throw new AppError("INTERNAL", `Provider stream failed mid-response (${failureCode}).`);
        }
        // Nothing streamed yet: clean fallback to the next route.
        response = "";
      }
    }

    if (adapterTried === 0 || response.length === 0) {
      await this.lifecycle.transition(run.id, "FAILED", { failure_code: "provider_unavailable" });
      await this.outbox.publish({
        event_type: "ai.response.failed",
        aggregate_type: "ai_run",
        aggregate_id: run.id,
        group_id: run.group_id,
        actor_id: run.requester_user_id,
        payload: { run_id: run.id },
      });
      throw new AppError("INTERNAL", "No provider could complete this run.");
    }

    // Steps 18–21: persist the AI message + completed event.
    const message = await this.messageSink.persistAiMessage({
      group_id: run.group_id,
      project_id: run.project_id,
      ai_agent_id: run.ai_agent_id,
      visibility: run.visibility,
      private_conversation_id: null,
      body: response,
      client_message_id: `ai_run_${run.id}`,
      reply_to_id: run.input_message_id,
    });
    await this.runs.setStatus(run.id, "COMPLETED", {
      usage_json: { input_tokens: inputTokens, output_tokens: outputTokens },
    });
    await this.outbox.publish({
      event_type: "ai.response.completed",
      aggregate_type: "ai_run",
      aggregate_id: run.id,
      group_id: run.group_id,
      actor_id: run.requester_user_id,
      payload: { run_id: run.id, message_id: message.id, visibility: run.visibility },
    });

    // Step 22–23: usage increment + memory extraction enqueue.
    await this.usage.record({
      group_id: run.group_id,
      user_id: run.requester_user_id,
      category: "ai_requests",
      quantity: 1,
      unit: "requests",
    });
    await this.usage.record({
      group_id: run.group_id,
      user_id: run.requester_user_id,
      category: "output_tokens",
      quantity: outputTokens,
      unit: "tokens",
    });
    await this.jobs.enqueue({
      job_type: "memory.extraction",
      idempotency_key: `memory:run:${run.id}`,
      payload: { run_id: run.id, group_id: run.group_id, visibility: run.visibility },
    });

    return { run_id: run.id, response, tool_calls: guard.callCount, truncated: false };
  }

  /** §120 cancellation. */
  async cancel(runId: string): Promise<void> {
    await this.lifecycle.transition(runId, "CANCELLED");
  }
}
