import { describe, expect, it } from "vitest";
import {
  PrivateConversationService,
  type PrivateConversation,
  type PrivateConversationRepository,
} from "../src/index";

const U1 = "00000000-0000-4000-8000-000000000001";
const U2 = "00000000-0000-4000-8000-000000000002";
const U3 = "00000000-0000-4000-8000-000000000003";

function makeRepo() {
  const rows: PrivateConversation[] = [];
  const members = new Map<string, string[]>();
  const repo: PrivateConversationRepository = {
    async findHumanPair(groupId, userA, userB) {
      return (
        rows.find(
          (c) =>
            c.group_id === groupId &&
            c.type === "HUMAN_PAIR" &&
            (members.get(c.id) ?? []).includes(userA) &&
            (members.get(c.id) ?? []).includes(userB),
        ) ?? null
      );
    },
    async findAi(groupId, userId) {
      return (
        rows.find(
          (c) =>
            c.group_id === groupId &&
            c.type === "AI" &&
            c.created_by === userId,
        ) ?? null
      );
    },
    async insert(input) {
      const row: PrivateConversation = {
        id: crypto.randomUUID(),
        group_id: input.group_id,
        type: input.type,
        created_by: input.created_by,
        ai_agent_id: input.ai_agent_id,
        created_at: new Date().toISOString(),
      };
      rows.push(row);
      members.set(row.id, input.member_user_ids);
      return row;
    },
    async isMember(conversationId, userId) {
      return (members.get(conversationId) ?? []).includes(userId);
    },
    async memberIds(conversationId) {
      return members.get(conversationId) ?? [];
    },
  };
  return { repo, rows, members };
}

describe("§2.4/§40 private conversations", () => {
  it("creates exactly one HUMAN_PAIR conversation per user pair", async () => {
    const { repo } = makeRepo();
    const svc = new PrivateConversationService(repo);
    const first = await svc.findOrCreateHumanPair("g1", U1, U2);
    const second = await svc.findOrCreateHumanPair("g1", U2, U1);
    expect(second.id).toBe(first.id);
  });

  it("AI conversations are per-user: two users get different ones", async () => {
    const { repo } = makeRepo();
    const svc = new PrivateConversationService(repo);
    const c1 = await svc.findOrCreateAi("g1", U1, "odin-1");
    const c2 = await svc.findOrCreateAi("g1", U2, "odin-1");
    expect(c1.id).not.toBe(c2.id);
  });

  it("only conversation members pass requireMember (§11.2)", async () => {
    const { repo } = makeRepo();
    const svc = new PrivateConversationService(repo);
    const conv = await svc.findOrCreateHumanPair("g1", U1, U2);
    await expect(svc.requireMember(conv.id, U1)).resolves.toBeTruthy();
    await expect(svc.requireMember(conv.id, U3)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects self-pairs", async () => {
    const svc = new PrivateConversationService(makeRepo().repo);
    await expect(svc.findOrCreateHumanPair("g1", U1, U1)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });
});
