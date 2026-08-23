import type { GroupRole } from "@clanmind/contracts";
import { AppError } from "@clanmind/shared";
import type { EventOutbox } from "../common/ports";
import type { MembershipService } from "./membership.service";
import type { GroupRepository, MembershipRepository } from "./group.types";

/** §27 invite record. */
export interface GroupInvite {
  id: string;
  group_id: string;
  created_by: string;
  email: string | null;
  role: GroupRole;
  token_hash: string;
  expires_at: string;
  max_uses: number | null;
  uses_count: number;
  revoked_at: string | null;
  created_at: string;
}

export interface CreateInviteInput {
  email?: string | null;
  role: Exclude<GroupRole, "OWNER">;
  max_uses?: number | null;
}

/** §184 repository contract over `group_invites`. */
export interface InviteRepository {
  insert(input: {
    group_id: string;
    created_by: string;
    email: string | null;
    role: Exclude<GroupRole, "OWNER">;
    token_hash: string;
    expires_at: string;
    max_uses: number | null;
  }): Promise<GroupInvite>;
  findById(id: string): Promise<GroupInvite | null>;
  findByTokenHash(tokenHash: string): Promise<GroupInvite | null>;
  listByGroup(groupId: string): Promise<GroupInvite[]>;
  markRevoked(id: string): Promise<void>;
  incrementUses(id: string): Promise<void>;
}

/** Token generation + hashing (§8.2: non-guessable, store hash only). */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface AcceptInviteResult {
  group_id: string;
  role: GroupRole;
  already_member: boolean;
}

/**
 * §8 Invitations and Joining.
 * Only Owner/Admin can invite (§8). Share links use non-guessable tokens and
 * only the hash is stored. Accepting enforces expiry, revocation, use counts,
 * and the initial member limit (§178).
 */
export class InviteService {
  constructor(
    private readonly invites: InviteRepository,
    private readonly groups: GroupRepository,
    private readonly members: MembershipRepository,
    private readonly membership: MembershipService,
    private readonly outbox: EventOutbox,
    private readonly limits: {
      invite_token_lifetime_days: number;
      group_members_initial_max: number;
    },
  ) {}

  async create(
    groupId: string,
    actorUserId: string,
    input: CreateInviteInput,
  ): Promise<{ invite: GroupInvite; token: string }> {
    const { group } = await this.membership.requireRole(groupId, actorUserId, [
      "OWNER",
      "ADMIN",
    ]);
    if (group.status !== "ACTIVE") {
      throw new AppError("GROUP_DELETED", "This Group is not active.");
    }
    if (input.email !== undefined && input.email !== null && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) {
      throw new AppError("VALIDATION_FAILED", "Invalid invite email.");
    }
    if (input.max_uses !== undefined && input.max_uses !== null && input.max_uses < 1) {
      throw new AppError("VALIDATION_FAILED", "max_uses must be at least 1.");
    }
    const token = generateInviteToken();
    const tokenHash = await hashInviteToken(token);
    const expiresAt = new Date(
      Date.now() + this.limits.invite_token_lifetime_days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const invite = await this.invites.insert({
      group_id: groupId,
      created_by: actorUserId,
      email: input.email ?? null,
      role: input.role,
      token_hash: tokenHash,
      expires_at: expiresAt,
      max_uses: input.max_uses ?? null,
    });
    await this.outbox.publish({
      event_type: "member.invited",
      aggregate_type: "group_invite",
      aggregate_id: invite.id,
      group_id: groupId,
      actor_id: actorUserId,
      payload: { email: invite.email, role: invite.role },
    });
    // The raw token is returned exactly once, to the inviting admin. It is
    // never persisted in clear (§8.2).
    return { invite, token };
  }

  async list(groupId: string, actorUserId: string): Promise<GroupInvite[]> {
    await this.membership.requireRole(groupId, actorUserId, ["OWNER", "ADMIN"]);
    return this.invites.listByGroup(groupId);
  }

  async revoke(groupId: string, inviteId: string, actorUserId: string): Promise<void> {
    await this.membership.requireRole(groupId, actorUserId, ["OWNER", "ADMIN"]);
    const invite = await this.invites.findById(inviteId);
    if (!invite || invite.group_id !== groupId) {
      throw new AppError("NOT_FOUND", "Invite not found.");
    }
    if (invite.revoked_at) return;
    await this.invites.markRevoked(inviteId);
  }

  /** Accept via share link token or targeted email invite. */
  async accept(token: string, userId: string): Promise<AcceptInviteResult> {
    const tokenHash = await hashInviteToken(token);
    const invite = await this.invites.findByTokenHash(tokenHash);
    if (!invite || invite.revoked_at) {
      throw new AppError("INVITE_INVALID", "This invite is not valid.");
    }
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      throw new AppError("INVITE_INVALID", "This invite has expired.");
    }
    if (invite.max_uses !== null && invite.uses_count >= invite.max_uses) {
      throw new AppError("INVITE_INVALID", "This invite has reached its use limit.");
    }
    const group = await this.groups.findById(invite.group_id);
    if (!group || group.status !== "ACTIVE") {
      throw new AppError("INVITE_INVALID", "This invite is not valid.");
    }

    const existing = await this.members.findActive(invite.group_id, userId);
    if (existing) {
      return { group_id: invite.group_id, role: existing.role, already_member: true };
    }

    const count = await this.members.countActive(invite.group_id);
    if (count >= this.limits.group_members_initial_max) {
      throw new AppError("GROUP_LIMIT_REACHED", "This Group has reached its member limit.");
    }

    await this.members.insert({
      group_id: invite.group_id,
      user_id: userId,
      role: invite.role,
    });
    await this.invites.incrementUses(invite.id);
    await this.outbox.publish({
      event_type: "member.joined",
      aggregate_type: "group_member",
      aggregate_id: userId,
      group_id: invite.group_id,
      actor_id: userId,
      payload: { role: invite.role },
    });
    return { group_id: invite.group_id, role: invite.role, already_member: false };
  }
}
