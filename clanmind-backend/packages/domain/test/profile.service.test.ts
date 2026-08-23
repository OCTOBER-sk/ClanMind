import { describe, expect, it } from "vitest";
import {
  ProfileService,
  type Profile,
  type ProfileRepository,
} from "../src/profiles/profile.service";

function makeRepo(seed: Profile[] = []): ProfileRepository & { rows: Profile[] } {
  const rows = [...seed];
  return {
    rows,
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async insert(input) {
      const now = new Date().toISOString();
      const row: Profile = {
        ...input,
        avatar_object_id: null,
        created_at: now,
        updated_at: now,
        last_seen_at: null,
      };
      rows.push(row);
      return row;
    },
    async update(id, input) {
      const row = rows.find((r) => r.id === id);
      if (!row) return null;
      Object.assign(row, input, { updated_at: new Date().toISOString() });
      return row;
    },
    async touchLastSeen(id) {
      const row = rows.find((r) => r.id === id);
      if (row) row.last_seen_at = new Date().toISOString();
    },
  };
}

const ID = "00000000-0000-4000-8000-0000000000aa";
const now = new Date().toISOString();
const existing: Profile = {
  id: ID,
  email_snapshot: "s@example.com",
  display_name: "Santhoshkumar",
  avatar_object_id: null,
  created_at: now,
  updated_at: now,
  last_seen_at: null,
};

describe("§23 ProfileService", () => {
  it("returns the existing profile without inserting", async () => {
    const repo = makeRepo([existing]);
    const svc = new ProfileService(repo);
    const p = await svc.getOrCreate({ user_id: ID, email: "s@example.com" });
    expect(p.display_name).toBe("Santhoshkumar");
    expect(repo.rows).toHaveLength(1);
  });

  it("provisions a first-contact profile using the email local-part", async () => {
    const repo = makeRepo();
    const svc = new ProfileService(repo);
    const p = await svc.getOrCreate({ user_id: ID, email: "arun@example.com" });
    expect(p.display_name).toBe("arun");
    expect(repo.rows).toHaveLength(1);
  });

  it("rejects empty or over-long display names on update", async () => {
    const svc = new ProfileService(makeRepo([existing]));
    await expect(svc.updateMe(ID, { display_name: "   " })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(
      svc.updateMe(ID, { display_name: "x".repeat(101) }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("throws NOT_FOUND when updating a missing profile", async () => {
    const svc = new ProfileService(makeRepo());
    await expect(
      svc.updateMe("00000000-0000-4000-8000-0000000000ff", { display_name: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
