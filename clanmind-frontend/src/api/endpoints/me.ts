/**
 * Profile endpoints (BE §104 "Auth/session" + §6.3) — the ONLY REST sites for
 * the user's own profile (FE §9 layer boundary):
 *
 *   GET   /api/v1/me → §23 profile row (email_snapshot column — D11)
 *   PATCH /api/v1/me { display_name?, avatar_object_id? } → profile row
 *
 * Real Worker contract (handlers/me.ts): display_name is 1..100 chars;
 * avatar_object_id is a nullable uuid. Email is a snapshot, never editable.
 */

import { api } from '@/api/client';
import { ProfileSchema } from '@/api/schemas';

export type MyProfile = Record<string, unknown> & {
  id: string;
  display_name: string;
  email?: string | null;
  email_snapshot?: string | null;
};

function parseProfile(raw: unknown): MyProfile {
  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Profile response failed schema validation.');
  return parsed.data as unknown as MyProfile;
}

export async function fetchMyProfile(): Promise<MyProfile> {
  return parseProfile(await api.get('/me'));
}

export interface UpdateProfileInput {
  display_name?: string;
  avatar_object_id?: string | null;
}

/** PATCH /me — returns the updated §23 row; caller renders success feedback. */
export async function updateMyProfile(input: UpdateProfileInput): Promise<MyProfile> {
  return parseProfile(await api.patch('/me', input));
}
