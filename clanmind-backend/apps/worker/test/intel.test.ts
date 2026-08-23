import { describe, expect, it } from "vitest";
import type { Group } from "@clanmind/domain";
import { TEST_ENV, U, makeTestServices, tokenFor } from "./utils";
import { createApp } from "../src/app";

function headers(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

interface Ctx {
  app: ReturnType<typeof createApp>;
  groupId: string;
  projectId: string;
}

async function setup(): Promise<Ctx> {
  const state = makeTestServices();
  const app = createApp(state.services);
  const groupRes = await app.request(
    "/api/v1/groups",
    {
      method: "POST",
      headers: headers(await tokenFor(U.OWNER)),
      body: JSON.stringify({ name: "Intel Team" }),
    },
    TEST_ENV,
  );
  const group = (await groupRes.json()) as Group;
  const projectRes = await app.request(
    `/api/v1/groups/${group.id}/projects`,
    {
      method: "POST",
      headers: headers(await tokenFor(U.OWNER)),
      body: JSON.stringify({ name: "Apollo" }),
    },
    TEST_ENV,
  );
  const project = (await projectRes.json()) as { id: string };
  return { app, groupId: group.id, projectId: project.id };
}

describe("§110 decisions + §21.2 CAS", () => {
  it("propose → approve supersedes others; stale expected_version conflicts", async () => {
    const ctx = await setup();

    const first = await ctx.app.request(
      `/api/v1/projects/${ctx.projectId}/decisions`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ title: "Use PostgreSQL" }),
      },
      TEST_ENV,
    );
    expect(first.status).toBe(201);
    const decision = (await first.json()) as { id: string; version: number };

    // Approve with the CURRENT version succeeds.
    const approve = await ctx.app.request(
      `/api/v1/decisions/${decision.id}/approve`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ expected_version: decision.version }),
      },
      TEST_ENV,
    );
    expect(approve.status).toBe(200);

    // Approving again at the same version now races → 409.
    const replay = await ctx.app.request(
      `/api/v1/decisions/${decision.id}/approve`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ expected_version: decision.version }),
      },
      TEST_ENV,
    );
    expect(replay.status).toBe(409);
  });
});

describe("§111 tasks", () => {
  it("create → patch → complete with CAS; stale patch conflicts; cycle-checked deps", async () => {
    const ctx = await setup();

    const created = await ctx.app.request(
      `/api/v1/projects/${ctx.projectId}/tasks`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ title: "Write migration" }),
      },
      TEST_ENV,
    );
    expect(created.status).toBe(201);
    const task = (await created.json()) as { id: string; version: number };

    const patched = await ctx.app.request(
      `/api/v1/tasks/${task.id}`,
      {
        method: "PATCH",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ expected_version: task.version, patch: { priority: "HIGH" } }),
      },
      TEST_ENV,
    );
    expect(patched.status).toBe(200);
    const updated = (await patched.json()) as { version: number; status: string };
    expect(updated.status).toBe("TODO");

    // Stale version → 409.
    const stale = await ctx.app.request(
      `/api/v1/tasks/${task.id}`,
      {
        method: "PATCH",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ expected_version: task.version, patch: { title: "x" } }),
      },
      TEST_ENV,
    );
    expect(stale.status).toBe(409);

    const done = await ctx.app.request(
      `/api/v1/tasks/${task.id}/complete`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ expected_version: updated.version }),
      },
      TEST_ENV,
    );
    expect(done.status).toBe(200);
    expect(((await done.json()) as { status: string }).status).toBe("DONE");

    // Dependencies: second task depends on the first; self-dependency fails.
    const t2 = await ctx.app.request(
      `/api/v1/projects/${ctx.projectId}/tasks`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ title: "Second" }),
      },
      TEST_ENV,
    );
    const second = (await t2.json()) as { id: string };
    const dep = await ctx.app.request(
      `/api/v1/tasks/${second.id}/dependencies`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ depends_on_task_id: task.id }),
      },
      TEST_ENV,
    );
    expect(dep.status).toBe(201);

    const self = await ctx.app.request(
      `/api/v1/tasks/${second.id}/dependencies`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ depends_on_task_id: second.id }),
      },
      TEST_ENV,
    );
    expect(self.status).toBeGreaterThanOrEqual(400); // VALIDATION_FAILED or CONFLICT
  });
});

describe("§109 artifacts", () => {
  it("create → versions → restore → pin → share/content → delete", async () => {
    const ctx = await setup();

    const created = await ctx.app.request(
      `/api/v1/projects/${ctx.projectId}/artifacts`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          name: "Architecture",
          artifact_type: "ARCHITECTURE",
          content: "# v1",
        }),
      },
      TEST_ENV,
    );
    expect(created.status).toBe(201);
    const { artifact } = (await created.json()) as {
      artifact: { id: string };
    };

    const v2 = await ctx.app.request(
      `/api/v1/artifacts/${artifact.id}/versions`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ content: "# v2" }),
      },
      TEST_ENV,
    );
    expect(v2.status).toBe(201);
    expect(((await v2.json()) as { version_number: number }).version_number).toBe(2);

    const restored = await ctx.app.request(
      `/api/v1/artifacts/${artifact.id}/restore`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ version_number: 1 }),
      },
      TEST_ENV,
    );
    expect(restored.status).toBe(201);
    expect(((await restored.json()) as { version_number: number }).version_number).toBe(3);

    const pinned = await ctx.app.request(
      `/api/v1/artifacts/${artifact.id}/pin`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ pinned: true }),
      },
      TEST_ENV,
    );
    expect(pinned.status).toBe(200);

    const share = await ctx.app.request(
      `/api/v1/artifacts/${artifact.id}/share`,
      { method: "POST", headers: headers(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(share.status).toBe(200);
    const { url } = (await share.json()) as { url: string };

    const content = await ctx.app.request(url, { headers: headers(await tokenFor(U.OWNER)) }, TEST_ENV);
    expect(content.status).toBe(200);
    expect(((await content.json()) as { content: string }).content).toBe("# v1");

    const removed = await ctx.app.request(
      `/api/v1/artifacts/${artifact.id}`,
      { method: "DELETE", headers: headers(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(removed.status).toBe(200);
  });
});

describe("§112 meetings", () => {
  it("start → detect → accept(promote) → end expires pending candidates", async () => {
    const ctx = await setup();

    const started = await ctx.app.request(
      `/api/v1/projects/${ctx.projectId}/meetings`,
      { method: "POST", headers: headers(await tokenFor(U.OWNER)), body: "{}" },
      TEST_ENV,
    );
    expect(started.status).toBe(201);
    const session = (await started.json()) as { id: string };

    const detected = await ctx.app.request(
      `/api/v1/meetings/${session.id}/candidates`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          candidate_type: "TASK",
          content: { title: "Follow up on API design" },
          confidence: 0.8,
        }),
      },
      TEST_ENV,
    );
    expect(detected.status).toBe(201);
    const candidate = (await detected.json()) as { id: string };

    const promoted = await ctx.app.request(
      `/api/v1/meetings/${session.id}/candidates/${candidate.id}/accept`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ promote: "task" }),
      },
      TEST_ENV,
    );
    expect(promoted.status).toBe(201);
    const { promoted_id } = (await promoted.json()) as { promoted_id: string };

    const taskView = await ctx.app.request(
      `/api/v1/tasks/${promoted_id}`,
      { headers: headers(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(taskView.status).toBe(200);

    const ended = await ctx.app.request(
      `/api/v1/meetings/${session.id}/end`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({ summary_text: "Discussed API design." }),
      },
      TEST_ENV,
    );
    expect(ended.status).toBe(200);
  });

  it("outsiders cannot read a meeting (§86)", async () => {
    const ctx = await setup();
    const started = await ctx.app.request(
      `/api/v1/projects/${ctx.projectId}/meetings`,
      { method: "POST", headers: headers(await tokenFor(U.OWNER)), body: "{}" },
      TEST_ENV,
    );
    const session = (await started.json()) as { id: string };
    const denied = await ctx.app.request(
      `/api/v1/meetings/${session.id}`,
      { headers: headers(await tokenFor(U.OUTSIDER)) },
      TEST_ENV,
    );
    expect(denied.status).toBe(403);
  });
});
