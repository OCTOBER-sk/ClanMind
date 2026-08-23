import { AppError } from "@clanmind/shared";
import type { EventOutbox } from "../common/ports";
import { MembershipService } from "./membership.service";
import { isWithinRecoveryWindow } from "./deletion.service";
import type {
  CreateGroupInput,
  Group,
  GroupRepository,
  MembershipRepository,
  UpdateGroupInput,
} from "./group.types";

const GROUP_NAME_MAX = 80;
const DESCRIPTION_MAX = 500;

/**
 * §7 Group domain: Group CRUD, roles, ownership.
 * Invariants (§185): a Group always has exactly one OWNER (invariant 1) and
 * the OWNER is always a member (invariant 2) — both established at creation
 * and preserved by ownership operations in MembershipService (A3).
 */
export class GroupService {
  constructor(
    private readonly groups: GroupRepository,
    private readonly members: MembershipRepository,
    private readonly membership: MembershipService,
    private readonly outbox: EventOutbox,
    private readonly limits: { group_soft_delete_recovery_days: number } = {
      group_soft_delete_recovery_days: 30,
    },
  ) {}

  async create(input: CreateGroupInput): Promise<Group> {
    const name = input.name.trim();
    if (name.length === 0 || name.length > GROUP_NAME_MAX) {
      throw new AppError("VALIDATION_FAILED", "Group name must be 1–80 characters.");
    }
    const description = input.description?.trim() ?? null;
    if (description && description.length > DESCRIPTION_MAX) {
      throw new AppError("VALIDATION_FAILED", "Description must be at most 500 characters.");
    }
    const group = await this.groups.insert({
      name,
      description: description || null,
      owner_user_id: input.owner_user_id,
    });
    // Creator becomes OWNER member — invariants 1 & 2 of §185.
    await this.members.insert({
      group_id: group.id,
      user_id: input.owner_user_id,
      role: "OWNER",
    });
    await this.outbox.publish({
      event_type: "group.created",
      aggregate_type: "group",
      aggregate_id: group.id,
      group_id: group.id,
      actor_id: input.owner_user_id,
      payload: { name: group.name },
    });
    return group;
  }

  async get(groupId: string, userId: string): Promise<Group> {
    const group = await this.groups.findById(groupId);
    if (!group) throw new AppError("NOT_FOUND", "Group not found.");
    const member = await this.members.findActive(groupId, userId);
    if (!member) throw new AppError("FORBIDDEN", "You are not a member of this Group.");
    return group;
  }

  listForUser(userId: string): Promise<Group[]> {
    return this.groups.listForUser(userId);
  }

  /** §7: Owner/Admin configure most Group settings. */
  async update(
    groupId: string,
    actorUserId: string,
    input: UpdateGroupInput,
  ): Promise<Group> {
    const { group } = await this.membership.requireRole(groupId, actorUserId, [
      "OWNER",
      "ADMIN",
    ]);
    MembershipService.assertOpenForWrites(group);
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length === 0 || name.length > GROUP_NAME_MAX) {
        throw new AppError("VALIDATION_FAILED", "Group name must be 1–80 characters.");
      }
      input.name = name;
    }
    const updated = await this.groups.update(groupId, input);
    if (!updated) throw new AppError("NOT_FOUND", "Group not found.");
    await this.outbox.publish({
      event_type: "group.updated",
      aggregate_type: "group",
      aggregate_id: groupId,
      group_id: groupId,
      actor_id: actorUserId,
      payload: { fields: Object.keys(input) },
    });
    return updated;
  }

  /**
   * §9 Stage 1 soft delete. Only the Owner may delete the Group (§7.1).
   * Status becomes DELETING with deleted_at set; normal members lose access
   * (§185 #10). Stage 2 recovery + Stage 3 permanent deletion land in A5.
   */
  async softDelete(groupId: string, actorUserId: string): Promise<Group> {
    const { group } = await this.membership.requireRole(groupId, actorUserId, ["OWNER"]);
    if (group.status === "DELETING" || group.status === "DELETED") {
      throw new AppError("CONFLICT", "Group is already deleted or deleting.");
    }
    const updated = await this.groups.setStatus(
      groupId,
      "DELETING",
      new Date().toISOString(),
    );
    if (!updated) throw new AppError("NOT_FOUND", "Group not found.");
    await this.outbox.publish({
      event_type: "group.deleted",
      aggregate_type: "group",
      aggregate_id: groupId,
      group_id: groupId,
      actor_id: actorUserId,
      payload: { soft: true },
    });
    return updated;
  }

  /**
   * §9 Stage 2: the Owner restores a soft-deleted Group within the recovery
   * window (§178: 30 days default, configuration-driven).
   */
  async restore(groupId: string, actorUserId: string): Promise<Group> {
    const { group } = await this.membership.requireRole(groupId, actorUserId, ["OWNER"]);
    if (group.status !== "DELETING") {
      throw new AppError("CONFLICT", "Only a soft-deleted Group can be restored.");
    }
    if (
      !isWithinRecoveryWindow(
        group.deleted_at,
        this.limits.group_soft_delete_recovery_days,
      )
    ) {
      throw new AppError(
        "CONFLICT",
        "The recovery window for this Group has elapsed.",
      );
    }
    const restored = await this.groups.setStatus(groupId, "ACTIVE", null);
    if (!restored) throw new AppError("NOT_FOUND", "Group not found.");
    await this.outbox.publish({
      event_type: "group.updated",
      aggregate_type: "group",
      aggregate_id: groupId,
      group_id: groupId,
      actor_id: actorUserId,
      payload: { restored: true },
    });
    return restored;
  }
}
