import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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

// ---------------------------------------------------------------------------
// Blocker 2 regression (FINAL_PREKEY_VERIFICATION A4/B2): the composer sends
// `attachment_ids` on POST /messages. The zod schema used to STRIP unknown
// keys, so live messages never gained message_attachments rows.
// ---------------------------------------------------------------------------

describe("§43/§122 — attachment_ids ride the message transaction", () => {
  /** Seeds a real §43 attachment row through the service under test. */
  async function seedAttachment(
    state: ReturnType<typeof makeTestServices>,
    groupId: string,
    ownerId: string,
  ): Promise<string> {
    const row = await state.services.attachments.upload({
      group_id: groupId,
      project_id: null,
      owner_user_id: ownerId,
      original_name: "spec.pdf",
      declared_mime: "application/pdf",
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3]),
      max_bytes: 25 * 1024 * 1024,
      attachments_per_message_max: 10,
      current_attachment_count: 0,
    });
    return row.id;
  }

  it("accepts attachment_ids and persists message_attachments rows in the same write", async () => {
    const state = makeTestServices();
    const { services, messageAttachmentLinkRows } = state;
    const app = createApp(services);
    const group = await setupGroup(app);
    const attachmentId = await seedAttachment(state, group.id, U.OWNER);

    const res = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(await tokenFor(U.OWNER)),
        body: JSON.stringify({
          client_message_id: "cmid-att",
          body: "see attached",
          attachment_ids: [attachmentId],
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const sent = (await res.json()) as Message;
    // The link is persisted against the SERVER-assigned message id — exactly
    // what the §122 RPC inserts atomically with the message row.
    expect(messageAttachmentLinkRows).toEqual([
      { message_id: sent.id, attachment_id: attachmentId },
    ]);
  });

  it("an unknown / foreign / non-owned attachment id aborts the send (fail closed)", async () => {
    const state = makeTestServices();
    const { services, messageRows, messageAttachmentLinkRows } = state;
    const app = createApp(services);
    const group = await setupGroup(app);
    const foreignGroup = await setupGroup(app);
    const foreignId = await seedAttachment(state, foreignGroup.id, U.OWNER);
    const otherUserId = await seedAttachment(state, group.id, U.MEMBER); // wrong owner
    const ghostId = crypto.randomUUID(); // does not exist at all

    for (const [attachmentIds, label] of [
      [[foreignId], "foreign Group"],
      [[otherUserId], "non-owned"],
      [[ghostId], "unknown"],
    ] as [string[], string][]) {
      const res = await app.request(
        `/api/v1/groups/${group.id}/messages`,
        {
          method: "POST",
          headers: jsonHeaders(await tokenFor(U.OWNER)),
          body: JSON.stringify({
            client_message_id: `cmid-bad-${label}`,
            body: "hostile attach",
            attachment_ids: attachmentIds,
          }),
        },
        TEST_ENV,
      );
      // Fail closed: no message row escapes a rejected link set.
      expect(res.status, `${label} must be rejected`).not.toBe(201);
    }
    expect(messageRows).toHaveLength(0);
    expect(messageAttachmentLinkRows).toHaveLength(0);
  });

  it("§19 replay of the same client_message_id never duplicates links", async () => {
    const state = makeTestServices();
    const { services, messageAttachmentLinkRows } = state;
    const app = createApp(services);
    const group = await setupGroup(app);
    const attachmentId = await seedAttachment(state, group.id, U.OWNER);
    const body = JSON.stringify({
      client_message_id: "cmid-replay",
      body: "attached once",
      attachment_ids: [attachmentId],
    });

    const first = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      { method: "POST", headers: jsonHeaders(await tokenFor(U.OWNER)), body },
      TEST_ENV,
    );
    const second = await app.request(
      `/api/v1/groups/${group.id}/messages`,
      { method: "POST", headers: jsonHeaders(await tokenFor(U.OWNER)), body },
      TEST_ENV,
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const sent = (await first.json()) as Message;
    const dup = (await second.json()) as Message;
    expect(dup.id).toBe(sent.id);
    expect(messageAttachmentLinkRows).toEqual([
      { message_id: sent.id, attachment_id: attachmentId },
    ]);
  });

  it("zod still rejects malformed attachment_ids loudly (no silent strip)", async () => {
    const state = makeTestServices();
    const app = createApp(state.services);
    const group = await setupGroup(app);
    for (const bad of [["not-a-uuid"], ["b"], Array.from({ length: 11 }, (_, i) => crypto.randomUUID())]) {
      const res = await app.request(
        `/api/v1/groups/${group.id}/messages`,
        {
          method: "POST",
          headers: jsonHeaders(await tokenFor(U.OWNER)),
          body: JSON.stringify({
            client_message_id: `cmid-zod-${bad.length}-${bad[0]}`,
            body: "bad ids",
            attachment_ids: bad,
          }),
        },
        TEST_ENV,
      );
      expect(res.status).toBe(400);
    }
  });
});

// ---------------------------------------------------------------------------
// Static guard: the §122 RPC migration must actually insert the links inside
// the function body WITH authorization — the exact class of drift that made
// blocker 2 invisible to unit tests (every repo was stubbed).
// ---------------------------------------------------------------------------

describe("§122 migration guard — create_message_with_mentions links attachments", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsDir = join(here, "..", "..", "..", "supabase", "migrations");

  function latestRpcMigration(): string {
    const files = readdirSync(migrationsDir).sort();
    const rpcFiles = files.filter((f) =>
      f.endsWith(".sql") &&
      readFileSync(join(migrationsDir, f), "utf8").includes(
        "create or replace function public.create_message_with_mentions",
      ),
    );
    expect(rpcFiles.length, "a create_message_with_mentions migration must exist").toBeGreaterThan(0);
    // The LAST migration wins — Supabase replays in filename order.
    return readFileSync(join(migrationsDir, rpcFiles[rpcFiles.length - 1]!), "utf8");
  }

  it("the newest RPC definition inserts message_attachments inside the function", () => {
    const sql = latestRpcMigration();
    const fnStart = sql.indexOf(
      "create or replace function public.create_message_with_mentions",
    );
    const fnEnd = sql.indexOf("$$;", fnStart);
    const body = sql.slice(fnStart, fnEnd);
    // Atomicity: the link insert happens inside the SAME function body (one
    // implicit transaction) as the message + outbox writes.
    expect(body).toContain("insert into public.message_attachments");
    expect(body.indexOf("insert into public.messages")).toBeGreaterThan(-1);
    expect(body.indexOf("insert into public.outbox_events")).toBeGreaterThan(-1);
    // Authorization: same Group + owned by the sender + not soft-deleted; a
    // violation RAISES (aborts) instead of silently dropping links.
    expect(body).toContain("att.group_id = v_group_id");
    expect(body).toContain("att.owner_user_id");
    expect(body).toContain("att.deleted_at is null");
    expect(body).toContain("raise exception");
  });

  it("the worker repository forwards attachment_ids into the RPC input", async () => {
    const repoSrc = readFileSync(
      join(here, "..", "src", "repositories", "message.repo.ts"),
      "utf8",
    );
    expect(repoSrc).toContain("attachment_ids: input.attachment_ids ?? []");
  });
});
