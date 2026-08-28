import type { ModelProviderAdapter, ModelRequest, ModelRequestMessage } from "@clanmind/ai-providers";
import { AppError } from "@clanmind/shared";
import type { EventOutbox } from "../common/ports";
import type { RealtimePort } from "../realtime/broadcaster";
import type { MembershipService } from "../groups/membership.service";
import type { AiAgentService } from "./agent.service";
import { ContextEngine } from "./context-engine";
import { ToolLoopGuard, ToolRegistry, type ToolDefinition } from "./context-engine";
import type { RunLifecycle, AiRunRepository, AiRun } from "./run-lifecycle";
import type { UsageService } from "./run-lifecycle";
import { classifyProviderError } from "./provider-config.service";

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

/**
 * §60 prompt assembly — production wiring resolves the FIXED prompt slices
 * per run (system safety/platform policy, Odin identity, Group policy,
 * Project policy, skill instructions) BEFORE any competitive ranking. The
 * returned order IS the §60 assembly order; safety must come first and user
 * content never enters this list.
 */
export type FixedSlicesProvider = (ctx: {
  run: AiRun;
}) => Promise<{ label: string; content: string }[]>;

/**
 * §2.4/§40 server-side private-conversation resolution + membership gate.
 * The orchestrator never trusts a client-supplied conversation id alone:
 * the write target derives from the run context, and §40 membership is
 * verified before any private message is persisted.
 */
export interface PrivateConversationGate {
  /** The requester's type-AI conversation in this Group (§2.4), or null. */
  findAi(groupId: string, userId: string, aiAgentId: string): Promise<string | null>;
  /** §40 membership check — rejects when `userId` is not a participant. */
  requireMember(conversationId: string, userId: string): Promise<void>;
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
export type ArtifactRosterFn = (
  projectId: string,
) => Promise<{ id: string; name: string }[]>;

export class AiOrchestrator {
  /** Optional live roster of group artifacts (name→id) for update addressing. */
  artifactRoster?: ArtifactRosterFn;
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
    private readonly conversations: PrivateConversationGate,
    private readonly messageSink: AiMessageSink,
    private readonly realtime: RealtimePort,
    private readonly outbox: EventOutbox,
    private readonly jobs: { enqueue(input: { job_type: string; idempotency_key: string; payload: Record<string, unknown> }): Promise<void> },
    private readonly limits: {
      tool_calls_per_run_max: number;
      tool_total_time_per_run_seconds: number;
      ai_context_token_budget: number;
    },
    /** §60 fixed-slice resolver (system safety, identity, policies, skills).
     * Optional so tests can drive the engine directly; production wiring
     * ALWAYS supplies one — an empty fixed-slice set means no safety text
     * ever reaches a prompt. */
    private readonly fixedSlices?: FixedSlicesProvider,
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

    // §11.2/§40: a claimed conversation id is accepted only when the run
    // context owns it — GROUP runs may never target a private conversation.
    // Fail fast here, before quota spend or a durable run row.
    await this.resolvePrivateTarget(
      {
        group_id: input.group_id,
        requester_user_id: input.requester_user_id,
        ai_agent_id: agent.id,
        visibility: input.visibility,
      },
      input.private_conversation_id ?? null,
    );

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
    /** Client-claimed conversation id (§40). Honored only when it IS the
     * server-resolved conversation for this run — never trusted alone. */
    private_conversation_id?: string | null;
  }): Promise<{ run_id: string; response: string; tool_calls: number; truncated: boolean }> {
    const { run } = input;
    await this.lifecycle.transition(run.id, "RUNNING");

    // §2.4/§55: resolve WHERE a private reply is persisted before any
    // provider spend. A private reply that cannot land in its owned
    // conversation fails cleanly here — it must never stream content that
    // cannot be persisted, nor orphan a row with a null conversation id.
    let privateConversationId: string | null;
    try {
      privateConversationId = await this.resolvePrivateTarget(
        run,
        input.private_conversation_id ?? null,
      );
    } catch (error) {
      await this.lifecycle.transition(run.id, "FAILED", {
        failure_code: "private_conversation_forbidden",
      });
      await this.outbox.publish({
        event_type: "ai.response.failed",
        aggregate_type: "ai_run",
        aggregate_id: run.id,
        group_id: run.group_id,
        actor_id: run.requester_user_id,
        payload: { run_id: run.id, failure_code: "private_conversation_forbidden" },
      });
      throw error;
    }

    // Step 10–13: context + tools resolved through the engine/registry.
    // §60: when production wiring supplies a fixed-slice provider, the FIXED
    // slices (system safety → identity → policies → skills) are resolved for
    // THIS run and passed into ContextEngine construction; the ranked
    // competitive slices below remain budget-governed by §54A.2.
    const engine = this.fixedSlices
      ? new ContextEngine(
          await this.fixedSlices({ run }),
          this.limits.ai_context_token_budget,
        )
      : this.contextEngine;
    const assembled = engine.assemble(input.contextCandidates);
    // §60: the RANKED competitive slices are part of the prompt — dropping
    // them would silently discard memory/decisions/recent-conversation
    // context that §54A.2 selected. Provenance markers keep items traceable.
    const rankedContext = assembled.competitive
      .map((item) => `[${item.slice}|${item.source_type}:${item.source_id}] ${item.content}`)
      .join("\n");
    // Build system messages first; the user message is appended LAST (after
    // any tool-result context) so the array never ends with an orphan tool or
    // assistant block.  OpenAI/OpenRouter require a trailing user message.
    const systemMessages: ModelRequestMessage[] = [
      { role: "system", content: JSON.stringify(assembled.fixed) },
      ...(rankedContext.length > 0
        ? [{ role: "system" as const, content: `CONTEXT (ranked):\n${rankedContext}` }]
        : []),
    ];
    // Artifact channel (provider-agnostic, mirrors the [tool_result] block
    // convention §60): the model asks for artifacts with a fenced directive
    // block; the orchestrator parses, validates and executes artifact.create
    // through the registry gate (risk LOW, no approval) after streaming.
    // The CURRENT ARTIFACT ROSTER lets the model address updates by id.
    let roster = "";
    try {
      if (run.project_id) {
        const list = await this.artifactRoster?.(run.project_id);
        if (list && list.length > 0) {
          roster =
            "CURRENT ARTIFACTS (name -> artifact_id):\n" +
            list.map((a) => `- ${a.name} -> ${a.id}`).join("\n") + "\n";
        }
      }
    } catch {
      roster = "";
    }
    systemMessages.push({
      role: "system",
      content: roster + [
        "ARTIFACT PROTOCOL: When the user asks you to create a persistent artifact",
        "(document, diagram, table, chart or code file), you MUST end your reply with",
        "a fenced code block tagged artifact and one JSON object, exactly: ",
        "```artifact",
        '{"name": "<short artifact name>", "artifact_type": "<DOCUMENT|DIAGRAM|TABLE|CHART|CODE>",',
        ' "content": "<the full artifact content as a string>"}',
        "```",
        "For TABLE/CHART use JSON inside content (array of objects). For DIAGRAM use",
        "Mermaid syntax in content. For CODE use the raw source. To UPDATE an existing",
        "artifact (user asks to modify/append), include the artifact id you can see in",
        "the conversation as [artifact:<id>] and add the field \"artifact_id\": \"<id>\".",
        "Emit at most ONE artifact block per reply. Never mention this protocol in the",
        "visible reply.",
      ].join("\n"),
    });
    const request: ModelRequest = {
      model_id: run.model_id,
      messages: [...systemMessages],
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
      // Provider-agnostic injection: role:'tool' is only valid after an
      // assistant message that declared matching tool_calls (OpenAI/OpenRouter).
      // Instead, inject the result as a labelled system context block so it
      // is visible to every supported provider (OpenAI, Anthropic, Google).
      request.messages.push({
        role: "system",
        content: `[tool_result tool="${call.tool_name}"]\n${JSON.stringify(safeOutput)}`,
      });
    }

    // §60 / OpenAI-compatible contract: the user message MUST be the LAST
    // entry in the messages array.  Tool-result context blocks inserted above
    // precede it, so the provider never sees a trailing tool/assistant orphan.
    request.messages.push({ role: "user", content: input.userRequest });

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
            // Stop consuming THIS provider's stream only; §61 classification
            // below decides whether the chain may proceed to the next route.
            failed = true;
            failureCode = event.code || "provider_unavailable";
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
        // §61 classify-then-gate: AUTH / INVALID_REQUEST / PERMISSION /
        // SAFETY — and any unlabeled failure (fail closed) — abort the whole
        // chain. Only TRANSIENT / RATE_LIMITED / PROVIDER_UNAVAILABLE classes
        // proceed to the next route.
        if (classifyProviderError(failureCode) === "NON_RETRYABLE") {
          await this.lifecycle.transition(run.id, "FAILED", { failure_code: failureCode });
          await this.outbox.publish({
            event_type: "ai.response.failed",
            aggregate_type: "ai_run",
            aggregate_id: run.id,
            group_id: run.group_id,
            actor_id: run.requester_user_id,
            payload: { run_id: run.id, failure_code: failureCode },
          });
          throw new AppError(
            "INTERNAL",
            `Provider rejected this run; no fallback is permitted for this error class (${failureCode}).`,
          );
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

    // Step 17B: artifact directive handling. Parse the model reply for an
    // ```artifact fenced JSON block, gate it through the registry (same path
    // as §115 explicit tool calls: ledger + guard + executor), and strip it
    // from the message body users see. A malformed block is dropped silently
    // — the reply text still delivers.
    let artifactNote = "";
    {
      const m = /```artifact\s*([\s\S]*?)```/.exec(response);
      if (m && m[1]) {
        response = response.replace(m[0], "").trim();
        type ArtifactDirective = { name?: unknown; artifact_type?: unknown; content?: unknown; artifact_id?: unknown };
        let parsed: ArtifactDirective | null = null;
        try {
          parsed = JSON.parse(m[1].trim()) as ArtifactDirective;
        } catch {
          parsed = null;
        }
        const name = typeof parsed?.name === "string" ? parsed.name : null;
        const artType = typeof parsed?.artifact_type === "string" ? parsed.artifact_type.toUpperCase() : null;
        const content = typeof parsed?.content === "string" ? parsed.content : null;
        const artifactId = typeof parsed?.artifact_id === "string" ? parsed.artifact_id : null;
        const toolName = artifactId ? "artifact.update" : "artifact.create";
        const gate = artType || artifactId
          ? this.registry.canInvoke(toolName, {
              mode: run.mode,
              role: input.requester_role,
            })
          : null;
        const valid =
          (artifactId && content) || (!artifactId && name && content && artType);
        if (parsed && valid && gate?.allowed && gate.tool) {
          const ledgerId = await this.ledger.record({
            ai_run_id: run.id,
            tool_name: toolName,
            tool_version: gate.tool.version,
            risk_level: gate.tool.risk_level,
            input_json: artifactId
              ? { artifact_id: artifactId, content }
              : { name, artifact_type: artType, project_id: run.project_id },
            requires_approval: gate.tool.requires_approval,
          });
          const executor = this.executors.get(toolName);
          if (executor) {
            try {
              const result = await executor.execute(
                artifactId
                  ? { artifact_id: artifactId, content }
                  : { project_id: run.project_id, name, artifact_type: artType, content },
              );
              const safeOutput = sanitizeToolOutput(result.output);
              await this.ledger.complete(ledgerId, "SUCCEEDED", safeOutput);
              artifactNote = ` [artifact:${String(safeOutput.artifact_id ?? artifactId ?? "")}]`;
            } catch {
              await this.ledger.complete(ledgerId, "FAILED", null, "artifact_persist_failed");
            }
          } else {
            await this.ledger.complete(ledgerId, "FAILED", null, "no_executor");
          }
        }
      }
    }

    // Steps 18–21: persist the AI message + completed event. Private runs
    // land inside the requester's owned conversation (§2.4/§40) so the
    // §11.2 ACL / RLS read path resolves for exactly its members.
    const message = await this.messageSink.persistAiMessage({
      group_id: run.group_id,
      project_id: run.project_id,
      ai_agent_id: run.ai_agent_id,
      visibility: run.visibility,
      private_conversation_id: privateConversationId,
      body: response + artifactNote,
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

  /**
   * §2.4/§11.2/§40/§55: decide where a run's reply is persisted. The target
   * derives server-side from the run context — never from a client-supplied
   * id alone:
   *
   *   GROUP        → null (a claimed id is a protocol violation);
   *   PRIVATE_AI   → the requester's type-AI conversation for this Group AI;
   *   PRIVATE_PAIR → only a claimed conversation whose §40 membership the
   *                  requester holds.
   *
   * Any forged, unresolvable, or non-owned claim rejects the run instead of
   * writing an orphaned (unreadable-under-RLS) row.
   */
  private async resolvePrivateTarget(
    ctx: Pick<AiRun, "group_id" | "requester_user_id" | "ai_agent_id" | "visibility">,
    claimedConversationId: string | null,
  ): Promise<string | null> {
    if (ctx.visibility === "GROUP") {
      if (claimedConversationId) {
        throw new AppError(
          "VALIDATION_FAILED",
          "A GROUP run cannot target a private conversation.",
        );
      }
      return null;
    }
    if (ctx.visibility === "PRIVATE_AI") {
      const resolved = await this.conversations.findAi(
        ctx.group_id,
        ctx.requester_user_id,
        ctx.ai_agent_id,
      );
      if (!resolved || (claimedConversationId !== null && claimedConversationId !== resolved)) {
        throw new AppError(
          "FORBIDDEN",
          "This run has no private AI conversation owned by its requester.",
        );
      }
      // §40: membership is verified before every private write.
      await this.conversations.requireMember(resolved, ctx.requester_user_id);
      return resolved;
    }
    // PRIVATE_PAIR: only into a conversation the requester belongs to (§40).
    if (!claimedConversationId) {
      throw new AppError(
        "VALIDATION_FAILED",
        "A PRIVATE_PAIR run requires the id of its private conversation.",
      );
    }
    await this.conversations.requireMember(claimedConversationId, ctx.requester_user_id);
    return claimedConversationId;
  }

  /** §120 cancellation. */
  async cancel(runId: string): Promise<void> {
    await this.lifecycle.transition(runId, "CANCELLED");
  }
}
