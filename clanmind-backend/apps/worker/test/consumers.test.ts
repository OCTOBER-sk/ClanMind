import { describe, expect, it } from "vitest";
import {
  ActivityBuilderConsumer,
  NotificationService,
  NotificationWorkerConsumer,
  type NotificationRepository,
  type OutboxRow,
} from "@clanmind/domain";
import { TEST_ENV, U, makeTestServices } from "./utils";
import { createApp } from "../src/app";

const U1 = "00000000-0000-4000-8000-000000000001";
const U2 = "00000000-0000-4000-8000-000000000002";

function row(partial: Partial<OutboxRow>): OutboxRow {
  return {
    id: crypto.randomUUID(),
    event_type: "message.created",
    aggregate_type: "message",
    aggregate_id: crypto.randomUUID(),
    group_id: "g1",
    actor_id: U1,
    payload: {},
    retry_count: 0,
    ...partial,
  };
}

function notifRepo(inserted: { recipient_user_id: string; category: string }[]): NotificationRepository {
  return {
    async insert(input) {
      inserted.push({ recipient_user_id: input.recipient_user_id, category: input.category });
      return input as never;
    },
    async listForUser() {
      return [];
    },
    async markRead() {},
    async preference() {
      return null;
    },
  };
}

describe("§95A notification targeting", () => {
  it("a PRIVATE_AI AI_RESPONSE notifies ONLY the owning requester", async () => {
    const inserted: { recipient_user_id: string; category: string }[] = [];
    const consumer = new NotificationWorkerConsumer(new NotificationService(notifRepo(inserted)), () => []);

    await consumer.process(
      row({
        event_type: "ai.response.completed",
        aggregate_type: "ai_run",
        actor_id: U1,
        payload: { visibility: "PRIVATE_AI", run_id: "r1" },
      }),
    );
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toEqual({ recipient_user_id: U1, category: "AI_RESPONSE" });

    // A GROUP completion still targets just the requester (not the Group).
    inserted.length = 0;
    await consumer.process(
      row({
        event_type: "ai.response.completed",
        aggregate_type: "ai_run",
        actor_id: U2,
        payload: { visibility: "GROUP", run_id: "r2" },
      }),
    );
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.recipient_user_id).toBe(U2);
  });
});

describe("§98A activity builder attribution", () => {
  it("AI-run events attribute to the agent; private events never land; humans stay USER", async () => {
    const state = makeTestServices();
    const consumer = new ActivityBuilderConsumer(state.services.activity);

    await consumer.process(
      row({
        event_type: "ai.response.completed",
        aggregate_type: "ai_run",
        actor_id: U1, // requester — must NOT become actor_user_id
        payload: { visibility: "GROUP" },
      }),
    );
    const aiRow = state.activityRows.at(-1) as Record<string, unknown>;
    expect(aiRow["actor_type"]).toBe("AI");
    expect(aiRow["actor_ai_id"]).toBe(U1);
    expect(aiRow["actor_user_id"]).toBeNull();

    const before = state.activityRows.length;
    await consumer.process(
      row({ payload: { visibility: "PRIVATE_AI" }, aggregate_type: "ai_run" }),
    );
    expect(state.activityRows.length).toBe(before);

    await consumer.process(
      row({
        event_type: "task.created",
        aggregate_type: "task",
        actor_id: U2,
        payload: { visibility: "GROUP" },
      }),
    );
    const humanRow = state.activityRows.at(-1) as Record<string, unknown>;
    expect(humanRow["actor_type"]).toBe("USER");
    expect(humanRow["actor_user_id"]).toBe(U2);
    expect(humanRow["actor_ai_id"]).toBeNull();
  });
});

void TEST_ENV;
void createApp;
