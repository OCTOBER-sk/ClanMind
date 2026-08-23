import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberNickname, NicknameRepository } from "@clanmind/domain";

/** Supabase implementation of the §26 nickname contract. */
export class SupabaseNicknameRepository implements NicknameRepository {
  constructor(private readonly db: SupabaseClient) {}

  async upsert(input: {
    group_id: string;
    viewer_user_id: string;
    target_user_id: string;
    nickname: string;
  }): Promise<MemberNickname> {
    const { data, error } = await this.db
      .from("member_nicknames")
      .upsert(input)
      .select()
      .single();
    if (error) throw error;
    return data as MemberNickname;
  }

  async find(
    groupId: string,
    viewerUserId: string,
    targetUserId: string,
  ): Promise<MemberNickname | null> {
    const { data, error } = await this.db
      .from("member_nicknames")
      .select("*")
      .eq("group_id", groupId)
      .eq("viewer_user_id", viewerUserId)
      .eq("target_user_id", targetUserId)
      .maybeSingle();
    if (error) throw error;
    return (data as MemberNickname | null) ?? null;
  }

  async listForViewer(groupId: string, viewerUserId: string): Promise<MemberNickname[]> {
    const { data, error } = await this.db
      .from("member_nicknames")
      .select("*")
      .eq("group_id", groupId)
      .eq("viewer_user_id", viewerUserId);
    if (error) throw error;
    return (data as MemberNickname[]) ?? [];
  }

  async delete(
    groupId: string,
    viewerUserId: string,
    targetUserId: string,
  ): Promise<void> {
    const { error } = await this.db
      .from("member_nicknames")
      .delete()
      .eq("group_id", groupId)
      .eq("viewer_user_id", viewerUserId)
      .eq("target_user_id", targetUserId);
    if (error) throw error;
  }
}
