import type { GroupRole } from "@clanmind/contracts";

/** §24 */
export interface Group {
  id: string;
  name: string;
  description: string | null;
  avatar_object_id: string | null;
  owner_user_id: string;
  status: "ACTIVE" | "ARCHIVED" | "DELETING" | "DELETED";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** §25 */
export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  removed_at: string | null;
  group_display_name: string | null;
  group_avatar_object_id: string | null;
}

export interface CreateGroupInput {
  name: string;
  description?: string | null;
  owner_user_id: string;
}

export interface UpdateGroupInput {
  name?: string;
  description?: string | null;
  avatar_object_id?: string | null;
}

/** §184 repository contracts over groups/group_members. */
export interface GroupRepository {
  insert(input: CreateGroupInput): Promise<Group>;
  findById(id: string): Promise<Group | null>;
  update(id: string, input: UpdateGroupInput): Promise<Group | null>;
  setStatus(
    id: string,
    status: Group["status"],
    deletedAt: string | null,
  ): Promise<Group | null>;
  listForUser(userId: string): Promise<Group[]>;
}

export interface MembershipRepository {
  insert(input: {
    group_id: string;
    user_id: string;
    role: GroupRole;
  }): Promise<GroupMember>;
  findActive(group_id: string, user_id: string): Promise<GroupMember | null>;
  listActive(group_id: string): Promise<GroupMember[]>;
  countActive(group_id: string): Promise<number>;
  updateRole(group_id: string, user_id: string, role: GroupRole): Promise<GroupMember | null>;
  markRemoved(group_id: string, user_id: string): Promise<void>;
  transferOwnership(group_id: string, fromUserId: string, toUserId: string): Promise<void>;
}
