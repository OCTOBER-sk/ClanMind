import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateProfileInput,
  Profile,
  ProfileRepository,
  UpdateProfileInput,
} from "@clanmind/domain";

type Row = Profile;

/** Supabase-backed implementation of the §184 ProfileRepository contract. */
export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<Profile | null> {
    const { data, error } = await this.db
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as Row | null) ?? null;
  }

  async insert(input: CreateProfileInput): Promise<Profile> {
    const { data, error } = await this.db
      .from("profiles")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as Row;
  }

  async update(id: string, input: UpdateProfileInput): Promise<Profile | null> {
    const { data, error } = await this.db
      .from("profiles")
      .update(input)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as Row | null) ?? null;
  }

  async touchLastSeen(id: string): Promise<void> {
    const { error } = await this.db
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }
}
