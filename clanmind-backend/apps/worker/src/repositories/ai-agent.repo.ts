import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiAgent, AiAgentRepository } from "@clanmind/domain";

/** Supabase implementation of the §30 ai_agents contract. */
export class SupabaseAiAgentRepository implements AiAgentRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByGroup(groupId: string): Promise<AiAgent | null> {
    const { data, error } = await this.db
      .from("ai_agents")
      .select("*")
      .eq("group_id", groupId)
      .maybeSingle();
    if (error) throw error;
    return (data as AiAgent | null) ?? null;
  }

  async insert(input: { group_id: string; name: string }): Promise<AiAgent> {
    const { data, error } = await this.db
      .from("ai_agents")
      .upsert(input, { onConflict: "group_id", ignoreDuplicates: true })
      .select()
      .maybeSingle();
    if (error) throw error;
    if (data) return data as AiAgent;
    const existing = await this.db
      .from("ai_agents")
      .select("*")
      .eq("group_id", input.group_id)
      .maybeSingle();
    if (existing.error) throw existing.error;
    return existing.data as AiAgent;
  }
}
