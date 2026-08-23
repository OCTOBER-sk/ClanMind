import { describe, expect, it } from "vitest";
import type { Group, GroupMember, Message } from "@clanmind/domain";
import { createApp } from "../src/app";
import { enforceRateLimit } from "../src/ai";
import { TEST_ENV, U, makeTestServices, tokenFor } from "./utils";

function jsonHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

describe("§13/§125 search ACL", () => {
  it("a member cannot search another pair's private content even with include_private=true; a participant can", async () => {
    const state = makeTestServices();
    const app = createApp(state.services);
    const owner = await createGroup(app);

    // Add MEMBER (B) and ADMIN (C) to the group.
    addMember(state.memberRows, owner.id, U.MEMBER, "MEMBER");
    addMember(state.memberRows, owner.id, U.ADMIN, "ADMIN");

    // A(OWNER) ↔ C(ADMIN) private pair containing the secret marker.
    const priv = await app.request(
      `/api/v1/groups/${owner.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          client_message_id: "cmid-priv-1",
          body: "confidential unicorn negotiations",
          private_to: U.ADMIN,
        }),
      },
      TEST_ENV,
    );
    expect(priv.status).toBe(201);
    const privateMessage = (await priv.json()) as Message;
    expect(privateMessage.visibility).toBe("PRIVATE_PAIR");

    // Shared message for contrast.
    await app.request(
      `/api/v1/groups/${owner.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ client_message_id: "cmid-pub-1", body: "public giraffe news" }),
      },
      TEST_ENV,
    );

    // B (non-participant) with include_private=true must NOT see private rows.
    const bSearch = await app.request(
      `/api/v1/groups/${owner.id}/messages/search?q=unicorn&include_private=true`,
      { headers: jsonHeaders(await tokenFor(U.MEMBER)) },
      TEST_ENV,
    );
    expect(bSearch.status).toBe(200);
    expect(((await bSearch.json()) as { items: Message[] }).items).toHaveLength(0);

    // C (participant) CAN find it with include_private=true.
    const cSearch = await app.request(
      `/api/v1/groups/${owner.id}/messages/search?q=unicorn&include_private=true`,
      { headers: jsonHeaders(await tokenFor(U.ADMIN)) },
      TEST_ENV,
    );
    expect(cSearch.status).toBe(200);
    const cItems = ((await cSearch.json()) as { items: Message[] }).items;
    expect(cItems.map((m) => m.id)).toContain(privateMessage.id);

    // And B still sees shared content.
    const bPublic = await app.request(
      `/api/v1/groups/${owner.id}/messages/search?q=giraffe`,
      { headers: jsonHeaders(await tokenFor(U.MEMBER)) },
      TEST_ENV,
    );
    expect(((await bPublic.json()) as { items: Message[] }).items).toHaveLength(1);
  });
});

describe("§39B pins", () => {
  it("pinning a private message is rejected; the Group pin list is GROUP-only", async () => {
    const state = makeTestServices();
    const app = createApp(state.services);
    const group = await createGroup(app);
    addMember(state.memberRows, group.id, U.MEMBER, "MEMBER");

    // Private OWNER→MEMBER message.
    const privRes = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          client_message_id: "cmid-pin-priv",
          body: "private pin bait",
          private_to: U.MEMBER,
        }),
      },
      TEST_ENV,
    );
    const privateMessage = (await privRes.json()) as Message;

    const pinPrivate = await app.request(
      `/api/v1/messages/${privateMessage.id}/pin`,
      { method: "POST", headers: jsonHeaders(await tokenFor(U.MEMBER)) },
      TEST_ENV,
    );
    expect(pinPrivate.status).toBe(403);

    // Even a legacy/direct-inserted pin row for a private message never
    // surfaces in the Group pins list (visibility=GROUP filter §39B).
    await app.request(
      `/api/v1/groups/${group.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ client_message_id: "cmid-pin-group", body: "group pin me" }),
      },
      TEST_ENV,
    );
    const groupMessage = state.messageRows.find((m) => m.client_message_id === "cmid-pin-group")!;
    const pinned = await app.request(
      `/api/v1/messages/${groupMessage.id}/pin`,
      { method: "POST", headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(pinned.status).toBe(200);

    // Simulate a stray private pin row written out-of-band.
    state.pinRows.push({
      group_id: group.id,
      project_id: null,
      message_id: privateMessage.id,
      pinned_by: U.MEMBER,
      pinned_at: new Date().toISOString(),
      unpinned_at: null,
    });

    const list = await app.request(
      `/api/v1/groups/${group.id}/pins`,
      { headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    const items = ((await list.json()) as { items: { message_id: string }[] }).items;
    expect(items.map((p) => p.message_id)).toEqual([groupMessage.id]);
  });
});

describe("§91/§178 rate limiting", () => {
  it("returns 429 with retry_after_seconds once the fixed window is exhausted", () => {
    // Fresh key — buckets are process-wide by design.
    const key = `unit:${U.OUTSIDER}`;
    enforceRateLimit(key, 2, 60_000);
    enforceRateLimit(key, 2, 60_000); // bucket now full

    let caught: unknown = null;
    try {
      enforceRateLimit(key, 2, 60_000);
    } catch (error) {
      caught = error;
    }
    expect((caught as { code?: string }).code).toBe("RATE_LIMITED");
    expect((caught as { status?: number }).status).toBe(429);
    expect(
      (caught as { details?: { retry_after_seconds?: number } }).details?.retry_after_seconds,
    ).toBeGreaterThan(0);
  });

  it("message POST returns the 429 envelope after the per-user cap (§178: 30/min)", async () => {
    const state = makeTestServices();
    // Tighten the limit for a fast deterministic test.
    state.services.limits.messages_per_minute_per_user = 2;
    const app = createApp(state.services);
    const group = await createGroup(app);
    // Distinct sender so module-level buckets from sibling tests don't leak in.
    addMember(state.memberRows, group.id, U.ADMIN, "MEMBER");

    for (let i = 1; i <= 2; i++) {
      const ok = await app.request(
        `/api/v1/groups/${group.id}/messages`,
        {
          method: "POST",
          headers: jsonHeaders(await tokenFor(U.ADMIN)),
          body: JSON.stringify({ client_message_id: `cmid-rl-${i}`, body: `m${i}` }),
        },
        TEST_ENV,
      );
      expect(ok.status).toBe(201);
    }
    const limited = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.ADMIN)),
        body: JSON.stringify({ client_message_id: "cmid-rl-3", body: "m3" }),
      },
      TEST_ENV,
    );
    expect(limited.status).toBe(429);
    const body = (await limited.json()) as { error: { code: string; details?: unknown } };
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});

// --- helpers -------------------------------------------------------------

async function createGroup(app: ReturnType<typeof createApp>): Promise<Group> {
  const res = await app.request(
    "/api/v1/groups",
    {
      method: "POST",
      headers: jsonHeaders(await tokenFor(U.OWNER)),
      body: JSON.stringify({ name: "ACL Team" }),
    },
    TEST_ENV,
  );
  return (await res.json()) as Group;
}

function addMember(
  memberRows: GroupMember[],
  groupId: string,
  userId: string,
  role: "ADMIN" | "MEMBER",
): void {
  memberRows.push({
    group_id: groupId,
    user_id: userId,
    role,
    joined_at: new Date().toISOString(),
    removed_at: null,
    group_display_name: null,
    group_avatar_object_id: null,
  });
}
