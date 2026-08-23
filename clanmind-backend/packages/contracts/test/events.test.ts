import { describe, expect, it } from "vitest";
import { EVENT_TYPES, realtimeEnvelopeSchema } from "../src/events";
import { clientMessageSchema } from "../src/websocket";

describe("§17 realtime envelope", () => {
  const validEnvelope = {
    protocol_version: 1,
    event_id: "evt_0123456789abcdef",
    event_type: "message.created",
    sequence: 4812,
    group_id: "00000000-0000-4000-8000-000000000001",
    project_id: null,
    actor_id: "00000000-0000-4000-8000-000000000002",
    visibility: "GROUP",
    occurred_at: "2026-08-22T10:15:00Z",
    payload: {},
    request_id: null,
  };

  it("accepts a valid envelope", () => {
    expect(realtimeEnvelopeSchema.parse(validEnvelope)).toBeTruthy();
  });

  it("rejects an unknown protocol version", () => {
    expect(() =>
      realtimeEnvelopeSchema.parse({ ...validEnvelope, protocol_version: 2 }),
    ).toThrow();
  });

  it("rejects a negative sequence", () => {
    expect(() => realtimeEnvelopeSchema.parse({ ...validEnvelope, sequence: -1 })).toThrow();
  });
});

describe("§18 event taxonomy", () => {
  it("contains the spec's message events", () => {
    for (const t of [
      "message.created",
      "message.edited",
      "message.deleted",
      "message.reaction.added",
      "message.reaction.removed",
      "message.pinned",
      "message.unpinned",
    ]) {
      expect(EVENT_TYPES).toContain(t);
    }
  });

  it("contains the spec's AI events including the full action lifecycle", () => {
    for (const t of [
      "ai.requested",
      "ai.run.started",
      "ai.response.delta",
      "ai.response.completed",
      "ai.response.failed",
      "ai.action.proposed",
      "ai.action.approved",
      "ai.action.rejected",
    ]) {
      expect(EVENT_TYPES).toContain(t);
    }
  });
});

describe("§114 websocket client messages", () => {
  it("parses connection.hello with protocol version and device", () => {
    const parsed = clientMessageSchema.parse({
      type: "connection.hello",
      client_operation_id: "op_abcdef123456",
      protocol_version: 1,
      client_version: "1.0.0",
      device_id: "00000000-0000-4000-8000-000000000003",
      last_server_sequence: 101,
    });
    expect(parsed.type).toBe("connection.hello");
  });

  it("rejects unknown message types", () => {
    expect(() =>
      clientMessageSchema.parse({
        type: "message.unknown",
        client_operation_id: "op_abcdef123456",
      }),
    ).toThrow();
  });
});
