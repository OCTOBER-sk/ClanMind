import type { GroupRole } from "@clanmind/contracts";
import { AppError } from "@clanmind/shared";
import type { AuditLog, EventOutbox } from "../common/ports";
import type { Group, GroupMember } from "./group.types";
import type { GroupRepository, MembershipRepository } from "./group.types";

/**
 * §7 roles + §7.2 admin hierarchy + §86 authorization chain + §185 invariants.
 *
 * Chain (§86): authenticated → resource exists → belongs to Group → user is
 * member → role allowed → privacy scope. These helpers are the centralized
 * implementation of that chain (§186) so routes never duplicate it.
 *
 * Hierarchy rules (§7.2):
 * - only the Owner can create/remove Admins;
 * - an Admin cannot promote another Admin;
 * - ownership transfer is an audited, explicit action.
 */
export class MembershipService {
  constructor(
    private readonly groups: GroupRepository,
    private readonly members: MembershipRepository,
    private readonly outbox: EventOutbox = { async publish() {} },
    private readonly audit: AuditLog = { async append() {} },
  ) {}

  /** Resource exists + user is an active member. Throws otherwise. */
  async requireMember(
    groupId: string,
    userId: string,
  ): Promise<{ group: Group; member: GroupMember }> {
    const group = await this.groups.findById(groupId);
    if (!group) throw new AppError("NOT_FOUND", "Group not found.");
    const member = await this.members.findActive(groupId, userId);
    if (!member) throw new AppError("FORBIDDEN", "You are not a member of this Group.");
    return { group, member };
  }

  /** Full chain for a write path: membership + role + group not closed. */
  async requireRole(
    groupId: string,
    userId: string,
    roles: readonly GroupRole[],
  ): Promise<{ group: Group; member: GroupMember }> {
    const ctx = await this.requireMember(groupId, userId);
    if (!roles.includes(ctx.member.role)) {
      throw new AppError(
        "GROUP_PERMISSION_DENIED",
        "You do not have permission to perform this action.",
      );
    }
    return ctx;
  }

  /** §185 #10: archived/deleted groups cannot receive normal writes. */
  static assertOpenForWrites(group: Group): void {
    if (group.status !== "ACTIVE") {
      throw new AppError("GROUP_DELETED", "This Group is not active.");
    }
  }

  async listMembers(groupId: string, userId: string): Promise<GroupMember[]> {
    await this.requireMember(groupId, userId);
    return this.members.listActive(groupId);
  }

  /**
   * Change a member's role (§7.1). Rules:
   * - actor must be Owner or Admin (Admins manage members);
   * - granting or revoking ADMIN requires the Owner (§7.2);
   * - an Admin cannot modify another Admin (§7.2);
   * - the Owner's own role changes only via ownership transfer;
   * - a Group always keeps exactly one OWNER (§185 #1).
   */
  async changeRole(
    groupId: string,
    actorUserId: string,
    targetUserId: string,
    newRole: GroupRole,
  ): Promise<GroupMember> {
    const { group, member: actor } = await this.requireRole(groupId, actorUserId, [
      "OWNER",
      "ADMIN",
    ]);
    MembershipService.assertOpenForWrites(group);

    const target = await this.members.findActive(groupId, targetUserId);
    if (!target) throw new AppError("NOT_FOUND", "Member not found.");

    if (target.role === "OWNER" || (targetUserId === actorUserId && actor.role === "OWNER")) {
      throw new AppError(
        "GROUP_PERMISSION_DENIED",
        "Ownership changes require an ownership transfer.",
      );
    }
    if (actor.role === "ADMIN") {
      // §7.2: only the Owner creates/removes Admins; an Admin cannot act on
      // another Admin.
      if (target.role === "ADMIN" || newRole === "ADMIN") {
        throw new AppError(
          "GROUP_PERMISSION_DENIED",
          "Only the Owner can manage Administrators.",
        );
      }
    }
    if (target.role === newRole) return target;

    const updated = await this.members.updateRole(groupId, targetUserId, newRole);
    if (!updated) throw new AppError("NOT_FOUND", "Member not found.");
    await this.outbox.publish({
      event_type: "member.role.changed",
      aggregate_type: "group_member",
      aggregate_id: targetUserId,
      group_id: groupId,
      actor_id: actorUserId,
      payload: { from: target.role, to: newRole },
    });
    await this.audit.append({
      group_id: groupId,
      actor_user_id: actorUserId,
      action_type: "member.role.changed",
      subject_type: "group_member",
      subject_id: targetUserId,
      payload: { from: target.role, to: newRole },
      request_id: null,
    });
    return updated;
  }

  /**
   * Remove a member (§7). Owner removes anyone (except themselves — use
   * transfer or group deletion); Admin removes Members/Guests only. A removed
   * member loses access immediately (§185 #11).
   */
  async removeMember(
    groupId: string,
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    const { group, member: actor } = await this.requireRole(groupId, actorUserId, [
      "OWNER",
      "ADMIN",
    ]);
    MembershipService.assertOpenForWrites(group);

    const target = await this.members.findActive(groupId, targetUserId);
    if (!target) throw new AppError("NOT_FOUND", "Member not found.");

    if (target.role === "OWNER") {
      throw new AppError(
        "GROUP_PERMISSION_DENIED",
        "The Owner cannot be removed. Transfer ownership first.",
      );
    }
    if (actor.role === "ADMIN" && target.role === "ADMIN") {
      throw new AppError(
        "GROUP_PERMISSION_DENIED",
        "Only the Owner can remove Administrators.",
      );
    }

    await this.members.markRemoved(groupId, targetUserId);
    await this.outbox.publish({
      event_type: "member.removed",
      aggregate_type: "group_member",
      aggregate_id: targetUserId,
      group_id: groupId,
      actor_id: actorUserId,
      payload: { role: target.role },
    });
    await this.audit.append({
      group_id: groupId,
      actor_user_id: actorUserId,
      action_type: "member.removed",
      subject_type: "group_member",
      subject_id: targetUserId,
      payload: { role: target.role },
      request_id: null,
    });
  }

  /**
   * §7.2 ownership transfer: explicit, audited. The previous Owner becomes
   * ADMIN; the target becomes OWNER. Preserves §185 invariants 1–2.
   */
  async transferOwnership(
    groupId: string,
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    const { group } = await this.requireRole(groupId, actorUserId, ["OWNER"]);
    MembershipService.assertOpenForWrites(group);
    if (actorUserId === targetUserId) {
      throw new AppError("VALIDATION_FAILED", "Ownership already belongs to you.");
    }
    const target = await this.members.findActive(groupId, targetUserId);
    if (!target) throw new AppError("NOT_FOUND", "Member not found.");

    await this.members.transferOwnership(groupId, actorUserId, targetUserId);
    await this.outbox.publish({
      event_type: "group.owner.transferred",
      aggregate_type: "group",
      aggregate_id: groupId,
      group_id: groupId,
      actor_id: actorUserId,
      payload: { new_owner_user_id: targetUserId },
    });
    await this.audit.append({
      group_id: groupId,
      actor_user_id: actorUserId,
      action_type: "group.owner.transferred",
      subject_type: "group_member",
      subject_id: targetUserId,
      payload: { new_owner_user_id: targetUserId },
      request_id: null,
    });
  }
}
