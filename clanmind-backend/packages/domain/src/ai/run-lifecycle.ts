import type { AiRunStatus } from "@clanmind/contracts";
import { AppError } from "@clanmind/shared";

/** §52 ai_runs row. */
export interface AiRun {
  id: string;
  group_id: string;
  project_id: string | null;
  requester_user_id: string;
  ai_agent_id: string;
  mode: "ASSIST" | "FACILITATE" | "ACT";
  visibility: "GROUP" | "PRIVATE_PAIR" | "PRIVATE_AI";
  provider_config_id: string | null;
  model_id: string;
  status: AiRunStatus;
  input_message_id: string | null;
  started_at: string;
  completed_at: string | null;
  failure_code: string | null;
  usage_json: Record<string, unknown> | null;
}

export interface AiRunRepository {
  insert(input: {
    group_id: string;
    project_id: string | null;
    requester_user_id: string;
    ai_agent_id: string;
    mode: AiRun["mode"];
    visibility: AiRun["visibility"];
    model_id: string;
    input_message_id: string | null;
  }): Promise<AiRun>;
  findById(id: string): Promise<AiRun | null>;
  setStatus(id: string, status: AiRunStatus, extra?: { failure_code?: string | null; usage_json?: Record<string, unknown> | null }): Promise<void>;
  listByGroup(groupId: string, limit: number): Promise<AiRun[]>;
}

/**
 * §52 canonical status machine:
 * QUEUED → RUNNING → WAITING_TOOL ⇄ RUNNING → STREAMING → COMPLETED
 * with FAILED / CANCELLED from any active state.
 */
const TRANSITIONS: Record<AiRunStatus, AiRunStatus[]> = {
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["WAITING_TOOL", "STREAMING", "COMPLETED", "FAILED", "CANCELLED"],
  WAITING_TOOL: ["RUNNING", "STREAMING", "FAILED", "CANCELLED"],
  STREAMING: ["WAITING_TOOL", "COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransition(from: AiRunStatus, to: AiRunStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** §120 cancellation must propagate to provider/tool requests where supported. */
export class RunLifecycle {
  constructor(private readonly runs: AiRunRepository) {}

  async transition(runId: string, to: AiRunStatus, extra?: { failure_code?: string | null }): Promise<void> {
    const run = await this.runs.findById(runId);
    if (!run) throw new AppError("NOT_FOUND", "Run not found.");
    if (!canTransition(run.status, to)) {
      throw new AppError("CONFLICT", `Cannot transition ${run.status} → ${to}.`);
    }
    await this.runs.setStatus(runId, to, {
      ...extra,
      ...(to === "COMPLETED" || to === "FAILED" || to === "CANCELLED"
        ? { usage_json: run.usage_json }
        : {}),
    });
  }
}

/**
 * §92/§93/§94 usage ledger + quota enforcement.
 */
export interface UsageEvent {
  group_id: string;
  user_id: string | null;
  category: string;
  provider?: string | null;
  model?: string | null;
  quantity: number;
  unit: string;
  estimated_cost?: number | null;
}

export interface UsageRepository {
  record(event: UsageEvent): Promise<void>;
  sumGroupUsage(groupId: string, category: string, since: string): Promise<number>;
  quotaLimit(groupId: string, category: string, defaultLimit: number): Promise<number>;
}

/** §94 exact exhaustion contract. */
export interface QuotaExhaustion {
  code: "APPLICATION_AI_QUOTA_EXHAUSTED";
  can_continue_with_byok: boolean;
}

export class UsageService {
  constructor(
    private readonly usage: UsageRepository,
    private readonly defaults: { ai_requests_per_period: number; period_ms: number },
  ) {}

  async record(event: UsageEvent): Promise<void> {
    await this.usage.record(event);
  }

  /** §130 pre-run check: estimate + quota before any provider call. */
  async checkQuota(input: {
    group_id: string;
    byokConfigured: boolean;
    now?: Date;
  }): Promise<{ allowed: true } | { allowed: false; exhaustion: QuotaExhaustion }> {
    const now = input.now ?? new Date();
    const since = new Date(now.getTime() - this.defaults.period_ms).toISOString();
    const used = await this.usage.sumGroupUsage(input.group_id, "ai_requests", since);
    const limit = await this.usage.quotaLimit(
      input.group_id,
      "ai_requests",
      this.defaults.ai_requests_per_period,
    );
    if (used >= limit) {
      return {
        allowed: false,
        exhaustion: {
          code: "APPLICATION_AI_QUOTA_EXHAUSTED",
          can_continue_with_byok: input.byokConfigured,
        },
      };
    }
    return { allowed: true };
  }

  exhaustionResponse(exhaustion: QuotaExhaustion): { status: number; body: QuotaExhaustion } {
    return { status: 402, body: exhaustion };
  }
}
