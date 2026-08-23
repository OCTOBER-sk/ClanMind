import { describe, expect, it } from "vitest";
import type { Group } from "@clanmind/domain";
import { TEST_ENV, U, makeTestServices, tokenFor } from "./utils";
import { createApp } from "../src/app";

function headers(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

async function createGroup(app: ReturnType<typeof createApp>): Promise<Group> {
  const res = await app.request(
    "/api/v1/groups",
    {
      method: "POST",
      headers: headers(await tokenFor(U.OWNER)),
      body: JSON.stringify({ name: "Mem Team" }),
    },
    TEST_ENV,
  );
  return (await res.json()) as Group;
}

describe("§108 memory endpoints round-trip", () => {
  it("candidates list → accept → list → patch → delete with authorization rules", async () => {
    const state = makeTestServices();
    const app = createApp(state.services);
    const group = await createGroup(app);

    // Seed a pending GROUP candidate through the domain service.
    const { candidate } = await state.services.memory.proposeFromRun({
      group_id: group.id,
      project_id: null,
      user_id: U.OWNER,
      visibility: "GROUP",
      content: "The team ships weekly on Thursdays.",
      confidence: 0.6,
    });
    expect(candidate).not.toBeNull();

    // Outsiders cannot list.
    const denied = await app.request(
      `/api/v1/groups/${group.id}/memory`,
      { headers: headers(await tokenFor(U.OUTSIDER)) },
      TEST_ENV,
    );
    expect(denied.status).toBe(403);

    const candidatesRes = await app.request(
      `/api/v1/groups/${group.id}/memory/candidates`,
      { headers: headers(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    const items = ((await candidatesRes.json()) as { items: { id: string }[] }).items;
    expect(items.map((c) => c.id)).toContain(candidate!.id);

    const accepted = await app.request(
      `/api/v1/memory/${candidate!.id}/accept`,
      { method: "POST", headers: headers(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(accepted.status).toBe(201);
    const memory = (await accepted.json()) as { id: string; importance: number };

    const list = await app.request(
      `/api/v1/groups/${group.id}/memory`,
      { headers: headers(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    const memories = ((await list.json()) as { items: { id: string }[] }).items;
    expect(memories.map((m) => m.id)).toContain(memory.id);

    // PATCH as OWNER works.
    const patched = await app.request(
      `/api/v1/memory/${memory.id}`,
      {
        method: "PATCH",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ importance: 0.8 }),
      },
      TEST_ENV,
    );
    expect(patched.status).toBe(200);
    expect(((await patched.json()) as { importance: number }).importance).toBe(0.8);

    // DELETE works for an Owner.
    const removed = await app.request(
      `/api/v1/memory/${memory.id}`,
      { method: "DELETE", headers: headers(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(removed.status).toBe(200);
  });

  it("USER_PRIVATE acceptance is owner-only and private PATCH is owner-only (§185 #12)", async () => {
    const state = makeTestServices();
    const app = createApp(state.services);
    const group = await createGroup(app);

    const { candidate } = await state.services.memory.proposeFromRun({
      group_id: group.id,
      project_id: null,
      user_id: U.OWNER,
      visibility: "PRIVATE_AI",
      content: "Owner prefers concise summaries.",
      confidence: 0.6,
    });

    // A different Group member cannot accept someone else's private candidate.
    const foreign = await app.request(
      `/api/v1/memory/${candidate!.id}/accept`,
      { method: "POST", headers: headers(await tokenFor(U.MEMBER)) },
      TEST_ENV,
    );
    expect([403, 404]).toContain(foreign.status); // membership gate or owner rule

    const accepted = await state.services.memory.acceptCandidate(candidate!.id, U.OWNER);

    // OWNER accepts fine (member check passes); now PATCH by the owner works…
    const ownPatch = await app.request(
      `/api/v1/memory/${accepted.id}`,
      {
        method: "PATCH",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ confidence: 0.7 }),
      },
      TEST_ENV,
    );
    expect(ownPatch.status).toBe(200);

    // …and another member cannot touch A's USER_PRIVATE row even if they were
    // somehow a member — scope+owner rule precedes role.
    state.memberRows.push({
      group_id: group.id,
      user_id: U.MEMBER,
      role: "MEMBER",
      joined_at: new Date().toISOString(),
      removed_at: null,
      group_display_name: null,
      group_avatar_object_id: null,
    });
    const foreignPatch = await app.request(
      `/api/v1/memory/${accepted.id}`,
      {
        method: "PATCH",
        headers: headers(await tokenFor(U.MEMBER)),
        body: JSON.stringify({ confidence: 0.1 }),
      },
      TEST_ENV,
    );
    expect(foreignPatch.status).toBe(403);
  });
});
