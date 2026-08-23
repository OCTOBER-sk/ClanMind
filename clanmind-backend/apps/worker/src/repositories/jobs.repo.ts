import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditEventInput,
  AuditLog,
  BackgroundJob,
  EventOutbox,
  JobRepository,
  OutboxEventInput,
} from "@clanmind/domain";

/**
 * Supabase implementations of the §123 outbox, §99 audit log, and §158A job
 * repository. All service-layer writes flow through these so no consumer
 * depends on NOOP placeholders.
 *
 * Transaction note (§122): the ideal is the outbox insert sharing the domain
 * write's transaction. Supabase's HTTP client cannot span statements, so the
 * write paths that require atomicity (messages §122 example, ai_actions §78A)
 * use dedicated SQL functions; other Phase-A paths publish immediately after
 * the domain write within the same request.
 */
export class SupabaseOutbox implements EventOutbox {
  constructor(private readonly db: SupabaseClient) {}

  async publish(event: OutboxEventInput): Promise<void> {
    const { error } = await this.db.from("outbox_events").insert({
      event_type: event.event_type,
      aggregate_type: event.aggregate_type,
      aggregate_id: event.aggregate_id,
      group_id: event.group_id,
      actor_id: event.actor_id,
      payload: event.payload,
      status: "PENDING",
    });
    if (error) throw error;
  }
}

export class SupabaseAudit implements AuditLog {
  constructor(private readonly db: SupabaseClient) {}

  async append(event: AuditEventInput): Promise<void> {
    const { error } = await this.db.from("audit_events").insert({
      group_id: event.group_id,
      actor_user_id: event.actor_user_id,
      action_type: event.action_type,
      subject_type: event.subject_type,
      subject_id: event.subject_id,
      payload: event.payload,
      request_id: event.request_id,
    });
    if (error) throw error;
  }
}

export class SupabaseJobRepository implements JobRepository {
  constructor(private readonly db: SupabaseClient) {}

  async claimDue(limit: number, now: string): Promise<BackgroundJob[]> {
    // Atomic claim: rpc marks rows RUNNING and returns them, so concurrent
    // runners never double-execute the same job.
    const { data, error } = await this.db.rpc("claim_due_jobs", {
      p_limit: limit,
      p_now: now,
    });
    if (error) throw error;
    return (data as BackgroundJob[]) ?? [];
  }

  async insert(input: {
    job_type: string;
    idempotency_key: string;
    payload: Record<string, unknown>;
    source_event_id?: string | null;
    max_retries?: number;
  }): Promise<BackgroundJob> {
    const { data, error } = await this.db
      .from("background_jobs")
      .upsert(
        {
          job_type: input.job_type,
          idempotency_key: input.idempotency_key,
          payload: input.payload,
          source_event_id: input.source_event_id ?? null,
          max_retries: input.max_retries ?? 5,
          status: "QUEUED",
          next_attempt_at: new Date().toISOString(),
        },
        { onConflict: "job_type,idempotency_key", ignoreDuplicates: true },
      )
      .select()
      .maybeSingle();
    if (error) throw error;
    // Duplicate enqueue (§159): return the existing row shape without error.
    if (data) return data as BackgroundJob;
    const existing = await this.db
      .from("background_jobs")
      .select("*")
      .eq("job_type", input.job_type)
      .eq("idempotency_key", input.idempotency_key)
      .maybeSingle();
    if (existing.error) throw existing.error;
    return existing.data as BackgroundJob;
  }

  async markSucceeded(id: string, completedAt: string): Promise<void> {
    const { error } = await this.db
      .from("background_jobs")
      .update({ status: "SUCCEEDED", completed_at: completedAt })
      .eq("id", id);
    if (error) throw error;
  }

  async markFailedRetryable(
    id: string,
    lastError: string,
    nextAttemptAt: string,
  ): Promise<void> {
    const { error } = await this.db.rpc("mark_job_retryable", {
      p_job_id: id,
      p_last_error: lastError,
      p_next_attempt_at: nextAttemptAt,
    });
    if (error) throw error;
  }

  async markFailedPermanent(
    id: string,
    lastError: string,
    completedAt: string,
  ): Promise<void> {
    const { error } = await this.db
      .from("background_jobs")
      .update({
        status: "FAILED_PERMANENT",
        last_error: lastError,
        completed_at: completedAt,
      })
      .eq("id", id);
    if (error) throw error;
  }

  async listDeadLetters(limit: number): Promise<BackgroundJob[]> {
    const { data, error } = await this.db
      .from("background_jobs")
      .select("*")
      .eq("status", "FAILED_PERMANENT")
      .order("completed_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as BackgroundJob[]) ?? [];
  }
}

/** §158A JobQueue over background_jobs — enqueue is idempotent per key. */
export class SupabaseJobQueue {
  constructor(private readonly repo: SupabaseJobRepository) {}

  async enqueue(input: {
    job_type: string;
    idempotency_key: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.repo.insert(input);
  }
}
