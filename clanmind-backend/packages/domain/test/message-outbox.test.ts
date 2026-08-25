import { describe, expect, it } from "vitest";
import { MessageService, type EventOutbox, type Message, type MessageRepository } from "../src/index";

/** §114/§123: edit/delete publish outbox events so the broadcaster fans the
 * room updates out; payloads carry the full privacy routing fields. */
function harness() {
  const messages: Message[] = [];
  let seq = 0;
  const repo: MessageRepository = {
    async createWithMentions(input) {
      seq += 1;
      const row: Message = {
        id: crypto.randomUUID(),
        group_id: input.group_id,
        project_id: input.project_id ?? null,
        sender_type: "USER",
        sender_user_id: input.sender_user_id,
        sender_ai_id: null,
        visibility: input.visibility ?? "GROUP",
        private_conversation_id: input.private_conversation_id ?? null,
        body: input.body,
        body_format: "markdown",
        reply_to_id: input.reply_to_id ?? null,
        client_message_id: input.client_message_id,
        server_sequence: seq,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
      };
      messages.push(row);
      return row;
    },
    async findById(id) {
      return messages.find((m) => m.id === id) ?? null;
    },
    async recordRevision() {},
    async updateBody(id, body, editedAt) {
      const m = messages.find((x) => x.id === id);
      if (!m) return null;
      m.body = body;
      m.edited_at = editedAt;
      return m;
    },
    async softDelete(id, deletedAt) {
      const m = messages.find((x) => x.id === id);
      if (m) m.deleted_at = deletedAt;
    },
    async listGroupVisible() {
      return [];
    },
  };
  const published: { event_type: string; payload: Record<string, unknown> }[] = [];
  const outbox: EventOutbox = {
    async publish(event) {
      published.push({ event_type: event.event_type, payload: event.payload });
    },
  };
  return { service: new MessageService(repo, { message_body_max_chars: 8000 }, outbox), messages, published, repo, outbox };
}

describe("M1: edit/delete re-verify ACTIVE Group membership (BACKEND_AUDIT2 §6)", () => {
  function withActiveGate(active: (groupId: string, userId: string) => boolean) {
    const h = harness();
    const service = new MessageService(
      h.repo,
      { message_body_max_chars: 8000 },
      h.outbox,
      (groupId, userId) => {
        if (!active(groupId, userId)) {
          throw Object.assign(new Error("not a member"), { code: "FORBIDDEN" });
        }
        return Promise.resolve();
      },
    );
    return { ...h, service };
  }

  it("sender identity alone is not authorization — a REMOVED member cannot edit (§185 #11)", async () => {
    const { service, published } = withActiveGate((g, u) => !(g === "g1" && u === "u1"));
    const sent = await service.send({
      group_id: "g1",
      client_message_id: "c1",
      body: "original",
      sender_user_id: "u1",
    });

    await expect(service.edit(sent.id, "u1", "tampered")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // No outbox event, no mutation.
    expect(published).toHaveLength(0);
  });

  it("a REMOVED member cannot softDelete their old message", async () => {
    const { service, published } = withActiveGate((g, u) => !(g === "g1" && u === "u1"));
    const sent = await service.send({
      group_id: "g1",
      client_message_id: "c2",
      body: "old message",
      sender_user_id: "u1",
    });

    await expect(service.softDelete(sent.id, "u1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(published).toHaveLength(0);
  });

  it("an ACTIVE member can still edit/delete (positive control)", async () => {
    const { service, published } = withActiveGate(() => true);
    const sent = await service.send({
      group_id: "g1",
      client_message_id: "c3",
      body: "fine",
      sender_user_id: "u1",
    });

    await service.edit(sent.id, "u1", "updated");
    await service.softDelete(sent.id, "u1");
    expect(published.map((e) => e.event_type)).toEqual(["message.edited", "message.deleted"]);
  });
});

describe("M2: message project_id must belong to the Group (BACKEND_AUDIT2 §6)", () => {
  function withProjectGate(belongs: (projectId: string, groupId: string) => boolean) {
    const h = harness();
    const service = new MessageService(
      h.repo,
      { message_body_max_chars: 8000 },
      h.outbox,
      undefined,
      (projectId, groupId) => {
        if (!belongs(projectId, groupId)) {
          throw Object.assign(new Error("not in group"), { code: "FORBIDDEN" });
        }
        return Promise.resolve();
      },
    );
    return { ...h, service };
  }

  it("a foreign project reference is rejected before any write", async () => {
    const { service, messages } = withProjectGate((p, g) => !(p === "p-foreign" && g === "g1"));
    await expect(
      service.send({
        group_id: "g1",
        project_id: "p-foreign",
        client_message_id: "c1",
        body: "cross-group",
        sender_user_id: "u1",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(messages).toHaveLength(0); // fail closed — nothing written
  });

  it("a same-group project reference sends normally", async () => {
    const { service, messages } = withProjectGate(() => true);
    await service.send({
      group_id: "g1",
      project_id: "p-own",
      client_message_id: "c2",
      body: "fine",
      sender_user_id: "u1",
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.project_id).toBe("p-own");
  });
});

describe("§123 message outbox events", () => {
  it("edit publishes message.edited with privacy routing fields", async () => {
    const h = harness();
    const sent = await h.service.send({
      group_id: "g1",
      client_message_id: "c1",
      body: "original",
      sender_user_id: "u1",
      visibility: "PRIVATE_PAIR",
      private_conversation_id: "conv1",
    });
    await h.service.edit(sent.id, "u1", "updated");

    expect(h.published).toHaveLength(1);
    const event = h.published[0]!;
    expect(event.event_type).toBe("message.edited");
    expect(event.payload["message_id"]).toBe(sent.id);
    expect(event.payload["visibility"]).toBe("PRIVATE_PAIR");
    expect(event.payload["private_conversation_id"]).toBe("conv1");
    expect(event.payload["group_id"]).toBe("g1");
  });

  it("softDelete publishes message.deleted; non-senders cannot trigger either", async () => {
    const h = harness();
    const sent = await h.service.send({
      group_id: "g1",
      project_id: "p1",
      client_message_id: "c2",
      body: "to be removed",
      sender_user_id: "u1",
    });

    await expect(h.service.softDelete(sent.id, "u2")).rejects.toMatchObject({
      code: "GROUP_PERMISSION_DENIED",
    });
    expect(h.published).toHaveLength(0);

    await h.service.softDelete(sent.id, "u1");
    expect(h.published).toHaveLength(1);
    const event = h.published[0]!;
    expect(event.event_type).toBe("message.deleted");
    expect(event.payload["message_id"]).toBe(sent.id);
    expect(event.payload["project_id"]).toBe("p1");
    expect(event.payload["visibility"]).toBe("GROUP");
  });
});
