import { AppError } from "@clanmind/shared";

/**
 * §23 / §6.2 / §6.3 — profile domain service.
 * `profiles.id` mirrors Supabase Auth's stable user id. The service layer
 * auto-provisions a profile row on first authenticated contact and keeps
 * `last_seen_at` fresh. Passwords never appear here (Correction 1).
 */

export interface Profile {
  id: string;
  email_snapshot: string | null;
  display_name: string;
  avatar_object_id: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
}

export interface CreateProfileInput {
  id: string;
  email_snapshot: string | null;
  display_name: string;
}

export interface UpdateProfileInput {
  display_name?: string;
  avatar_object_id?: string | null;
}

/** §184: explicit domain contract over the `profiles` table. */
export interface ProfileRepository {
  findById(id: string): Promise<Profile | null>;
  insert(input: CreateProfileInput): Promise<Profile>;
  update(id: string, input: UpdateProfileInput): Promise<Profile | null>;
  touchLastSeen(id: string): Promise<void>;
}

const DISPLAY_NAME_MAX = 100;

export class ProfileService {
  constructor(private readonly profiles: ProfileRepository) {}

  /**
   * Returns the profile for an authenticated identity, provisioning it on
   * first contact. `fallbackName` comes from the auth identity (email
   * local-part) when no display name exists yet.
   */
  async getOrCreate(
    identity: { user_id: string; email: string | null },
    fallbackName?: string,
  ): Promise<Profile> {
    const existing = await this.profiles.findById(identity.user_id);
    if (existing) return existing;

    const displayName =
      (fallbackName ?? "").trim().slice(0, DISPLAY_NAME_MAX) ||
      (identity.email ? identity.email.split("@")[0] ?? "member" : "member");

    try {
      return await this.profiles.insert({
        id: identity.user_id,
        email_snapshot: identity.email,
        display_name: displayName,
      });
    } catch {
      // Unique race on first concurrent contact — read back the winner.
      const raced = await this.profiles.findById(identity.user_id);
      if (raced) return raced;
      throw new AppError("INTERNAL", "Could not provision profile.");
    }
  }

  async get(userId: string): Promise<Profile> {
    const profile = await this.profiles.findById(userId);
    if (!profile) throw new AppError("NOT_FOUND", "Profile not found.");
    return profile;
  }

  async updateMe(userId: string, input: UpdateProfileInput): Promise<Profile> {
    if (input.display_name !== undefined) {
      const name = input.display_name.trim();
      if (name.length === 0 || name.length > DISPLAY_NAME_MAX) {
        throw new AppError("VALIDATION_FAILED", "Display name must be 1–100 characters.");
      }
      input.display_name = name;
    }
    const updated = await this.profiles.update(userId, input);
    if (!updated) throw new AppError("NOT_FOUND", "Profile not found.");
    return updated;
  }

  async markSeen(userId: string): Promise<void> {
    await this.profiles.touchLastSeen(userId);
  }
}
