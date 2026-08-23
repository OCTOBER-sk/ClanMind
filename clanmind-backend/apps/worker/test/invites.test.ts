import { describe, expect, it } from "vitest";
import type { Group } from "@clanmind/domain";
import { createApp } from "../src/app";
import { TEST_ENV, U, makeTestServices, tokenFor } from "./utils";

const NEWUSER = "00000000-0000-4000-8000-000000000009";

function jsonHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

async function createGroup(app: ReturnType<typeof createApp>): Promise<Group> {
  const res = await app.request(
    "/api/v1/groups",
    {
      method: "POST",
      headers: jsonHeaders(await tokenFor(U.OWNER)),
      body: JSON.stringify({ name: "Invite Team" }),
    },
    TEST_ENV,
  );
  return (await res.json()) as Group;
}

describe("§104 invite endpoints", () => {
  it("creates an invite and returns the one-time token", async () => {
    const { services } = makeTestServices();
    const app = createApp(services);
    const group = await createGroup(app);
    const res = await app.request(
      `/api/v1/groups/${group.id}/invites`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ role: "MEMBER" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { invite: { token_hash: string }; token: string };
    expect(body.token).toBeTruthy();
    expect(body.invite.token_hash).not.toBe(body.token);

    const accept = await app.request(
      `/api/v1/invites/${body.token}/accept`,
      { method: "POST", headers: jsonHeaders(await tokenFor(NEWUSER)) },
      TEST_ENV,
    );
    expect(accept.status).toBe(200);
    const result = (await accept.json()) as { group_id: string; already_member: boolean };
    expect(result.group_id).toBe(group.id);
    expect(result.already_member).toBe(false);
  });

  it("rejects invite creation from an ordinary member (§8)", async () => {
    const { services, memberRows } = makeTestServices();
    const app = createApp(services);
    const group = await createGroup(app);
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
      `/api/v1/groups/${group.id}/invites`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.MEMBER)),
        body: JSON.stringify({ role: "MEMBER" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it("revoked invites cannot be accepted", async () => {
    const { services } = makeTestServices();
    const app = createApp(services);
    const group = await createGroup(app);
    const created = await app.request(
      `/api/v1/groups/${group.id}/invites`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ role: "GUEST" }),
      },
      TEST_ENV,
    );
    const body = (await created.json()) as { invite: { id: string }; token: string };
    const revoke = await app.request(
      `/api/v1/groups/${group.id}/invites/${body.invite.id}/revoke`,
      { method: "POST", headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(revoke.status).toBe(200);
    const accept = await app.request(
      `/api/v1/invites/${body.token}/accept`,
      { method: "POST", headers: jsonHeaders(await tokenFor(NEWUSER)) },
      TEST_ENV,
    );
    expect(accept.status).toBe(404);
  });
});
