import type { Logger } from "@clanmind/shared";
import type { BackgroundJob, JobHandler, JobRepository } from "./job.types";
import { classifyForRetry } from "./retry-policy";

/**
 * §158A/§159/§160 job runner. Claims due jobs, executes the registered
 * handler, and applies the §121 retry policy. After max_retries the job
 * transitions to FAILED_PERMANENT (dead-letter) and stays queryable (§160) —
 * it is never silently deleted.
 */
export class JobRunner {
  private readonly handlers = new Map<string, JobHandler>();

  constructor(
    private readonly jobs: JobRepository,
    private readonly log: Pick<Logger, "info" | "warn" | "error">,
  ) {}

  register(handler: JobHandler): void {
    this.handlers.set(handler.job_type, handler);
  }

  /** Runs one pass: claims up to `limit` due jobs and executes them. */
  async runOnce(limit = 10): Promise<{ ran: number; succeeded: number; failed: number }> {
    const now = new Date();
    const due = await this.jobs.claimDue(limit, now.toISOString());
    let succeeded = 0;
    let failed = 0;
    for (const job of due) {
      const outcome = await this.runJob(job, now);
      if (outcome === "SUCCEEDED") succeeded += 1;
      else failed += 1;
    }
    return { ran: due.length, succeeded, failed };
  }

  private async runJob(
    job: BackgroundJob,
    now: Date,
  ): Promise<"SUCCEEDED" | "FAILED_RETRYABLE" | "FAILED_PERMANENT"> {
    const handler = this.handlers.get(job.job_type);
    if (!handler) {
      // Unknown job types are permanent failures — retrying cannot help.
      await this.jobs.markFailedPermanent(
        job.id,
        `no handler registered for job_type=${job.job_type}`,
        now.toISOString(),
      );
      return "FAILED_PERMANENT";
    }
    try {
      await handler.execute(job.payload);
      await this.jobs.markSucceeded(job.id, now.toISOString());
      return "SUCCEEDED";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const decision = classifyForRetry(error, job.retry_count, job.max_retries);
      if (decision.kind === "PERMANENT") {
        await this.jobs.markFailedPermanent(job.id, message, now.toISOString());
        this.log.error("job.permanent_failure", {
          job_id: job.id,
          job_type: job.job_type,
          error: message,
        });
        return "FAILED_PERMANENT";
      }
      const nextAttemptAt = new Date(now.getTime() + decision.delayMs).toISOString();
      await this.jobs.markFailedRetryable(job.id, message, nextAttemptAt, null);
      this.log.warn("job.retryable_failure", {
        job_id: job.id,
        job_type: job.job_type,
        retry: job.retry_count + 1,
        next_attempt_at: nextAttemptAt,
      });
      return "FAILED_RETRYABLE";
    }
  }
}
