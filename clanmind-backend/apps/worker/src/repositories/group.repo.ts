import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupRole } from "@clanmind/contracts";
import type {
  CreateGroupInput,
  Group,
  GroupMember,
  GroupRepository,
  MembershipRepository,
  UpdateGroupInput,
} from "@clanmind/domain";

/** Supabase implementation of the §184 group/membership repository contracts. */
export class SupabaseGroupRepository implements GroupRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: CreateGroupInput): Promise<Group> {
    const { data, error } = await this.db
      .from("groups")
      .insert({
        name: input.name,
        description: input.description ?? null,
        owner_user_id: input.owner_user_id,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Group;
  }

  async findById(id: string): Promise<Group | null> {
    const { data, error } = await this.db
      .from("groups")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as Group | null) ?? null;
  }

  async update(id: string, input: UpdateGroupInput): Promise<Group | null> {
    const { data, error } = await this.db
      .from("groups")
      .update(input)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as Group | null) ?? null;
  }

  async setStatus(
    id: string,
    status: Group["status"],
    deletedAt: string | null,
  ): Promise<Group | null> {
    const { data, error } = await this.db
      .from("groups")
      .update({ status, deleted_at: deletedAt })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as Group | null) ?? null;
  }

  async listForUser(userId: string): Promise<Group[]> {
    const { data, error } = await this.db
      .from("groups")
      .select(
        "*, group_members!inner(user_id, removed_at)",
      )
      .eq("group_members.user_id", userId)
      .is("group_members.removed_at", null);
    if (error) throw error;
    return (data as unknown as Group[]) ?? [];
  }
}

export class SupabaseMembershipRepository implements MembershipRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: {
    group_id: string;
    user_id: string;
    role: GroupRole;
  }): Promise<GroupMember> {
    const { data, error } = await this.db
      .from("group_members")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as GroupMember;
  }

  async findActive(group_id: string, user_id: string): Promise<GroupMember | null> {
    const { data, error } = await this.db
      .from("group_members")
      .select("*")
      .eq("group_id", group_id)
      .eq("user_id", user_id)
      .is("removed_at", null)
      .maybeSingle();
    if (error) throw error;
    return (data as GroupMember | null) ?? null;
  }

  async listActive(group_id: string): Promise<GroupMember[]> {
    const { data, error } = await this.db
      .from("group_members")
      .select("*")
      .eq("group_id", group_id)
      .is("removed_at", null);
    if (error) throw error;
    return (data as GroupMember[]) ?? [];
  }

  async countActive(group_id: string): Promise<number> {
    const { count, error } = await this.db
      .from("group_members")
      .select("user_id", { count: "exact", head: true })
      .eq("group_id", group_id)
      .is("removed_at", null);
    if (error) throw error;
    return count ?? 0;
  }

  async updateRole(
    group_id: string,
    user_id: string,
    role: GroupRole,
  ): Promise<GroupMember | null> {
    const { data, error } = await this.db
      .from("group_members")
      .update({ role })
      .eq("group_id", group_id)
      .eq("user_id", user_id)
      .is("removed_at", null)
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as GroupMember | null) ?? null;
  }

  async markRemoved(group_id: string, user_id: string): Promise<void> {
    const { error } = await this.db
      .from("group_members")
      .update({ removed_at: new Date().toISOString() })
      .eq("group_id", group_id)
      .eq("user_id", user_id)
      .is("removed_at", null);
    if (error) throw error;
  }

  async transferOwnership(
    group_id: string,
    fromUserId: string,
    toUserId: string,
  ): Promise<void> {
    const { error: demote } = await this.db
      .from("group_members")
      .update({ role: "ADMIN" })
      .eq("group_id", group_id)
      .eq("user_id", fromUserId);
    if (demote) throw demote;
    const { error: promote } = await this.db
      .from("group_members")
      .update({ role: "OWNER" })
      .eq("group_id", group_id)
      .eq("user_id", toUserId);
    if (promote) throw promote;
    const { error: owner } = await this.db
      .from("groups")
      .update({ owner_user_id: toUserId })
      .eq("id", group_id);
    if (owner) throw owner;
  }
}
