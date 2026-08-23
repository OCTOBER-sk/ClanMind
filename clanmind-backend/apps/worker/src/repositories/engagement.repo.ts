import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MessagePin,
  MessageReaction,
  PinRepository,
  ReactionRepository,
} from "@clanmind/domain";

/** Supabase implementations of the §41/§39B contracts. */
export class SupabaseReactionRepository implements ReactionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async add(input: {
    message_id: string;
    user_id: string;
    emoji: string;
  }): Promise<MessageReaction> {
    const { data, error } = await this.db
      .from("message_reactions")
      .upsert(input, { onConflict: "message_id,user_id,emoji", ignoreDuplicates: true })
      .select()
      .maybeSingle();
    if (error) throw error;
    if (data) return data as MessageReaction;
    const existing = await this.db
      .from("message_reactions")
      .select("*")
      .eq("message_id", input.message_id)
      .eq("user_id", input.user_id)
      .eq("emoji", input.emoji)
      .maybeSingle();
    if (existing.error) throw existing.error;
    return existing.data as MessageReaction;
  }

  async remove(messageId: string, userId: string, emoji: string): Promise<void> {
    const { error } = await this.db
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
    if (error) throw error;
  }

  async listByMessage(messageId: string): Promise<MessageReaction[]> {
    const { data, error } = await this.db
      .from("message_reactions")
      .select("*")
      .eq("message_id", messageId);
    if (error) throw error;
    return (data as MessageReaction[]) ?? [];
  }
}

export class SupabasePinRepository implements PinRepository {
  constructor(private readonly db: SupabaseClient) {}

  async pin(input: {
    group_id: string;
    project_id: string | null;
    message_id: string;
    pinned_by: string;
  }): Promise<MessagePin> {
    const { data, error } = await this.db
      .from("message_pins")
      .upsert(input, { onConflict: "group_id,message_id" })
      .select()
      .single();
    if (error) throw error;
    return data as MessagePin;
  }

  async unpin(groupId: string, messageId: string): Promise<void> {
    const { error } = await this.db
      .from("message_pins")
      .update({ unpinned_at: new Date().toISOString() })
      .eq("group_id", groupId)
      .eq("message_id", messageId)
      .is("unpinned_at", null);
    if (error) throw error;
  }

  async listOpen(groupId: string): Promise<MessagePin[]> {
    // §39B: the Group pins list is GROUP-visibility only — private-scoped
    // pin rows (if any exist) never surface here.
    const { data, error } = await this.db
      .from("message_pins")
      .select("*")
      .eq("group_id", groupId)
      .eq("visibility", "GROUP")
      .is("unpinned_at", null);
    if (error) throw error;
    return (data as MessagePin[]) ?? [];
  }
}
