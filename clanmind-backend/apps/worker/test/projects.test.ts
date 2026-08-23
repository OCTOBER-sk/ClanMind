import { describe, expect, it } from "vitest";
import type { Group, Project } from "@clanmind/domain";
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
      body: JSON.stringify({ name: "Project Team" }),
    },
    TEST_ENV,
  );
  return (await res.json()) as Group;
}

describe("§104 project endpoints", () => {
  it("member creates a project; guest cannot (§7)", async () => {
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
    const GUEST = "00000000-0000-4000-8000-000000000005";
    memberRows.push({
      group_id: group.id,
      user_id: GUEST,
      role: "GUEST",
      joined_at: new Date().toISOString(),
      removed_at: null,
      group_display_name: null,
      group_avatar_object_id: null,
    });

    const ok = await app.request(
      `/api/v1/groups/${group.id}/projects`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.MEMBER)),
        body: JSON.stringify({ name: "Flight Controller", project_type: "iot" }),
      },
      TEST_ENV,
    );
    expect(ok.status).toBe(201);
    const project = (await ok.json()) as Project;
    expect(project.status).toBe("active");

    const denied = await app.request(
      `/api/v1/groups/${group.id}/projects`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(GUEST)),
        body: JSON.stringify({ name: "Nope" }),
      },
      TEST_ENV,
    );
    expect(denied.status).toBe(403);
  });

  it("outsider cannot read a project (§86)", async () => {
    const { services } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroup(app);
    const created = await app.request(
      `/api/v1/groups/${group.id}/projects`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ name: "Secret" }),
      },
      TEST_ENV,
    );
    const project = (await created.json()) as Project;
    const denied = await app.request(
      `/api/v1/projects/${project.id}`,
      { headers: jsonHeaders(await tokenFor(U.OUTSIDER)) },
      TEST_ENV,
    );
    expect(denied.status).toBe(403);
  });

  it("archives and restores (§10.3); archived excluded from default list", async () => {
    const { services } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroup(app);
    const created = await app.request(
      `/api/v1/groups/${group.id}/projects`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ name: "Archivable" }),
      },
      TEST_ENV,
    );
    const project = (await created.json()) as Project;

    const archived = await app.request(
      `/api/v1/projects/${project.id}/archive`,
      { method: "POST", headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(archived.status).toBe(200);
    expect(((await archived.json()) as Project).status).toBe("archived");

    const listDefault = await app.request(
      `/api/v1/groups/${group.id}/projects`,
      { headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(((await listDefault.json()) as { items: Project[] }).items).toHaveLength(0);

    const listAll = await app.request(
      `/api/v1/groups/${group.id}/projects?include_archived=true`,
      { headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(((await listAll.json()) as { items: Project[] }).items).toHaveLength(1);

    const restored = await app.request(
      `/api/v1/projects/${project.id}/restore`,
      { method: "POST", headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(((await restored.json()) as Project).status).toBe("active");
  });

  it("instructions round-trip with priority ordering (§29)", async () => {
    const { services } = makeTestServices();
    const app = createApp(services);
    const group = await setupGroup(app);
    const created = await app.request(
      `/api/v1/groups/${group.id}/projects`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ name: "With Instructions" }),
      },
      TEST_ENV,
    );
    const project = (await created.json()) as Project;

    await app.request(
      `/api/v1/projects/${project.id}/instructions`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ instruction_text: "Use PostgreSQL.", priority: 10 }),
      },
      TEST_ENV,
    );
    const second = await app.request(
      `/api/v1/projects/${project.id}/instructions`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({ instruction_text: "Keep API versioned.", priority: 5 }),
      },
      TEST_ENV,
    );
    expect(second.status).toBe(201);

    const list = await app.request(
      `/api/v1/projects/${project.id}/instructions`,
      { headers: jsonHeaders(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    const body = (await list.json()) as { items: { instruction_text: string }[] };
    expect(body.items.map((i) => i.instruction_text)).toEqual([
      "Keep API versioned.",
      "Use PostgreSQL.",
    ]);
  });
});
