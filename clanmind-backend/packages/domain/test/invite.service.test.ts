import { describe, expect, it } from "vitest";
import {
  GroupService,
  InviteService,
  MembershipService,
  NOOP_OUTBOX,
  hashInviteToken,
  type Group,
  type GroupInvite,
  type GroupMember,
  type GroupRepository,
  type InviteRepository,
  type MembershipRepository,
} from "../src/index";

const OWNER = "00000000-0000-4000-8000-000000000001";
const ADMIN = "00000000-0000-4000-8000-000000000002";
const NEWUSER = "00000000-0000-4000-8000-000000000009";

function setup(limits = { invite_token_lifetime_days: 7, group_members_initial_max: 25 }) {
  const groupRows: Group[] = [];
  const memberRows: GroupMember[] = [];
  const inviteRows: GroupInvite[] = [];
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
  const invites: InviteRepository = {
    async insert(input) {
      const invite: GroupInvite = {
        id: crypto.randomUUID(),
        uses_count: 0,
        revoked_at: null,
        created_at: new Date().toISOString(),
        ...input,
      };
      inviteRows.push(invite);
      return invite;
    },
    async findById(id) {
      return inviteRows.find((i) => i.id === id) ?? null;
    },
    async findByTokenHash(tokenHash) {
      return inviteRows.find((i) => i.token_hash === tokenHash) ?? null;
    },
    async listByGroup(groupId) {
      return inviteRows.filter((i) => i.group_id === groupId);
    },
    async markRevoked(id) {
      const i = inviteRows.find((x) => x.id === id);
      if (i) i.revoked_at = new Date().toISOString();
    },
    async incrementUses(id) {
      const i = inviteRows.find((x) => x.id === id);
      if (i) i.uses_count += 1;
    },
  };
  const membership = new MembershipService(groups, members);
  const groupService = new GroupService(groups, members, membership, NOOP_OUTBOX);
  const inviteService = new InviteService(invites, groups, members, membership, NOOP_OUTBOX, limits);
  return { groupService, inviteService, inviteRows, memberRows, groupRows };
}

async function makeTeam(s: ReturnType<typeof setup>) {
  const g = await s.groupService.create({ name: "Team", owner_user_id: OWNER });
  await s.memberRows.push({
    group_id: g.id,
    user_id: ADMIN,
    role: "ADMIN",
    joined_at: new Date().toISOString(),
    removed_at: null,
    group_display_name: null,
    group_avatar_object_id: null,
  });
  return g;
}

describe("§8 invite lifecycle", () => {
  it("stores only the token hash; the raw token verifies on accept", async () => {
    const s = setup();
    const g = await makeTeam(s);
    const { invite, token } = await s.inviteService.create(g.id, OWNER, { role: "MEMBER" });
    expect(invite.token_hash).not.toBe(token);
    expect(invite.token_hash).toBe(await hashInviteToken(token));
    expect(invite.expires_at).toBeTruthy();

    const result = await s.inviteService.accept(token, NEWUSER);
    expect(result.already_member).toBe(false);
    expect(result.role).toBe("MEMBER");
    expect(invite.uses_count).toBe(1);
  });

  it("only Owner/Admin can create invites (§8)", async () => {
    const s = setup();
    const g = await makeTeam(s);
    const MEMBER = "00000000-0000-4000-8000-000000000003";
    await s.memberRows.push({
      group_id: g.id,
      user_id: MEMBER,
      role: "MEMBER",
      joined_at: new Date().toISOString(),
      removed_at: null,
      group_display_name: null,
      group_avatar_object_id: null,
    });
    await expect(
      s.inviteService.create(g.id, MEMBER, { role: "MEMBER" }),
    ).rejects.toMatchObject({ code: "GROUP_PERMISSION_DENIED" });
  });

  it("rejects an unknown or tampered token", async () => {
    const s = setup();
    const g = await makeTeam(s);
    await s.inviteService.create(g.id, OWNER, { role: "MEMBER" });
    await expect(s.inviteService.accept("totally-fake-token", NEWUSER)).rejects.toMatchObject({
      code: "INVITE_INVALID",
    });
  });

  it("rejects expired and revoked invites", async () => {
    const s = setup({ invite_token_lifetime_days: 0, group_members_initial_max: 25 });
    const g = await makeTeam(s);
    const { token } = await s.inviteService.create(g.id, OWNER, { role: "MEMBER" });
    await expect(s.inviteService.accept(token, NEWUSER)).rejects.toMatchObject({
      code: "INVITE_INVALID",
    });

    const s2 = setup();
    const g2 = await makeTeam(s2);
    const created = await s2.inviteService.create(g2.id, OWNER, { role: "MEMBER" });
    await s2.inviteService.revoke(g2.id, created.invite.id, OWNER);
    await expect(s2.inviteService.accept(created.token, NEWUSER)).rejects.toMatchObject({
      code: "INVITE_INVALID",
    });
  });

  it("enforces max_uses", async () => {
    const s = setup();
    const g = await makeTeam(s);
    const { token } = await s.inviteService.create(g.id, OWNER, {
      role: "GUEST",
      max_uses: 1,
    });
    const U1 = "00000000-0000-4000-8000-000000000011";
    const U2 = "00000000-0000-4000-8000-000000000012";
    await expect(s.inviteService.accept(token, U1)).resolves.toBeTruthy();
    await expect(s.inviteService.accept(token, U2)).rejects.toMatchObject({
      code: "INVITE_INVALID",
    });
  });

  it("enforces the initial member limit (§178)", async () => {
    const s = setup({ invite_token_lifetime_days: 7, group_members_initial_max: 1 });
    const g = await makeTeam(s); // owner already = 1 member
    const { token } = await s.inviteService.create(g.id, OWNER, { role: "MEMBER" });
    await expect(s.inviteService.accept(token, NEWUSER)).rejects.toMatchObject({
      code: "GROUP_LIMIT_REACHED",
    });
  });

  it("accepting while already a member is idempotent", async () => {
    const s = setup();
    const g = await makeTeam(s);
    const { token } = await s.inviteService.create(g.id, OWNER, { role: "MEMBER" });
    const result = await s.inviteService.accept(token, ADMIN);
    expect(result.already_member).toBe(true);
  });
});
