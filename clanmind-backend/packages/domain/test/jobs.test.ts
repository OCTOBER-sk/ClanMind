import { describe, expect, it } from "vitest";
import { AppError } from "@clanmind/shared";
import {
  JobRunner,
  OutboxProcessor,
  classifyForRetry,
  type BackgroundJob,
  type JobHandler,
  type JobRepository,
  type OutboxRepository,
  type OutboxRow,
} from "../src/index";

const log = { info() {}, warn() {}, error() {} };

function makeJob(partial: Partial<BackgroundJob> = {}): BackgroundJob {
  return {
    id: crypto.randomUUID(),
    job_type: "test.job",
    source_event_id: null,
    idempotency_key: "k-" + Math.random().toString(36).slice(2),
    payload: {},
    status: "QUEUED",
    retry_count: 0,
    max_retries: 3,
    next_attempt_at: null,
    last_error: null,
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    ...partial,
  };
}

function makeJobRepo(due: BackgroundJob[]) {
  const calls: string[] = [];
  const repo: JobRepository = {
    async claimDue() {
      return due.splice(0, due.length);
    },
    async insert() {
      return makeJob();
    },
    async markSucceeded(id) {
      calls.push(`ok:${id}`);
    },
    async markFailedRetryable(id, err, next) {
      calls.push(`retry:${id}:${next}`);
      void err;
    },
    async markFailedPermanent(id, err) {
      calls.push(`dead:${id}`);
      void err;
    },
    async listDeadLetters() {
      return [];
    },
  };
  return { repo, calls };
}

describe("§121 retry classification", () => {
  it("auth/permission/validation errors are never retried", () => {
    for (const code of ["UNAUTHENTICATED", "FORBIDDEN", "GROUP_PERMISSION_DENIED", "VALIDATION_FAILED"] as const) {
      expect(classifyForRetry(new AppError(code, "x"), 0, 5)).toEqual({ kind: "PERMANENT" });
    }
  });

  it("generic errors retry with exponential backoff + jitter, capped", () => {
    const first = classifyForRetry(new Error("boom"), 0, 5, 1000, 60000);
    expect(first.kind).toBe("RETRYABLE");
    if (first.kind === "RETRYABLE") expect(first.delayMs).toBeGreaterThanOrEqual(1000);
    const high = classifyForRetry(new Error("boom"), 10, 20, 1000, 60000);
    if (high.kind === "RETRYABLE") expect(high.delayMs).toBeLessThanOrEqual(75000); // cap + 25% jitter headroom
  });

  it("exhausted retries become permanent", () => {
    expect(classifyForRetry(new Error("boom"), 3, 3)).toEqual({ kind: "PERMANENT" });
  });
});

describe("§158A/§159/§160 JobRunner", () => {
  it("marks a successful job SUCCEEDED", async () => {
    const job = makeJob();
    const { repo, calls } = makeJobRepo([job]);
    const runner = new JobRunner(repo, log);
    const handler: JobHandler = {
      job_type: "test.job",
      async execute() {},
    };
    runner.register(handler);
    const result = await runner.runOnce();
    expect(result).toEqual({ ran: 1, succeeded: 1, failed: 0 });
    expect(calls[0]).toBe(`ok:${job.id}`);
  });

  it("retries transient failures and schedules the next attempt", async () => {
    const job = makeJob();
    const { repo, calls } = makeJobRepo([job]);
    const runner = new JobRunner(repo, log);
    let attempts = 0;
    runner.register({
      job_type: "test.job",
      async execute() {
        attempts += 1;
        throw new Error("transient");
      },
    });
    const result = await runner.runOnce();
    expect(result.failed).toBe(1);
    expect(attempts).toBe(1);
    expect(calls[0]).toMatch(new RegExp(`^retry:${job.id}:`));
  });

  it("dead-letters immediately on permission errors", async () => {
    const job = makeJob();
    const { repo, calls } = makeJobRepo([job]);
    const runner = new JobRunner(repo, log);
    runner.register({
      job_type: "test.job",
      async execute() {
        throw new AppError("GROUP_PERMISSION_DENIED", "no");
      },
    });
    await runner.runOnce();
    expect(calls[0]).toBe(`dead:${job.id}`);
  });

  it("dead-letters unknown job types (retrying cannot help)", async () => {
    const job = makeJob({ job_type: "missing.handler" });
    const { repo, calls } = makeJobRepo([job]);
    const runner = new JobRunner(repo, log);
    await runner.runOnce();
    expect(calls[0]).toBe(`dead:${job.id}`);
  });
});

describe("§124 OutboxProcessor", () => {
  function makeOutboxRepo(rows: OutboxRow[]) {
    const marks: string[] = [];
    const repo: OutboxRepository = {
      async fetchPending() {
        return rows.splice(0, rows.length);
      },
      async markProcessed(id) {
        marks.push(`processed:${id}`);
      },
      async markFailed(id, retryCount) {
        marks.push(`failed:${id}:${retryCount}`);
      },
    };
    return { repo, marks };
  }

  function row(event_type: string): OutboxRow {
    return {
      id: crypto.randomUUID(),
      event_type,
      aggregate_type: "group",
      aggregate_id: crypto.randomUUID(),
      group_id: null,
      actor_id: null,
      payload: {},
      retry_count: 0,
    };
  }

  it("delivers to matching consumers and marks processed", async () => {
    const r = row("group.created");
    const { repo, marks } = makeOutboxRepo([r]);
    const seen: string[] = [];
    const processor = new OutboxProcessor(repo, log);
    processor.register({
      name: "test-consumer",
      handles: (t) => t.startsWith("group."),
      async process(e) {
        seen.push(e.event_type);
      },
    });
    const result = await processor.runOnce();
    expect(result.processed).toBe(1);
    expect(seen).toEqual(["group.created"]);
    expect(marks[0]).toBe(`processed:${r.id}`);
  });

  it("a failing consumer leaves the row pending with incremented retries", async () => {
    const r = row("member.joined");
    const { repo, marks } = makeOutboxRepo([r]);
    const processor = new OutboxProcessor(repo, log);
    processor.register({
      name: "failing",
      handles: () => true,
      async process() {
        throw new Error("consumer down");
      },
    });
    const result = await processor.runOnce();
    expect(result.failed).toBe(1);
    expect(marks[0]).toBe(`failed:${r.id}:1`);
  });

  it("events with no consumers still mark processed (nothing to do)", async () => {
    const r = row("presence.typing.started");
    const { repo, marks } = makeOutboxRepo([r]);
    const processor = new OutboxProcessor(repo, log);
    const result = await processor.runOnce();
    expect(result.processed).toBe(1);
    expect(marks[0]).toBe(`processed:${r.id}`);
  });
});
