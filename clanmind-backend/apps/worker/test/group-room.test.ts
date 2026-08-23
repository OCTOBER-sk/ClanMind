import { describe, expect, it } from "vitest";
import { AppError } from "@clanmind/shared";
import { GroupRoom, wsErrorFrame } from "../src/realtime/group-room";
import type { Env } from "../src/env";

/**
 * §102/§114 — WS error frames must carry domain AppError codes faithfully
 * (RATE_LIMITED with retry_after_seconds, GROUP_PERMISSION_DENIED, …);
 * message.send must never mask them as VALIDATION_FAILED.
 */

describe("§102 wsErrorFrame mapping", () => {
  it("maps RATE_LIMITED faithfully and carries retry_after_seconds", () => {
    const frame = wsErrorFrame(
      new AppError("RATE_LIMITED", "Too many requests. Retry in 42s.", {
        retry_after_seconds: 42,
      }),
    );
    expect(frame).toEqual({
      type: "error",
      code: "RATE_LIMITED",
      message: "Too many requests. Retry in 42s.",
      retry_after_seconds: 42,
    });
  });

  it("omits retry_after_seconds when the limiter supplied none", () => {
    const frame = wsErrorFrame(new AppError("RATE_LIMITED", "Too many requests."));
    expect(frame.code).toBe("RATE_LIMITED");
    expect(frame).not.toHaveProperty("retry_after_seconds");
  });

  it("maps GROUP_PERMISSION_DENIED faithfully", () => {
    const frame = wsErrorFrame(
      new AppError("GROUP_PERMISSION_DENIED", "Only the sender can modify this message."),
    );
    expect(frame.type).toBe("error");
    expect(frame.code).toBe("GROUP_PERMISSION_DENIED");
    expect(frame.message).toBe("Only the sender can modify this message.");
    expect(frame).not.toHaveProperty("retry_after_seconds");
  });

  it("rides every other §102 code through unchanged", () => {
    for (const code of [
      "FORBIDDEN",
      "NOT_FOUND",
      "UNAUTHENTICATED",
      "APPLICATION_AI_QUOTA_EXHAUSTED",
      "CONFLICT",
    ] as const) {
      expect(wsErrorFrame(new AppError(code, "detail")).code).toBe(code);
    }
  });

  it("collapses unknown errors to VALIDATION_FAILED without leaking internals (§102)", () => {
    const frame = wsErrorFrame(new Error("raw SQL: select * from secrets"));
    expect(frame).toEqual({
      type: "error",
      code: "VALIDATION_FAILED",
      message: "Operation failed.",
    });
    expect(JSON.stringify(frame)).not.toContain("select * from secrets");
  });
});

// --- integration: message.send dispatches through the same mapping ---------

interface SentFrame {
  type: string;
  code?: string;
  message?: string;
  retry_after_seconds?: number;
}

function makeRoomHarness(sendError: () => Promise<never>) {
  const sent: SentFrame[] = [];
  const ws = {
    send(frame: string) {
      sent.push(JSON.parse(frame) as SentFrame);
    },
    deserializeAttachment() {
      return { user_id: "00000000-0000-4000-8000-000000000001", hello: true };
    },
    serializeAttachment() {},
    close() {},
  } as unknown as WebSocket;

  const state = {
    id: { name: "00000000-0000-4000-8000-00000000g001".replace("g001", "g01") },
    getWebSockets: () => [ws],
    acceptWebSocket: () => {},
  } as unknown as DurableObjectState;

  const room = new GroupRoom(state, {} as Env);
  // Seed the lazy persistence services so the DO path never touches a DB;
  // only the message.send branch is exercised here.
  (room as unknown as { roomServices: unknown }).roomServices = {
    db: {},
    messages: { send: sendError },
    reactions: {},
    meetings: {},
  };
  return { room, sent, ws };
}

function sendMessageFrame(room: GroupRoom, ws: WebSocket): Promise<void> {
  return room.webSocketMessage(
    ws,
    JSON.stringify({
      type: "message.send",
      client_operation_id: "op-ws-send-1",
      body: "hello room",
    }),
  );
}

describe("§102/§114 message.send error frames", () => {
  it("emits RATE_LIMITED with retry_after_seconds instead of masking it", async () => {
    const { room, sent, ws } = makeRoomHarness(() =>
      Promise.reject(
        new AppError("RATE_LIMITED", "Too many requests. Retry in 30s.", {
          retry_after_seconds: 30,
        }),
      ),
    );
    await sendMessageFrame(room, ws);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: "error",
      code: "RATE_LIMITED",
      retry_after_seconds: 30,
    });
    expect(sent[0]?.message).toContain("Retry in 30s");
  });

  it("emits GROUP_PERMISSION_DENIED faithfully", async () => {
    const { room, sent, ws } = makeRoomHarness(() =>
      Promise.reject(new AppError("GROUP_PERMISSION_DENIED", "You do not have permission.")),
    );
    await sendMessageFrame(room, ws);
    expect(sent[0]).toMatchObject({ type: "error", code: "GROUP_PERMISSION_DENIED" });
    expect(sent[0]).not.toHaveProperty("retry_after_seconds");
  });

  it("keeps plain VALIDATION_FAILED for domain validation failures", async () => {
    const { room, sent, ws } = makeRoomHarness(() =>
      Promise.reject(new AppError("VALIDATION_FAILED", "Message body is required.")),
    );
    await sendMessageFrame(room, ws);
    expect(sent[0]).toMatchObject({
      type: "error",
      code: "VALIDATION_FAILED",
      message: "Message body is required.",
    });
  });

  it("never leaks unknown internal errors into the frame", async () => {
    const { room, sent, ws } = makeRoomHarness(() =>
      Promise.reject(new Error("connection refused: supabase")),
    );
    await sendMessageFrame(room, ws);
    expect(sent[0]).toEqual({
      type: "error",
      code: "VALIDATION_FAILED",
      message: "Operation failed.",
    });
    expect(JSON.stringify(sent)).not.toContain("supabase");
  });
});
