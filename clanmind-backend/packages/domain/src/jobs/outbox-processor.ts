import type { Logger } from "@clanmind/shared";

/**
 * §124 event consumers. Each consumer is independently testable; the
 * processor dispatches pending outbox rows by event_type and marks them
 * processed only after every registered consumer for that event succeeds.
 * Consumers register per phase: realtime broadcaster (B4), notification
 * worker (B10), activity builder (B11), memory worker (D2), etc.
 */
export interface OutboxRow {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  group_id: string | null;
  actor_id: string | null;
  payload: Record<string, unknown>;
  retry_count: number;
}

export interface OutboxRepository {
  fetchPending(limit: number): Promise<OutboxRow[]>;
  markProcessed(id: string, processedAt: string): Promise<void>;
  markFailed(id: string, retryCount: number): Promise<void>;
}

export type OutboxConsumer = {
  readonly name: string;
  handles(eventType: string): boolean;
  process(row: OutboxRow): Promise<void>;
};

export class OutboxProcessor {
  private readonly consumers: OutboxConsumer[] = [];

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly log: Pick<Logger, "info" | "warn">,
  ) {}

  register(consumer: OutboxConsumer): void {
    this.consumers.push(consumer);
  }

  async runOnce(limit = 50): Promise<{ processed: number; failed: number }> {
    const rows = await this.outbox.fetchPending(limit);
    let processed = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const matching = this.consumers.filter((c) => c.handles(row.event_type));
        for (const consumer of matching) {
          await consumer.process(row);
        }
        await this.outbox.markProcessed(row.id, new Date().toISOString());
        processed += 1;
      } catch (error) {
        // Failed consumers leave the row pending with an incremented retry
        // count so the next pass retries (§123 retry_count).
        await this.outbox.markFailed(row.id, row.retry_count + 1);
        failed += 1;
        this.log.warn("outbox.consumer_failed", {
          event_id: row.id,
          event_type: row.event_type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return { processed, failed };
  }
}
