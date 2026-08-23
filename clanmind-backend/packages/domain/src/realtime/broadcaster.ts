import type { RealtimeEnvelope } from "@clanmind/contracts";
import type { OutboxConsumer, OutboxRow } from "../jobs/outbox-processor";

/**
 * Low-latency realtime port backed by the Group Durable Object room.
 * The worker implementation resolves the DO stub from the binding.
 */
export interface RealtimePort {
  publish(input: {
    group_id: string;
    event_type: RealtimeEnvelope["event_type"] | (string & {});
    actor_id?: string | null;
    project_id?: string | null;
    visibility?: RealtimeEnvelope["visibility"];
    audience_user_ids?: string[];
    payload: Record<string, unknown>;
  }): Promise<void>;
  evict(groupId: string, userId: string): Promise<void>;
}

export const NOOP_REALTIME: RealtimePort = {
  async publish() {},
  async evict() {},
};

/**
 * §124 "realtime broadcaster" outbox consumer: turns durable outbox rows
 * into room fan-out. `member.removed` additionally evicts the removed
 * member's sockets immediately (§185 #11). The DO deduplicates by event_id,
 * so the REST fast-path and this consumer can both publish safely.
 */
export class RealtimeBroadcasterConsumer implements OutboxConsumer {
  readonly name = "realtime-broadcaster";

  constructor(
    private readonly realtime: RealtimePort,
    private readonly resolveAudience: (
      row: OutboxRow,
    ) => Promise<string[] | undefined>,
  ) {}

  handles(): boolean {
    return true;
  }

  async process(row: OutboxRow): Promise<void> {
    const visibility = this.visibilityOf(row);
    await this.realtime.publish({
      group_id: row.group_id ?? "",
      event_type: row.event_type,
      actor_id: row.actor_id,
      visibility,
      audience_user_ids:
        visibility === "GROUP" ? undefined : await this.resolveAudience(row),
      payload: { ...row.payload, outbox_id: row.id },
    });
    if (row.event_type === "member.removed") {
      const removed = row.aggregate_id;
      if (row.group_id && removed) {
        await this.realtime.evict(row.group_id, removed);
      }
    }
  }

  private visibilityOf(row: OutboxRow): RealtimeEnvelope["visibility"] {
    const v = row.payload["visibility"];
    if (v === "PRIVATE_PAIR" || v === "PRIVATE_AI") return v;
    return "GROUP";
  }
}
