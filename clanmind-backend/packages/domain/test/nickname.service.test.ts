import { describe, expect, it } from "vitest";
import { NicknameService, type MemberNickname, type NicknameRepository } from "../src/index";

const VIEWER = "00000000-0000-4000-8000-000000000001";
const TARGET = "00000000-0000-4000-8000-000000000002";

function makeRepo() {
  const rows: MemberNickname[] = [];
  const repo: NicknameRepository = {
    async upsert(input) {
      const existing = rows.find(
        (n) =>
          n.group_id === input.group_id &&
          n.viewer_user_id === input.viewer_user_id &&
          n.target_user_id === input.target_user_id,
      );
      if (existing) {
        existing.nickname = input.nickname;
        return existing;
      }
      const now = new Date().toISOString();
      const row: MemberNickname = { ...input, created_at: now, updated_at: now };
      rows.push(row);
      return row;
    },
    async find(g, v, t) {
      return rows.find(
        (n) => n.group_id === g && n.viewer_user_id === v && n.target_user_id === t,
      )!;
    },
    async listForViewer(g, v) {
      return rows.filter((n) => n.group_id === g && n.viewer_user_id === v);
    },
    async delete(g, v, t) {
      const idx = rows.findIndex(
        (n) => n.group_id === g && n.viewer_user_id === v && n.target_user_id === t,
      );
      if (idx >= 0) rows.splice(idx, 1);
    },
  };
  return { repo, rows };
}

describe("§26/§175 nicknames", () => {
  it("stores a viewer-scoped nickname and upserts on change", async () => {
    const { repo } = makeRepo();
    const svc = new NicknameService(repo);
    await svc.set("g1", VIEWER, TARGET, "Aru");
    const updated = await svc.set("g1", VIEWER, TARGET, "AruAru");
    expect(updated.nickname).toBe("AruAru");
  });

  it("rejects self-nicknames and invalid lengths", async () => {
    const svc = new NicknameService(makeRepo().repo);
    await expect(svc.set("g1", VIEWER, VIEWER, "Me")).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(svc.set("g1", VIEWER, TARGET, "   ")).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(svc.set("g1", VIEWER, TARGET, "x".repeat(61))).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("resolves display names in §175 order", () => {
    const resolve = NicknameService.resolveDisplayName;
    expect(resolve({ nickname: "Aru", group_display_name: null, global_display_name: "Arun" })).toBe("Aru");
    expect(resolve({ nickname: null, group_display_name: "Arun K", global_display_name: "Arun" })).toBe("Arun K");
    expect(resolve({ nickname: null, group_display_name: null, global_display_name: "Arun" })).toBe("Arun");
    expect(resolve({ nickname: "  ", group_display_name: "Arun K", global_display_name: "Arun" })).toBe("Arun K");
  });
});
