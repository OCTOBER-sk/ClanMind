import { describe, expect, it } from "vitest";
import {
  GroupDeletionService,
  GroupService,
  MembershipService,
  NOOP_AUDIT,
  NOOP_OUTBOX,
  isWithinRecoveryWindow,
  type Group,
  type GroupRepository,
  type MembershipRepository,
} from "../src/index";

const OWNER = "00000000-0000-4000-8000-000000000001";
const DAY = 24 * 60 * 60 * 1000;

function setup() {
  const groupRows: Group[] = [];
  const groups: GroupRepository = {
    async insert(input) {
      const now = new Date().toISOString();
      const g: Group = {
        id: crypto.randomUUID(),
        name: input.name,
        description: null,
        avatar_object_id: null,
        owner_user_id: input.owner_user_id,
        status: "ACTIVE",
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      groupRows.push(g);
      return g;
    },
    async findById(id) {
      return groupRows.find((g) => g.id === id) ?? null;
    },
    async update(id, input) {
      const g = groupRows.find((x) => x.id === id);
      if (!g) return null;
      Object.assign(g, input);
      return g;
    },
    async setStatus(id, status, deletedAt) {
      const g = groupRows.find((x) => x.id === id);
      if (!g) return null;
      g.status = status;
      g.deleted_at = deletedAt;
      return g;
    },
    async listForUser() {
      return [];
    },
  };
  const memberRows: {
    group_id: string;
    user_id: string;
    role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
    joined_at: string;
    removed_at: string | null;
    group_display_name: string | null;
    group_avatar_object_id: string | null;
  }[] = [];
  const members: MembershipRepository = {
    async insert(input) {
      memberRows.push({ ...input, joined_at: new Date().toISOString(), removed_at: null, group_display_name: null, group_avatar_object_id: null });
      return memberRows[memberRows.length - 1]!;
    },
    async findActive(group_id, user_id) {
      return (memberRows.find(
        (m) => m.group_id === group_id && m.user_id === user_id && !m.removed_at,
      ) ?? null) as never;
    },
    async listActive(group_id) {
      return memberRows.filter((m) => m.group_id === group_id && !m.removed_at) as never;
    },
    async countActive(group_id) {
      return memberRows.filter((m) => m.group_id === group_id && !m.removed_at).length;
    },
    async updateRole() {
      return null;
    },
    async markRemoved() {},
    async transferOwnership() {},
  };
  const membership = new MembershipService(groups, members);
  const groupService = new GroupService(groups, members, membership, NOOP_OUTBOX, {
    group_soft_delete_recovery_days: 30,
  });
  const purgeCalls: string[] = [];
  const deletion = new GroupDeletionService(
    groups,
    membership,
    { async purgeGroupScoped(groupId) { purgeCalls.push(groupId); return ["group_members"]; } },
    NOOP_AUDIT,
  );
  return { groups, groupService, deletion, groupRows, purgeCalls };
}

describe("§9 deletion lifecycle", () => {
  it("restore works within the recovery window and fails after it", async () => {
    const s = setup();
    const g = await s.groupService.create({ name: "T", owner_user_id: OWNER });
    await s.groupService.softDelete(g.id, OWNER);
    const restored = await s.groupService.restore(g.id, OWNER);
    expect(restored.status).toBe("ACTIVE");
    expect(restored.deleted_at).toBeNull();

    // Elapsed window: simulate an old soft delete.
    await s.groupService.softDelete(g.id, OWNER);
    const row = s.groupRows.find((x) => x.id === g.id)!;
    row.deleted_at = new Date(Date.now() - 31 * DAY).toISOString();
    await expect(s.groupService.restore(g.id, OWNER)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("restore requires the Owner", async () => {
    const s = setup();
    const g = await s.groupService.create({ name: "T", owner_user_id: OWNER });
    await s.groupService.softDelete(g.id, OWNER);
    const OTHER = "00000000-0000-4000-8000-000000000002";
    // Not a member at all → FORBIDDEN before role check.
    await expect(s.groupService.restore(g.id, OTHER)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("permanent delete enqueues the deletion job; purge flips status to DELETED", async () => {
    const s = setup();
    const g = await s.groupService.create({ name: "T", owner_user_id: OWNER });
    const enqueued: string[] = [];
    const jobs = {
      async enqueue(input: { job_type: string }) {
        enqueued.push(input.job_type);
      },
    };
    // Permanent delete before soft delete → CONFLICT.
    await expect(
      s.deletion.requestPermanentDelete(g.id, OWNER, jobs),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await s.groupService.softDelete(g.id, OWNER);
    await s.deletion.requestPermanentDelete(g.id, OWNER, jobs);
    expect(enqueued).toEqual(["deletion"]);

    await s.deletion.purge(g.id);
    expect(s.purgeCalls).toEqual([g.id]);
    const row = s.groupRows.find((x) => x.id === g.id)!;
    expect(row.status).toBe("DELETED");
  });

  it("isWithinRecoveryWindow math (§178: 30 days)", () => {
    const now = Date.now();
    expect(isWithinRecoveryWindow(new Date(now - 29 * DAY).toISOString(), 30, now)).toBe(true);
    expect(isWithinRecoveryWindow(new Date(now - 31 * DAY).toISOString(), 30, now)).toBe(false);
    expect(isWithinRecoveryWindow(null, 30, now)).toBe(false);
  });
});
