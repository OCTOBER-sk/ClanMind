import { describe, expect, it } from "vitest";
import type { Group, Message } from "@clanmind/domain";
import { createApp } from "../src/app";
import { TEST_ENV, U, makeTestServices, tokenFor } from "./utils";

/**
 * H2 regression (BACKEND_DEEP_AUDIT.md): the reactions path skipped the
 * §86 Group-membership link entirely — `requireReadable` returns GROUP rows
 * "membership checked by caller context", but neither the engagement handler
 * nor the WS room ever checked. Any authenticated user who learned a message
 * UUID could react outside their Group; removed members kept reacting
 * forever. Per §86/§187 every reaction WRITE now verifies ACTIVE membership
 * of the message's Group first (GROUP and private visibility alike).
 */

function jsonHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

async function setupGroupWithMessage(app: ReturnType<typeof createApp>): Promise<Group> {
  const res = await app.request(
    "/api/v1/groups",
    {
      method: "POST",
      headers: jsonHeaders(await tokenFor(U.OWNER)),
      body: JSON.stringify({ name: "Reaction Team" }),
    },
    TEST_ENV,
  );
  const group = (await res.json()) as Group;
  await app.request(
    `/api/v1/groups/${group.id}/messages`,
    {
      method: "POST",
      headers: jsonHeaders(await tokenFor(U.OWNER)),
      body: JSON.stringify({ client_message_id: "cmid-react", body: "react to me" }),
    },
    TEST_ENV,
  );
  return group;
}

describe("§86/§187 reaction authorization (H2)", () => {
  it("a non-member with a leaked message id cannot react (zero rows written)", async () => {
    const { services, reactionRows } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroupWithMessage(app);
    const messages = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      { headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    const sent = ((await messages.json()) as { items: Message[] }).items[0];

    const res = await app.request(
      `/api/v1/messages/${sent!.id}/reactions`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OUTSIDER)),
        body: JSON.stringify({ emoji: "🔥" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
    expect(reactionRows).toHaveLength(0); // fail closed — no write
  });

  it("a REMOVED member cannot react anymore (stale access revoked)", async () => {
    const { services, memberRows, reactionRows } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroupWithMessage(app);
    memberRows.push({
      group_id: group.id,
      user_id: U.MEMBER,
      role: "MEMBER",
      joined_at: new Date().toISOString(),
      removed_at: null,
      group_display_name: null,
      group_avatar_object_id: null,
    });
    // Positive control first: while an active member, the reaction lands.
    const before = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      { headers: jsonHeaders(await tokenFor(U.MEMBER)) },
      TEST_ENV,
    );
    const sent = ((await before.json()) as { items: Message[] }).items[0]!;
    const added = await app.request(
      `/api/v1/messages/${sent.id}/reactions`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.MEMBER)),
        body: JSON.stringify({ emoji: "👍" }),
      },
      TEST_ENV,
    );
    expect(added.status).toBe(200);
    expect(reactionRows).toHaveLength(1);

    await services.membership.removeMember(group.id, U.OWNER, U.MEMBER);

    const afterRemoval = await app.request(
      `/api/v1/messages/${sent.id}/reactions`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.MEMBER)),
        body: JSON.stringify({ emoji: "🎉" }),
      },
      TEST_ENV,
    );
    expect(afterRemoval.status).toBe(403);
    // Only the pre-removal row exists; the removal-time attempt wrote nothing.
    expect(reactionRows).toHaveLength(1);
    expect(reactionRows[0]?.emoji).toBe("👍");
  });

  it("membership in ANOTHER group never authorizes a reaction here (cross-group)", async () => {
    const { services, memberRows, reactionRows } = makeTestServices();
    const app = createApp(services);
    const targetGroup = await setupGroupWithMessage(app);
    const messages = await app.request(
      `/api/v1/groups/${targetGroup.id}/messages`,
      { headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    const foreignMessage = ((await messages.json()) as { items: Message[] }).items[0]!;

    // The attacker is a legitimate member of a DIFFERENT group.
    const otherGroupRes = await app.request(
      "/api/v1/groups",
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OUTSIDER)),
        body: JSON.stringify({ name: "Attacker Own Group" }),
      },
      TEST_ENV,
    );
    const otherGroup = (await otherGroupRes.json()) as Group;
    expect(memberRows.some((m) => m.group_id === otherGroup.id && m.user_id === U.OUTSIDER)).toBe(
      true,
    );

    const res = await app.request(
      `/api/v1/messages/${foreignMessage.id}/reactions`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OUTSIDER)),
        body: JSON.stringify({ emoji: "💥" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
    expect(reactionRows).toHaveLength(0);
  });

  it("a removed member cannot even react on their old PRIVATE conversation", async () => {
    const { services, memberRows, reactionRows } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroupWithMessage(app);
    memberRows.push({
      group_id: group.id,
      user_id: U.MEMBER,
      role: "MEMBER",
      joined_at: new Date().toISOString(),
      removed_at: null,
      group_display_name: null,
      group_avatar_object_id: null,
    });
    // Member opens a private AI chat and reacts inside it (allowed while active).
    const privateRes = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.MEMBER)),
        body: JSON.stringify({ client_message_id: "pv-1", body: "private question", private_to: "ai" }),
      },
      TEST_ENV,
    );
    expect(privateRes.status).toBe(201);
    const privateMessage = (await privateRes.json()) as Message;

    await services.membership.removeMember(group.id, U.OWNER, U.MEMBER);

    // Conversation participation alone is NOT enough (§86): the requester
    // must ALSO still be an active member of the owning Group.
    const res = await app.request(
      `/api/v1/messages/${privateMessage.id}/reactions`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.MEMBER)),
        body: JSON.stringify({ emoji: "👀" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
    expect(reactionRows).toHaveLength(0);
  });

  it("unreacting requires the same active-membership gate", async () => {
    const { services, reactionRows } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroupWithMessage(app);
    const messages = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      { headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    const sent = ((await messages.json()) as { items: Message[] }).items[0]!;
    await services.reactions.react(sent!.id, U.OUTSIDER, "🔥"); // pre-seed a foreign row

    const res = await app.request(
      `/api/v1/messages/${sent.id}/reactions?emoji=${encodeURIComponent("🔥")}`,
      { method: "DELETE", headers: jsonHeaders(await tokenFor(U.OUTSIDER)) },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
    expect(reactionRows).toHaveLength(1); // untouched
  });
});
