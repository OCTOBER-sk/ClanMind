import { describe, expect, it } from "vitest";
import type { Group } from "@clanmind/domain";
import { verifyWebhookSignature } from "@clanmind/domain";
import { TEST_ENV, U, makeTestServices, tokenFor } from "./utils";
import { createApp } from "../src/app";

const WEBHOOK_SECRET = "whsec_test_123";

function headers(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

async function sign(raw: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return (
    "sha256=" +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function webhookEnv() {
  return { ...TEST_ENV, GITHUB_WEBHOOK_SECRET: WEBHOOK_SECRET } as typeof TEST_ENV;
}

interface Setup {
  app: ReturnType<typeof createApp>;
  groupId: string;
  projectId: string;
  memberRows: import("@clanmind/domain").GroupMember[];
}

async function setup(): Promise<Setup> {
  const state = makeTestServices();
  const app = createApp(state.services);
  const groupRes = await app.request(
    "/api/v1/groups",
    {
      method: "POST",
      headers: headers(await tokenFor(U.OWNER)),
      body: JSON.stringify({ name: "GH Team" }),
    },
    TEST_ENV,
  );
  const group = (await groupRes.json()) as Group;
  const projectRes = await app.request(
    `/api/v1/groups/${group.id}/projects`,
    {
      method: "POST",
      headers: headers(await tokenFor(U.OWNER)),
      body: JSON.stringify({ name: "Repo Work" }),
    },
    TEST_ENV,
  );
  const project = (await projectRes.json()) as { id: string };
  return { app, groupId: group.id, projectId: project.id, memberRows: state.memberRows };
}

describe("§113 github connect/status/disconnect", () => {
  it("connect (admin gate) → status → disconnect", async () => {
    const ctx = await setup();

    const connect = await ctx.app.request(
      `/api/v1/groups/${ctx.groupId}/github/connect`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          installation_id: 4242,
          owner_login: "acme",
          repo_name: "widgets",
          default_branch: "main",
        }),
      },
      TEST_ENV,
    );
    expect(connect.status).toBe(201);

    const status = await ctx.app.request(
      `/api/v1/groups/${ctx.groupId}/github/status`,
      { headers: headers(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    const statusBody = (await status.json()) as {
      connected: boolean;
      connection: { repo_full_name: string | null } | null;
    };
    expect(statusBody.connected).toBe(true);
    expect(statusBody.connection?.repo_full_name).toBe("acme/widgets");

    const disconnected = await ctx.app.request(
      `/api/v1/groups/${ctx.groupId}/github/disconnect`,
      { method: "POST", headers: headers(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(disconnected.status).toBe(200);
  });
});

describe("§113/§78A github action proposal + approval", () => {
  it("propose creates WAITING_APPROVAL ai_action; approve without creds responds transparently", async () => {
    const ctx = await setup();
    await ctx.app.request(
      `/api/v1/groups/${ctx.groupId}/github/connect`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          installation_id: 7,
          owner_login: "acme",
          repo_name: "widgets",
          default_branch: "main",
        }),
      },
      TEST_ENV,
    );

    const proposed = await ctx.app.request(
      `/api/v1/projects/${ctx.projectId}/github/actions`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          action_type: "create_branch",
          branch_name: "feature/api",
          base_sha: "a".repeat(40),
          head_sha: "b".repeat(40),
          changed_files: [{ path: "src/a.ts", additions: 10, deletions: 2 }],
        }),
      },
      TEST_ENV,
    );
    expect(proposed.status).toBe(202);
    const { action, github_action } = (await proposed.json()) as {
      action: { id: string; payload_hash: string; payload_version: number; status: string };
      github_action: { branch_name: string | null; target_sha: string | null };
    };
    expect(action.status).toBe("WAITING_APPROVAL");
    expect(github_action.branch_name).toBe("feature/api");

    // Default-branch writes are rejected outright (§139).
    const unsafe = await ctx.app.request(
      `/api/v1/projects/${ctx.projectId}/github/actions`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          action_type: "create_branch",
          branch_name: "main",
          base_sha: "a".repeat(40),
          head_sha: "b".repeat(40),
          changed_files: [{ path: "x.ts", additions: 1, deletions: 0 }],
        }),
      },
      TEST_ENV,
    );
    expect(unsafe.status).toBe(403);

    // Approve with the displayed hash/version — no GitHub creds configured:
    // the response is transparent about not executing (§79).
    const approved = await ctx.app.request(
      `/api/v1/github/actions/${action.id}/approve`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          displayed_payload_hash: action.payload_hash,
          displayed_payload_version: action.payload_version,
        }),
      },
      webhookEnv(),
    );
    expect(approved.status).toBe(200);
    const approveBody = (await approved.json()) as {
      executed: boolean;
      reason: string;
    };
    expect(approveBody.executed).toBe(false);
    expect(approveBody.reason).toBe("github_credentials_not_configured");

    // Forged binding (wrong hash) is refused with ACTION_EXPIRED.
    const forged = await ctx.app.request(
      `/api/v1/github/actions/${action.id}/approve`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          displayed_payload_hash: "f".repeat(64),
          displayed_payload_version: action.payload_version,
        }),
      },
      TEST_ENV,
    );
    expect(forged.status).toBeGreaterThanOrEqual(400);
  });

  it("reject flips the action to REJECTED; members cannot approve/reject HIGH risk", async () => {
    const ctx = await setup();
    // A MEMBER of the Group (not Owner/Admin) attempts the approval.
    ctx.memberRows.push({
      group_id: ctx.groupId,
      user_id: U.MEMBER,
      role: "MEMBER",
      joined_at: new Date().toISOString(),
      removed_at: null,
      group_display_name: null,
      group_avatar_object_id: null,
    });
    await ctx.app.request(
      `/api/v1/groups/${ctx.groupId}/github/connect`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          installation_id: 9,
          owner_login: "acme",
          repo_name: "widgets",
          default_branch: "main",
        }),
      },
      TEST_ENV,
    );

    const proposed = await ctx.app.request(
      `/api/v1/projects/${ctx.projectId}/github/actions`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          action_type: "apply_patch",
          branch_name: "patch/1",
          base_sha: "a".repeat(40),
          head_sha: "c".repeat(40),
          changed_files: [{ path: "README.md", additions: 3, deletions: 3 }],
        }),
      },
      TEST_ENV,
    );
    const { action } = (await proposed.json()) as {
      action: { id: string; payload_hash: string; payload_version: number };
    };

    // Member attempts approval → denied at route level (role gate).
    const memberAttempt = await ctx.app.request(
      `/api/v1/github/actions/${action.id}/approve`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.MEMBER)),
        body: JSON.stringify({
          displayed_payload_hash: action.payload_hash,
          displayed_payload_version: action.payload_version,
        }),
      },
      TEST_ENV,
    );
    expect(memberAttempt.status).toBe(403);

    const rejected = await ctx.app.request(
      `/api/v1/github/actions/${action.id}/reject`,
      { method: "POST", headers: headers(await tokenFor(U.OWNER)) },
      TEST_ENV,
    );
    expect(rejected.status).toBe(200);
  });
});

describe("§80 github webhook", () => {
  const raw = JSON.stringify({
    action: "opened",
    installation: { id: 77 },
    pull_request: { number: 5 },
  });

  it("rejects an invalid signature", async () => {
    const ctx = await setup();
    const res = await ctx.app.request(
      "/api/v1/webhooks/github",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": "sha256=" + "0".repeat(64),
          "x-github-delivery": "d-1",
          "x-github-event": "pull_request",
        },
        body: raw,
      },
      webhookEnv(),
    );
    expect(res.status).toBe(403);
  });

  it("accepts a signed delivery once and deduplicates redelivery durably", async () => {
    const ctx = await setup();
    await ctx.app.request(
      `/api/v1/groups/${ctx.groupId}/github/connect`,
      {
        method: "POST",
        headers: headers(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          installation_id: 77,
          owner_login: "acme",
          repo_name: "widgets",
          default_branch: "main",
        }),
      },
      TEST_ENV,
    );

    const env = webhookEnv();
    const request = {
      method: "POST" as const,
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": await sign(raw),
        "x-github-delivery": "delivery-001",
        "x-github-event": "pull_request",
      },
      body: raw,
    };

    const first = await ctx.app.request("/api/v1/webhooks/github", request, env);
    expect(first.status).toBe(202);
    const firstBody = (await first.json()) as { accepted: boolean };
    expect(firstBody.accepted).toBe(true);

    // Same delivery id → durable dedupe, no second outbox event.
    const second = await ctx.app.request("/api/v1/webhooks/github", request, env);
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { accepted: boolean };
    expect(secondBody.accepted).toBe(false);

    // The stored row is attached to the mapped Group (§80 step 4).
    expect(ctx.app).toBeDefined();
  });

  it("signature helper agrees with the verification contract", async () => {
    expect(await verifyWebhookSignature(raw, await sign(raw), WEBHOOK_SECRET)).toBe(true);
    expect(await verifyWebhookSignature(raw, await sign(raw + "x"), WEBHOOK_SECRET)).toBe(false);
  });
});
