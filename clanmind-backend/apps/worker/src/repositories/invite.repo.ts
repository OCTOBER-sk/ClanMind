import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupRole } from "@clanmind/contracts";
import type { GroupInvite, InviteRepository } from "@clanmind/domain";

/** Supabase implementation of the §184 InviteRepository contract. */
export class SupabaseInviteRepository implements InviteRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: {
    group_id: string;
    created_by: string;
    email: string | null;
    role: Exclude<GroupRole, "OWNER">;
    token_hash: string;
    expires_at: string;
    max_uses: number | null;
  }): Promise<GroupInvite> {
    const { data, error } = await this.db
      .from("group_invites")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as GroupInvite;
  }

  async findById(id: string): Promise<GroupInvite | null> {
    const { data, error } = await this.db
      .from("group_invites")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as GroupInvite | null) ?? null;
  }

  async findByTokenHash(tokenHash: string): Promise<GroupInvite | null> {
    const { data, error } = await this.db
      .from("group_invites")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) throw error;
    return (data as GroupInvite | null) ?? null;
  }

  async listByGroup(groupId: string): Promise<GroupInvite[]> {
    const { data, error } = await this.db
      .from("group_invites")
      .select("*")
      .eq("group_id", groupId);
    if (error) throw error;
    return (data as GroupInvite[]) ?? [];
  }

  async markRevoked(id: string): Promise<void> {
    const { error } = await this.db
      .from("group_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  async incrementUses(id: string): Promise<void> {
    // Atomic increment so concurrent accepts cannot exceed max_uses silently.
    const { error } = await this.db.rpc("increment_invite_uses", { p_invite_id: id });
    if (error) throw error;
  }
}
