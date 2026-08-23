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
      body: JSON.stringify({ name: "Privacy Team" }),
    },
    TEST_ENV,
  );
  return (await res.json()) as Group;
}

describe("§2.4 private conversations", () => {
  it("sends a PRIVATE_PAIR message visible only via conversation ACL (§11.2)", async () => {
    const { services, messageRows, realtimePublishes, memberRows } = makeTestServices();
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

    const res = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          client_message_id: "priv-1",
          body: "just between us",
          private_to: U.MEMBER,
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const message = (await res.json()) as Message;
    expect(message.visibility).toBe("PRIVATE_PAIR");
    expect(message.private_conversation_id).toBeTruthy();

    // The realtime fan-out carried only the two participants (§11.2).
    const published = realtimePublishes.find((p) => p.event_type === "message.created");
    expect(published?.visibility).toBe("PRIVATE_PAIR");
    expect(published?.audience_user_ids).toEqual([U.OWNER, U.MEMBER]);

    // Group listings never include private rows (§11.2 enforced in queries).
    const list = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      { headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    const page = (await list.json()) as { items: Message[] };
    expect(page.items.find((m) => m.id === message.id)).toBeUndefined();
    expect(messageRows).toHaveLength(1);
  });

  it("sends a PRIVATE_AI message to Odin with the requester as sole audience", async () => {
    const { services, realtimePublishes } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroup(app);
    const res = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          client_message_id: "priv-ai-1",
          body: "odin, privately: ...",
          private_to: "ai",
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const message = (await res.json()) as Message;
    expect(message.visibility).toBe("PRIVATE_AI");
    const published = realtimePublishes.find((p) => p.event_type === "message.created");
    expect(published?.visibility).toBe("PRIVATE_AI");
    expect(published?.audience_user_ids).toEqual([U.OWNER]);
  });

  it("reuses one conversation per pair", async () => {
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
    const send = async (cmid: string, to: string): Promise<Message> => {
      const r = await app.request(
        `/api/v1/groups/${group.id}/messages`,
        {
          method: "POST",
          headers: jsonHeaders(await tokenFor(U.OWNER)),
          body: JSON.stringify({ client_message_id: cmid, body: "x", private_to: to }),
        },
        TEST_ENV,
      );
      return (await r.json()) as Message;
    };
    const m1 = await send("pv-a", U.MEMBER);
    const m2 = await send("pv-b", U.MEMBER);
    expect(m2.private_conversation_id).toBe(m1.private_conversation_id);
  });
});
