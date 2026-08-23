import { describe, expect, it } from "vitest";
import { GroupService, MembershipService } from "../src/index";
import type {
  Group,
  GroupMember,
  GroupRepository,
  MembershipRepository,
} from "../src/groups/group.types";
import { NOOP_OUTBOX } from "../src/common/ports";
import type { GroupRole } from "@clanmind/contracts";

function makeRepos() {
  const groupRows: Group[] = [];
  const memberRows: GroupMember[] = [];
  const groups: GroupRepository = {
    async insert(input) {
      const now = new Date().toISOString();
      const g: Group = {
        id: crypto.randomUUID(),
        name: input.name,
        description: input.description ?? null,
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
    async listForUser(userId) {
      const ids = new Set(
        memberRows.filter((m) => m.user_id === userId && !m.removed_at).map((m) => m.group_id),
      );
      return groupRows.filter((g) => ids.has(g.id));
    },
  };
  const members: MembershipRepository = {
    async insert(input) {
      const m: GroupMember = {
        ...input,
        joined_at: new Date().toISOString(),
        removed_at: null,
        group_display_name: null,
        group_avatar_object_id: null,
      };
      memberRows.push(m);
      return m;
    },
    async findActive(group_id, user_id) {
      return (
        memberRows.find(
          (m) => m.group_id === group_id && m.user_id === user_id && !m.removed_at,
        ) ?? null
      );
    },
    async listActive(group_id) {
      return memberRows.filter((m) => m.group_id === group_id && !m.removed_at);
    },
    async countActive(group_id) {
      return memberRows.filter((m) => m.group_id === group_id && !m.removed_at).length;
    },
    async updateRole(group_id, user_id, role) {
      const m = memberRows.find(
        (x) => x.group_id === group_id && x.user_id === user_id && !x.removed_at,
      );
      if (!m) return null;
      m.role = role;
      return m;
    },
    async markRemoved(group_id, user_id) {
      const m = memberRows.find((x) => x.group_id === group_id && x.user_id === user_id);
      if (m) m.removed_at = new Date().toISOString();
    },
    async transferOwnership(group_id, fromUserId, toUserId) {
      const from = memberRows.find(
        (x) => x.group_id === group_id && x.user_id === fromUserId,
      );
      const to = memberRows.find((x) => x.group_id === group_id && x.user_id === toUserId);
      if (from) from.role = "ADMIN";
      if (to) to.role = "OWNER";
    },
  };
  return { groups, members, groupRows, memberRows };
}

const OWNER = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";

describe("§7/§24/§25 GroupService + MembershipService", () => {
  it("creating a group makes the creator the single OWNER member (§185 #1,#2)", async () => {
    const r = makeRepos();
    const svc = new GroupService(r.groups, r.members, new MembershipService(r.groups, r.members), NOOP_OUTBOX);
    const g = await svc.create({ name: "Robotics Team", owner_user_id: OWNER });
    expect(g.status).toBe("ACTIVE");
    const owners = r.memberRows.filter((m) => m.group_id === g.id && m.role === "OWNER");
    expect(owners).toHaveLength(1);
    expect(owners[0]?.user_id).toBe(OWNER);
  });

  it("rejects invalid group names", async () => {
    const r = makeRepos();
    const svc = new GroupService(r.groups, r.members, new MembershipService(r.groups, r.members), NOOP_OUTBOX);
    await expect(svc.create({ name: "  ", owner_user_id: OWNER })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(
      svc.create({ name: "x".repeat(81), owner_user_id: OWNER }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("non-members cannot read a group (§86 chain)", async () => {
    const r = makeRepos();
    const svc = new GroupService(r.groups, r.members, new MembershipService(r.groups, r.members), NOOP_OUTBOX);
    const g = await svc.create({ name: "Team", owner_user_id: OWNER });
    await expect(svc.get(g.id, OTHER)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(svc.get(g.id, OWNER)).resolves.toBeTruthy();
  });

  it("requireMember rejects removed members immediately (§185 #11)", async () => {
    const r = makeRepos();
    await r.members.insert({ group_id: "g1", user_id: OTHER, role: "MEMBER" });
    const membership = new MembershipService(r.groups, r.members);
    await expect(
      membership.requireMember("g1", OTHER),
    ).rejects.toMatchObject({ code: "NOT_FOUND" }); // group g1 doesn't exist

    const svc = new GroupService(r.groups, r.members, new MembershipService(r.groups, r.members), NOOP_OUTBOX);
    const g = await svc.create({ name: "Team", owner_user_id: OWNER });
    await r.members.insert({ group_id: g.id, user_id: OTHER, role: "MEMBER" });
    await r.members.markRemoved(g.id, OTHER);
    await expect(membership.requireMember(g.id, OTHER)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("requireRole enforces the role step (§86)", async () => {
    const r = makeRepos();
    const membership = new MembershipService(r.groups, r.members);
    const svc = new GroupService(r.groups, r.members, new MembershipService(r.groups, r.members), NOOP_OUTBOX);
    const g = await svc.create({ name: "Team", owner_user_id: OWNER });
    await r.members.insert({ group_id: g.id, user_id: OTHER, role: "MEMBER" });
    await expect(
      membership.requireRole(g.id, OTHER, ["OWNER", "ADMIN"] as GroupRole[]),
    ).rejects.toMatchObject({ code: "GROUP_PERMISSION_DENIED" });
    await expect(
      membership.requireRole(g.id, OWNER, ["OWNER", "ADMIN"] as GroupRole[]),
    ).resolves.toBeTruthy();
  });
});
