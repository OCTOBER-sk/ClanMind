/**
 * §158A/§159/§160 background job contracts.
 * Every job carries an idempotency key; a duplicate enqueue is a no-op
 * insert conflict, and outcome must remain logically idempotent even if the
 * queue delivers more than once (§159).
 */
export interface BackgroundJob {
  id: string;
  job_type: string;
  source_event_id: string | null;
  idempotency_key: string;
  payload: Record<string, unknown>;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED_RETRYABLE" | "FAILED_PERMANENT";
  retry_count: number;
  max_retries: number;
  next_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/** §184 job repository contract. */
export interface JobRepository {
  /** Atomically claims due jobs (SKIP LOCKED semantics server-side). */
  claimDue(limit: number, now: string): Promise<BackgroundJob[]>;
  insert(input: {
    job_type: string;
    idempotency_key: string;
    payload: Record<string, unknown>;
    source_event_id?: string | null;
    max_retries?: number;
  }): Promise<BackgroundJob>;
  markSucceeded(id: string, completedAt: string): Promise<void>;
  markFailedRetryable(
    id: string,
    lastError: string,
    nextAttemptAt: string,
    completedAt: string | null,
  ): Promise<void>;
  markFailedPermanent(id: string, lastError: string, completedAt: string): Promise<void>;
  listDeadLetters(limit: number): Promise<BackgroundJob[]>;
}

export interface JobHandler {
  readonly job_type: string;
  execute(payload: Record<string, unknown>): Promise<void>;
}
