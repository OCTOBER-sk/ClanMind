import { describe, expect, it } from "vitest";
import type { Group } from "@clanmind/domain";
import { createApp } from "../src/app";
import { TEST_ENV, U, makeTestServices, tokenFor } from "./utils";

function jsonHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

describe("§104 groups endpoints", () => {
  it("creates a group, lists it, and reads it back as the owner", async () => {
    const { services, groupRows } = makeTestServices();
    const app = createApp(services);
    const res = await app.request(
      "/api/v1/groups",
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ name: "Robotics Team" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const group = (await res.json()) as Group;
    expect(group.name).toBe("Robotics Team");
    expect(groupRows).toHaveLength(1);

    const list = await app.request(
      "/api/v1/groups",
      { headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    const listed = (await list.json()) as { items: Group[] };
    expect(listed.items).toHaveLength(1);
  });

  it("blocks an outsider from reading a group (§86 chain)", async () => {
    const { services } = makeTestServices();
    const app = createApp(services);
    const created = await app.request(
      "/api/v1/groups",
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ name: "Private Team" }),
      },
      TEST_ENV,
    );
    const group = (await created.json()) as Group;
    const res = await app.request(
      `/api/v1/groups/${group.id}`,
      { headers: jsonHeaders(await tokenFor(U.OUTSIDER)) },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it("member cannot update group settings; owner can (§7 roles)", async () => {
    const { services, memberRows } = makeTestServices();
    const app = createApp(services);
    const created = await app.request(
      "/api/v1/groups",
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ name: "Team" }),
      },
      TEST_ENV,
    );
    const group = (await created.json()) as Group;
    memberRows.push({
      group_id: group.id,
      user_id: U.MEMBER,
      role: "MEMBER",
      joined_at: new Date().toISOString(),
      removed_at: null,
      group_display_name: null,
      group_avatar_object_id: null,
    });

    const denied = await app.request(
      `/api/v1/groups/${group.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(await tokenFor(U.MEMBER)),
        body: JSON.stringify({ name: "Hacked" }),
      },
      TEST_ENV,
    );
    expect(denied.status).toBe(403);

    const ok = await app.request(
      `/api/v1/groups/${group.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ name: "Renamed Team" }),
      },
      TEST_ENV,
    );
    expect(ok.status).toBe(200);
  });

  it("soft delete (§9 stage 1) closes the group to writes", async () => {
    const { services } = makeTestServices();
    const app = createApp(services);
    const created = await app.request(
      "/api/v1/groups",
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ name: "Doomed" }),
      },
      TEST_ENV,
    );
    const group = (await created.json()) as Group;
    const del = await app.request(
      `/api/v1/groups/${group.id}`,
      { method: "DELETE", headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(del.status).toBe(200);
    const deleted = (await del.json()) as Group;
    expect(deleted.status).toBe("DELETING");
    expect(deleted.deleted_at).toBeTruthy();

    const patch = await app.request(
      `/api/v1/groups/${group.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ name: "Nope" }),
      },
      TEST_ENV,
    );
    expect(patch.status).toBe(403);
  });

  it("admin cannot delete the group; only the owner can (§7.1)", async () => {
    const { services, memberRows } = makeTestServices();
    const app = createApp(services);
    const created = await app.request(
      "/api/v1/groups",
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ name: "Owner Only" }),
      },
      TEST_ENV,
    );
    const group = (await created.json()) as Group;
    memberRows.push({
      group_id: group.id,
      user_id: U.ADMIN,
      role: "ADMIN",
      joined_at: new Date().toISOString(),
      removed_at: null,
      group_display_name: null,
      group_avatar_object_id: null,
    });
    const denied = await app.request(
      `/api/v1/groups/${group.id}`,
      { method: "DELETE", headers: jsonHeaders(await tokenFor(U.ADMIN)) },
      TEST_ENV,
    );
    expect(denied.status).toBe(403);
  });

  it("lists members for a member and hides them from outsiders (§104)", async () => {
    const { services, memberRows } = makeTestServices();
    const app = createApp(services);
    const created = await app.request(
      "/api/v1/groups",
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ name: "Members Group" }),
      },
      TEST_ENV,
    );
    const group = (await created.json()) as Group;
    memberRows.push({
      group_id: group.id,
      user_id: U.MEMBER,
      role: "MEMBER",
      joined_at: new Date().toISOString(),
      removed_at: null,
      group_display_name: null,
      group_avatar_object_id: null,
    });

    const ok = await app.request(
      `/api/v1/groups/${group.id}/members`,
      { headers: jsonHeaders(await tokenFor(U.MEMBER)) },
      TEST_ENV,
    );
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(2);

    const denied = await app.request(
      `/api/v1/groups/${group.id}/members`,
      { headers: jsonHeaders(await tokenFor(U.OUTSIDER)) },
      TEST_ENV,
    );
    expect(denied.status).toBe(403);
  });
});
