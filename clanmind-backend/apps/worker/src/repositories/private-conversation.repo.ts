import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PrivateConversation,
  PrivateConversationRepository,
} from "@clanmind/domain";

/** Supabase implementation of the §40 private conversation contract. */
export class SupabasePrivateConversationRepository implements PrivateConversationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findHumanPair(
    groupId: string,
    userA: string,
    userB: string,
  ): Promise<PrivateConversation | null> {
    const { data, error } = await this.db
      .from("private_conversations")
      .select("*, private_conversation_members!inner(user_id)")
      .eq("group_id", groupId)
      .eq("type", "HUMAN_PAIR")
      .in("private_conversation_members.user_id", [userA, userB]);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      group_id: string;
      type: "HUMAN_PAIR" | "AI";
      created_by: string;
      ai_agent_id: string | null;
      created_at: string;
      private_conversation_members: { user_id: string }[];
    }>;
    const match = rows.find(
      (r) =>
        r.private_conversation_members.length === 2 &&
        r.private_conversation_members.some((m) => m.user_id === userA) &&
        r.private_conversation_members.some((m) => m.user_id === userB),
    );
    return match ?? null;
  }

  async findAi(
    groupId: string,
    userId: string,
    aiAgentId: string,
  ): Promise<PrivateConversation | null> {
    const { data, error } = await this.db
      .from("private_conversations")
      .select("*")
      .eq("group_id", groupId)
      .eq("type", "AI")
      .eq("created_by", userId)
      .eq("ai_agent_id", aiAgentId)
      .maybeSingle();
    if (error) throw error;
    return (data as PrivateConversation | null) ?? null;
  }

  async insert(input: {
    group_id: string;
    type: "HUMAN_PAIR" | "AI";
    created_by: string;
    ai_agent_id: string | null;
    member_user_ids: string[];
  }): Promise<PrivateConversation> {
    const { data, error } = await this.db.rpc("create_private_conversation", {
      p_group_id: input.group_id,
      p_type: input.type,
      p_created_by: input.created_by,
      p_ai_agent_id: input.ai_agent_id,
      p_member_user_ids: input.member_user_ids,
    });
    if (error) throw error;
    return data as PrivateConversation;
  }

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from("private_conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  }

  async memberIds(conversationId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from("private_conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId);
    if (error) throw error;
    return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
  }
}
