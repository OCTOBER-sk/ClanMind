import { describe, expect, it } from "vitest";
import {
  parseSlashCommand,
  PinService,
  ReactionService,
  type MessagePin,
  type MessageReaction,
  type PinRepository,
  type ReactionRepository,
} from "../src/index";

function reactionRepo() {
  const rows: MessageReaction[] = [];
  const repo: ReactionRepository = {
    async add(input) {
      const existing = rows.find(
        (r) =>
          r.message_id === input.message_id &&
          r.user_id === input.user_id &&
          r.emoji === input.emoji,
      );
      if (existing) return existing;
      const row: MessageReaction = { ...input, created_at: new Date().toISOString() };
      rows.push(row);
      return row;
    },
    async remove(messageId, userId, emoji) {
      const idx = rows.findIndex(
        (r) => r.message_id === messageId && r.user_id === userId && r.emoji === emoji,
      );
      if (idx >= 0) rows.splice(idx, 1);
    },
    async listByMessage(messageId) {
      return rows.filter((r) => r.message_id === messageId);
    },
  };
  return { repo, rows };
}

function pinRepo() {
  const rows: MessagePin[] = [];
  const repo: PinRepository = {
    async pin(input) {
      const existing = rows.find(
        (p) => p.group_id === input.group_id && p.message_id === input.message_id,
      );
      if (existing) {
        existing.unpinned_at = null;
        return existing;
      }
      const row: MessagePin = { ...input, pinned_at: new Date().toISOString(), unpinned_at: null };
      rows.push(row);
      return row;
    },
    async unpin(groupId, messageId) {
      const row = rows.find((p) => p.group_id === groupId && p.message_id === messageId);
      if (row) row.unpinned_at = new Date().toISOString();
    },
    async listOpen(groupId) {
      return rows.filter((p) => p.group_id === groupId && !p.unpinned_at);
    },
  };
  return { repo, rows };
}

describe("§41 reactions", () => {
  it("adds and removes a reaction", async () => {
    const { repo } = reactionRepo();
    const svc = new ReactionService(repo);
    await svc.react("m1", "u1", "👍");
    await svc.unreact("m1", "u1", "👍");
    expect(await repo.listByMessage("m1")).toHaveLength(0);
  });

  it("rejects invalid emoji lengths", async () => {
    const svc = new ReactionService(reactionRepo().repo);
    await expect(svc.react("m1", "u1", "")).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });
});

describe("§39B pins", () => {
  it("pins and unpins a group message", async () => {
    const { repo } = pinRepo();
    const svc = new PinService(repo);
    await svc.pin(
      { id: "m1", group_id: "g1", project_id: null, visibility: "GROUP" },
      "u1",
    );
    expect((await repo.listOpen("g1"))).toHaveLength(1);
    await svc.unpin("g1", "m1");
    expect(await repo.listOpen("g1")).toHaveLength(0);
  });

  it("refuses to pin a private message into the Group list", async () => {
    const svc = new PinService(pinRepo().repo);
    await expect(
      svc.pin(
        { id: "m2", group_id: "g1", project_id: null, visibility: "PRIVATE_AI" },
        "u1",
      ),
    ).rejects.toMatchObject({ code: "GROUP_PERMISSION_DENIED" });
  });
});

describe("§14.2 slash commands", () => {
  it("parses the initial command set with args", () => {
    expect(parseSlashCommand("/ask why postgres")).toEqual({
      command: "ask",
      args: "why postgres",
    });
    expect(parseSlashCommand("/private @Odin help")).toEqual({
      command: "private",
      args: "@Odin help",
    });
    expect(parseSlashCommand("/meeting")).toEqual({ command: "meeting", args: "" });
    expect(parseSlashCommand("/research latest wasm runtimes")).toEqual({
      command: "research",
      args: "latest wasm runtimes",
    });
  });

  it("ignores plain text and unknown commands", () => {
    expect(parseSlashCommand("hello world")).toBeNull();
    expect(parseSlashCommand("/unknown x")).toBeNull();
    expect(parseSlashCommand("mid /ask")).toBeNull();
  });
});
