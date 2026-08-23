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
  return { service: new MessageService(repo, { message_body_max_chars: 8000 }, outbox), messages, published };
}

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
