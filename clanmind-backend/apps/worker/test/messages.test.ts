import { describe, expect, it } from "vitest";
import type { Group, Message } from "@clanmind/domain";
import { createApp } from "../src/app";
import { TEST_ENV, U, makeTestServices, tokenFor } from "./utils";

function jsonHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

async function setupGroup(app: ReturnType<typeof createApp>): Promise<Group> {
  const res = await app.request(
    "/api/v1/groups",
    {
      method: "POST",
      headers: jsonHeaders(await tokenFor(U.OWNER)),
      body: JSON.stringify({ name: "Chat Team" }),
    },
    TEST_ENV,
  );
  return (await res.json()) as Group;
}

describe("§105 message endpoints", () => {
  it("sends a message; duplicate client_message_id is one logical operation (§19)", async () => {
    const { services, messageRows } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroup(app);
    const body = { client_message_id: "cmid-1", body: "Hello team" };

    const first = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      { method: "POST", headers: jsonHeaders(await tokenFor(U.OWNER)), body: JSON.stringify(body) },
      TEST_ENV,
    );
    expect(first.status).toBe(201);
    const sent = (await first.json()) as Message;
    expect(sent.server_sequence).toBeGreaterThan(0);

    const dup = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      { method: "POST", headers: jsonHeaders(await tokenFor(U.OWNER)), body: JSON.stringify(body) },
      TEST_ENV,
    );
    expect(dup.status).toBe(201);
    expect(((await dup.json()) as Message).id).toBe(sent.id);
    expect(messageRows).toHaveLength(1);
  });

  it("fans message.created out to the realtime room after persistence (§122)", async () => {
    const { services, realtimePublishes } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroup(app);
    await app.request(
      `/api/v1/groups/${group.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ client_message_id: "cmid-rt", body: "realtime me" }),
      },
      TEST_ENV,
    );
    expect(
      realtimePublishes.filter(
        (p) => p.event_type === "message.created" && p.group_id === group.id,
      ),
    ).toHaveLength(1);
  });

  it("outsiders cannot send into a group (§86)", async () => {
    const { services } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroup(app);
    const res = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OUTSIDER)),
        body: JSON.stringify({ client_message_id: "cmid-x", body: "sneak" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it("rejects oversized bodies (§178: 8000 chars)", async () => {
    const { services } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroup(app);
    const res = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ client_message_id: "cmid-big", body: "x".repeat(8001) }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it("sender edits (revision recorded) and soft-deletes; others cannot (§12)", async () => {
    const { services, memberRows } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroup(app);
    memberRows.push({
      group_id: group.id,
      user_id: U.MEMBER,
      role: "MEMBER",
      joined_at: new Date().toISOString(),
      removed_at: null,
      group_display_name: null,
      group_avatar_object_id: null,
    });

    const sent = (await (
      await app.request(
        `/api/v1/groups/${group.id}/messages`,
        {
          method: "POST",
          headers: jsonHeaders(await tokenFor(U.OWNER)),
          body: JSON.stringify({ client_message_id: "cmid-2", body: "original" }),
        },
        TEST_ENV,
      )
    ).json()) as Message;

    const foreignEdit = await app.request(
      `/api/v1/messages/${sent.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(await tokenFor(U.MEMBER)),
        body: JSON.stringify({ body: "hacked" }),
      },
      TEST_ENV,
    );
    expect(foreignEdit.status).toBe(403);

    const edited = await app.request(
      `/api/v1/messages/${sent.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ body: "updated" }),
      },
      TEST_ENV,
    );
    expect(edited.status).toBe(200);
    expect(((await edited.json()) as Message).edited_at).toBeTruthy();

    const deleted = await app.request(
      `/api/v1/messages/${sent.id}`,
      { method: "DELETE", headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(deleted.status).toBe(200);
    // Tombstone retained (§12.2): the row still exists with deleted_at set.
    const listed = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      { headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    const page = (await listed.json()) as { items: Message[] };
    expect(page.items.find((m) => m.id === sent.id)?.deleted_at).toBeTruthy();
  });

  it("mention tokens resolve server-side to member ids (§14.1)", async () => {
    const { services, memberRows } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroup(app);
    memberRows.push({
      group_id: group.id,
      user_id: U.MEMBER,
      role: "MEMBER",
      joined_at: new Date().toISOString(),
      removed_at: null,
      group_display_name: "Arun",
      group_avatar_object_id: null,
    });

    const res = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          client_message_id: "cmid-3",
          body: "@Arun can you check this?",
          mention_tokens: ["Arun"],
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    // The in-memory repo receives resolved ids; unknown tokens are dropped.
    const sent = (await res.json()) as Message;
    expect(sent.body).toContain("@Arun");
  });

  it("lists messages newest-first with cursor pagination (§156)", async () => {
    const { services } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroup(app);
    for (let i = 1; i <= 5; i++) {
      await app.request(
        `/api/v1/groups/${group.id}/messages`,
        {
          method: "POST",
          headers: jsonHeaders(await tokenFor(U.OWNER)),
          body: JSON.stringify({ client_message_id: `cmid-p${i}`, body: `m${i}` }),
        },
        TEST_ENV,
      );
    }
    const page1 = (await (
      await app.request(
        `/api/v1/groups/${group.id}/messages?limit=2`,
        { headers: jsonHeaders(await tokenFor(U.OWNER)) },
        TEST_ENV,
      )
    ).json()) as { items: Message[]; next_cursor: string | null };
    expect(page1.items).toHaveLength(2);
    // First page is the newest window, ordered chronologically inside it.
    expect(page1.items[0]?.body).toBe("m4");
    expect(page1.items[1]?.body).toBe("m5");
    expect(page1.next_cursor).toBeTruthy();

    const page2 = (await (
      await app.request(
        `/api/v1/groups/${group.id}/messages?limit=2&before=${page1.next_cursor}`,
        { headers: jsonHeaders(await tokenFor(U.OWNER)) },
        TEST_ENV,
      )
    ).json()) as { items: Message[]; next_cursor: string | null };
    expect(page2.items[0]?.body).toBe("m2");
    expect(page2.items[1]?.body).toBe("m3");
  });
});
