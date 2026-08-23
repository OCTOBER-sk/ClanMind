import { describe, expect, it } from "vitest";
import { gateProtocolVersion, RoomCore } from "../src/realtime/room-core";
import type { RealtimeEnvelope } from "@clanmind/contracts";

function envelope(sequence: number): RealtimeEnvelope {
  return {
    protocol_version: 1,
    event_id: `evt_${sequence}`,
    event_type: "message.created",
    sequence,
    group_id: "00000000-0000-4000-8000-000000000001",
    project_id: null,
    actor_id: null,
    visibility: "GROUP",
    occurred_at: new Date().toISOString(),
    payload: {},
    request_id: null,
  };
}

describe("§17.1 sequence numbers", () => {
  it("allocates strictly increasing per-room sequences", () => {
    const room = new RoomCore();
    expect(room.nextSequence()).toBe(1);
    expect(room.nextSequence()).toBe(2);
    expect(room.nextSequence()).toBe(3);
  });

  it("clients can detect a gap and eventsSince recovers it", () => {
    const room = new RoomCore();
    room.remember(envelope(1));
    room.remember(envelope(2));
    room.remember(envelope(3));
    // client received 1 and 3 → missing 2
    const missing = room.eventsSince(1);
    expect(missing?.map((e) => e.sequence)).toEqual([2, 3]);
  });

  it("returns null when the window fell out of the ring (fall back to Postgres §157)", () => {
    const room = new RoomCore();
    for (let i = 1; i <= 502; i++) room.remember(envelope(i));
    // ring holds the last 500 events (sequences 3..502). A client whose last
    // sequence is 1 is missing event 2 — unrecoverable from the ring.
    expect(room.eventsSince(1)).toBeNull();
    // A client at 2 needs only 3+ — fully inside the ring (default cap 100).
    expect(room.eventsSince(2)?.length).toBe(100);
    expect(room.eventsSince(3)?.length).toBe(100);
    expect(room.eventsSince(2, 600)?.length).toBe(500);
  });
});

describe("§149 protocol gate", () => {
  it("accepts supported protocol versions", () => {
    expect(gateProtocolVersion(1)).toEqual({ ok: true });
  });

  it("rejects unsupported versions with CLIENT_UPDATE_REQUIRED", () => {
    const result = gateProtocolVersion(0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CLIENT_UPDATE_REQUIRED");
    expect(gateProtocolVersion(99.5).ok).toBe(false);
  });
});

describe("§96/§97 presence + typing", () => {
  it("tracks online members and clears them on offline", () => {
    const room = new RoomCore();
    room.setPresence("u1", "ONLINE");
    room.setPresence("u2", "IDLE");
    expect(room.snapshot().map((p) => p.user_id)).toEqual(["u1", "u2"]);
    room.setPresence("u1", "OFFLINE");
    expect(room.snapshot().map((p) => p.user_id)).toEqual(["u2"]);
  });

  it("typing expires after its TTL", () => {
    const room = new RoomCore();
    const t0 = 1_000_000;
    room.typingStart("u1", t0);
    expect(room.activeTyping(t0 + 1000)).toEqual(["u1"]);
    expect(room.activeTyping(t0 + 9000)).toEqual([]);
  });

  it("offline clears typing state", () => {
    const room = new RoomCore();
    room.typingStart("u1");
    room.setPresence("u1", "OFFLINE");
    expect(room.activeTyping()).toEqual([]);
  });
});

describe("§97 viewing presence", () => {
  it("tracks transient viewing with TTL", () => {
    const room = new RoomCore();
    const t0 = 1_000_000;
    room.viewingChanged("u1", "artifact", "art-1", t0);
    expect(room.snapshotViewing(t0 + 1000)).toEqual([
      {
        user_id: "u1",
        subject_type: "artifact",
        subject_id: "art-1",
        expires_at: t0 + 30_000,
      },
    ]);
    // expired viewing disappears
    expect(room.snapshotViewing(t0 + 31_000)).toEqual([]);
  });

  it("clearing viewing removes the entry", () => {
    const room = new RoomCore();
    room.viewingChanged("u1", "project", "p1");
    room.viewingChanged("u1", null, null);
    expect(room.snapshotViewing()).toEqual([]);
  });
});
