import { describe, expect, it } from "vitest";
import { RealtimeBroadcasterConsumer, type RealtimePort, type OutboxRow } from "../src/index";

function row(partial: Partial<OutboxRow>): OutboxRow {
  return {
    id: crypto.randomUUID(),
    event_type: "message.created",
    aggregate_type: "message",
    aggregate_id: crypto.randomUUID(),
    group_id: "g1",
    actor_id: "u1",
    payload: {},
    retry_count: 0,
    ...partial,
  };
}

describe("§124 realtime broadcaster consumer", () => {
  it("publishes GROUP events without an audience", async () => {
    const published: unknown[] = [];
    const port: RealtimePort = {
      async publish(input) {
        published.push(input);
      },
      async evict() {},
    };
    const consumer = new RealtimeBroadcasterConsumer(port, async () => undefined);
    await consumer.process(row({ payload: { visibility: "GROUP" } }));
    expect(published).toHaveLength(1);
    const first = published[0] as { visibility: string; audience_user_ids?: string[] };
    expect(first.visibility).toBe("GROUP");
    expect(first.audience_user_ids).toBeUndefined();
  });

  it("private events resolve their audience before publishing (§11.2)", async () => {
    const published: unknown[] = [];
    const port: RealtimePort = {
      async publish(input) {
        published.push(input);
      },
      async evict() {},
    };
    const consumer = new RealtimeBroadcasterConsumer(port, async () => ["u1", "u2"]);
    await consumer.process(
      row({ payload: { visibility: "PRIVATE_PAIR", private_conversation_id: "pc1" } }),
    );
    const first = published[0] as { visibility: string; audience_user_ids: string[] };
    expect(first.visibility).toBe("PRIVATE_PAIR");
    expect(first.audience_user_ids).toEqual(["u1", "u2"]);
  });

  it("member.removed evicts the member's sockets immediately (§185 #11)", async () => {
    const evictions: { group: string; user: string }[] = [];
    const port: RealtimePort = {
      async publish() {},
      async evict(group, user) {
        evictions.push({ group, user });
      },
    };
    const consumer = new RealtimeBroadcasterConsumer(port, async () => undefined);
    await consumer.process(row({ event_type: "member.removed", aggregate_id: "u9" }));
    expect(evictions).toEqual([{ group: "g1", user: "u9" }]);
  });
});
