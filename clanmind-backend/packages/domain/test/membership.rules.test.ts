import { describe, expect, it } from "vitest";
import { GroupService, MembershipService, NOOP_OUTBOX } from "../src/index";
import type {
  Group,
  GroupMember,
  GroupRepository,
  MembershipRepository,
} from "../src/groups/group.types";

const OWNER = "00000000-0000-4000-8000-000000000001";
const ADMIN = "00000000-0000-4000-8000-000000000002";
const MEMBER = "00000000-0000-4000-8000-000000000003";
const GUEST = "00000000-0000-4000-8000-000000000004";

function setup() {
  const groupRows: Group[] = [];
  const memberRows: GroupMember[] = [];
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
      const from = memberRows.find((x) => x.group_id === group_id && x.user_id === fromUserId);
      const to = memberRows.find((x) => x.group_id === group_id && x.user_id === toUserId);
      if (from) from.role = "ADMIN";
      if (to) to.role = "OWNER";
      const g = groupRows.find((x) => x.id === group_id);
      if (g) g.owner_user_id = toUserId;
    },
  };
  const membership = new MembershipService(groups, members);
  const groupService = new GroupService(groups, members, membership, NOOP_OUTBOX);
  return { groups, members, membership, groupService, groupRows, memberRows };
}

async function makeTeam(): Promise<ReturnType<typeof setup> & { groupId: string }> {
  const s = setup();
  const g = await s.groupService.create({ name: "Team", owner_user_id: OWNER });
  await s.members.insert({ group_id: g.id, user_id: ADMIN, role: "ADMIN" });
  await s.members.insert({ group_id: g.id, user_id: MEMBER, role: "MEMBER" });
  await s.members.insert({ group_id: g.id, user_id: GUEST, role: "GUEST" });
  return { ...s, groupId: g.id };
}

describe("§7.2 admin hierarchy", () => {
  it("only the Owner can promote someone to ADMIN", async () => {
    const s = await makeTeam();
    await expect(
      s.membership.changeRole(s.groupId, ADMIN, MEMBER, "ADMIN"),
    ).rejects.toMatchObject({ code: "GROUP_PERMISSION_DENIED" });
    await expect(
      s.membership.changeRole(s.groupId, OWNER, MEMBER, "ADMIN"),
    ).resolves.toMatchObject({ role: "ADMIN" });
  });

  it("an Admin cannot modify another Admin", async () => {
    const s = await makeTeam();
    await expect(
      s.membership.changeRole(s.groupId, ADMIN, ADMIN, "MEMBER"),
    ).rejects.toMatchObject({ code: "GROUP_PERMISSION_DENIED" });
  });

  it("an Admin can manage ordinary members and guests", async () => {
    const s = await makeTeam();
    await expect(
      s.membership.changeRole(s.groupId, ADMIN, GUEST, "MEMBER"),
    ).resolves.toBeTruthy();
  });

  it("the Owner's role cannot be changed via changeRole (transfer only)", async () => {
    const s = await makeTeam();
    await expect(
      s.membership.changeRole(s.groupId, OWNER, OWNER, "MEMBER"),
    ).rejects.toMatchObject({ code: "GROUP_PERMISSION_DENIED" });
  });

  it("a Member cannot change any role", async () => {
    const s = await makeTeam();
    await expect(
      s.membership.changeRole(s.groupId, MEMBER, GUEST, "MEMBER"),
    ).rejects.toMatchObject({ code: "GROUP_PERMISSION_DENIED" });
  });
});

describe("§7 member removal", () => {
  it("Owner removes an Admin; an Admin cannot remove an Admin", async () => {
    const s = await makeTeam();
    await expect(s.membership.removeMember(s.groupId, ADMIN, ADMIN)).rejects.toMatchObject({
      code: "GROUP_PERMISSION_DENIED",
    });
    await expect(s.membership.removeMember(s.groupId, OWNER, ADMIN)).resolves.toBeUndefined();
  });

  it("Admin removes a Member; the removed member loses access immediately (§185 #11)", async () => {
    const s = await makeTeam();
    await s.membership.removeMember(s.groupId, ADMIN, MEMBER);
    await expect(s.membership.requireMember(s.groupId, MEMBER)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("the Owner cannot be removed (§185 #1)", async () => {
    const s = await makeTeam();
    await expect(s.membership.removeMember(s.groupId, ADMIN, OWNER)).rejects.toMatchObject({
      code: "GROUP_PERMISSION_DENIED",
    });
  });
});

describe("§7.2 ownership transfer", () => {
  it("transfers ownership: old owner becomes ADMIN, new owner becomes OWNER", async () => {
    const s = await makeTeam();
    await s.membership.transferOwnership(s.groupId, OWNER, ADMIN);
    const old = await s.members.findActive(s.groupId, OWNER);
    const neu = await s.members.findActive(s.groupId, ADMIN);
    expect(old?.role).toBe("ADMIN");
    expect(neu?.role).toBe("OWNER");
    const group = await s.groups.findById(s.groupId);
    expect(group?.owner_user_id).toBe(ADMIN);
    // exactly one owner remains (§185 #1)
    const owners = (await s.members.listActive(s.groupId)).filter((m) => m.role === "OWNER");
    expect(owners).toHaveLength(1);
  });

  it("only the Owner can transfer ownership", async () => {
    const s = await makeTeam();
    await expect(
      s.membership.transferOwnership(s.groupId, ADMIN, MEMBER),
    ).rejects.toMatchObject({ code: "GROUP_PERMISSION_DENIED" });
  });

  it("rejects self-transfer", async () => {
    const s = await makeTeam();
    await expect(
      s.membership.transferOwnership(s.groupId, OWNER, OWNER),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
