import { describe, expect, it } from "vitest";
import {
  ActivityBuilderConsumer,
  ActivityService,
  NotificationService,
  NotificationWorkerConsumer,
  SearchService,
  type ActivityRepository,
  type MessageSearchRepository,
  type NotificationRow,
  type NotificationRepository,
  type OutboxRow,
} from "../src/index";
import type { Message } from "../src/messages/message.service";

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

function notificationRepo(prefs: Record<string, boolean> = {}) {
  const rows: NotificationRow[] = [];
  const r: NotificationRepository = {
    async insert(input) {
      const created: NotificationRow = {
        ...input,
        id: crypto.randomUUID(),
        read_at: null,
        created_at: new Date().toISOString(),
      };
      rows.push(created);
      return created;
    },
    async listForUser(userId, limit, unreadOnly) {
      return rows
        .filter((n) => n.recipient_user_id === userId && (!unreadOnly || !n.read_at))
        .slice(0, limit);
    },
    async markRead(userId, notificationId) {
      const n = rows.find((x) => x.id === notificationId && x.recipient_user_id === userId);
      if (n) n.read_at = new Date().toISOString();
    },
    async preference(userId, groupId, category) {
      const key = `${userId}:${groupId}:${category}`;
      if (!(key in prefs)) return null;
      return { in_app_enabled: prefs[key]!, email_enabled: false };
    },
  };
  return { rows, r };
}

function activityRepo() {
  const rows: import("../src/index").ActivityRow[] = [];
  const r: ActivityRepository = {
    async insert(input) {
      const created = { ...input, id: crypto.randomUUID(), occurred_at: new Date().toISOString() };
      rows.push(created);
      return created;
    },
    async listByGroup(groupId, limit) {
      return rows.filter((a) => a.group_id === groupId).slice(0, limit);
    },
    async listByProject() {
      return [];
    },
  };
  return { rows, r };
}

describe("§13 search", () => {
  it("delegates with trimmed queries and rejects empty ones", async () => {
    const searches: unknown[] = [];
    const repo: MessageSearchRepository = {
      async search(input) {
        searches.push(input);
        return [] as Message[];
      },
    };
    const svc = new SearchService(repo);
    await svc.search({ ...baseSearch(), query: "  postgres  " });
    await svc.search({ ...baseSearch(), query: "   " });
    expect(searches).toHaveLength(1);
    expect((searches[0] as { query: string }).query).toBe("postgres");
  });

  function baseSearch() {
    return {
      group_id: "g1",
      requester_user_id: U1,
      query: "x",
      limit: 20,
    };
  }
});

describe("§95A/§143 notifications", () => {
  it("creates exactly one row per recipient for a semantic event", async () => {
    const { rows, r } = notificationRepo();
    const svc = new NotificationService(r);
    const created = await svc.notify({
      recipients: [U2, U2, U1],
      group_id: "g1",
      category: "MENTION",
      subject_type: "message",
      subject_id: "m1",
      title: "You were mentioned",
      delivered_realtime: true,
    });
    expect(created).toHaveLength(2);
    expect(rows).toHaveLength(2);
    expect(rows.every((n) => n.delivery_state === "DELIVERED_REALTIME")).toBe(true);
  });

  it("suppresses by preference (§95A delivery_state)", async () => {
    const { rows, r } = notificationRepo({ [`${U1}:g1:MENTION`]: false });
    const svc = new NotificationService(r);
    await svc.notify({
      recipients: [U1],
      group_id: "g1",
      category: "MENTION",
      subject_type: "message",
      subject_id: "m1",
      title: "x",
    });
    expect(rows[0]?.delivery_state).toBe("SUPPRESSED_BY_PREFERENCE");
  });

  it("private messages notify only the conversation audience (§2.4)", async () => {
    const { rows, r } = notificationRepo();
    const consumer = new NotificationWorkerConsumer(new NotificationService(r), () => []);
    await consumer.process(
      row({
        payload: { visibility: "PRIVATE_PAIR", audience_user_ids: [U1, U2] },
      }),
    );
    expect(rows).toHaveLength(1);
    // sender (actor U1) is not notified about their own private message
    expect(rows[0]?.recipient_user_id).toBe(U2);
    expect(rows[0]?.category).toBe("PRIVATE_MESSAGE");
  });

  it("public mentions notify the mentioned members", async () => {
    const { rows, r } = notificationRepo();
    const consumer = new NotificationWorkerConsumer(
      new NotificationService(r),
      (r2) => (r2.payload["mentioned"] as string[] | undefined) ?? [],
    );
    await consumer.process(row({ payload: { visibility: "GROUP", mentioned: [U2] } }));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.category).toBe("MENTION");
    expect(rows[0]?.recipient_user_id).toBe(U2);
  });
});

describe("§98A activity builder", () => {
  it("renders public events once and skips private + ephemeral ones", async () => {
    const { rows, r } = activityRepo();
    const consumer = new ActivityBuilderConsumer(new ActivityService(r));
    await consumer.process(row({ event_type: "message.created", payload: { visibility: "GROUP" } }));
    await consumer.process(
      row({ event_type: "message.created", payload: { visibility: "PRIVATE_AI" } }),
    );
    await consumer.process(row({ event_type: "presence.typing.started" }));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.summary).toBe("New message");
    expect(rows[0]?.visibility).toBe("GROUP");
  });

  it("project-scoped events record PROJECT visibility", async () => {
    const { rows, r } = activityRepo();
    const consumer = new ActivityBuilderConsumer(new ActivityService(r));
    await consumer.process(
      row({ event_type: "task.created", payload: { project_id: "p1", visibility: "GROUP" } }),
    );
    expect(rows[0]?.visibility).toBe("PROJECT");
  });
});
