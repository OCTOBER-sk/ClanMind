/**
 * Members & invites endpoints (BE §104 Members/Invites + handlers/members.ts /
 * handlers/invites.ts) — the ONLY REST sites for membership administration
 * (FE §9 layer boundary):
 *
 *   PATCH  /groups/:groupId/members/:userId { role }            → member row
 *   DELETE /groups/:groupId/members/:userId                     → {ok}
 *   POST   /groups/:groupId/transfer-ownership { new_owner_user_id } → {ok}
 *   POST   /groups/:groupId/invites { email?, role?, max_uses? } → 201 {invite, token}
 *   GET    /groups/:groupId/invites                             → {items}
 *   POST   /groups/:groupId/invites/:inviteId/revoke            → {ok}
 *
 * Role enum is the exact BE vocabulary (OWNER/ADMIN/MEMBER/GUEST). The raw
 * invite token is returned ONCE at creation (BE §8.2) and never again.
 */

import { z } from 'zod';
import { api } from '@/api/client';
import { InviteCreatedSchema, InviteListSchema, MemberRoleSchema } from '@/api/schemas';

export type MemberRole = z.infer<typeof MemberRoleSchema>;

const MemberRowSchema = z
  .object({ user_id: z.string().min(1), role: z.string().min(1) })
  .passthrough();

export async function updateMemberRole(
  groupId: string,
  userId: string,
  role: Exclude<MemberRole, 'OWNER'> | 'OWNER',
): Promise<{ userId: string; role: string }> {
  const raw = await api.patch(
    `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
    { role },
  );
  const parsed = MemberRowSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Member update response failed schema validation.');
  return { userId: parsed.data.user_id, role: parsed.data.role };
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  const raw = await api.delete(`/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`);
  if (!(raw && typeof raw === 'object' && (raw as Record<string, unknown>).ok === true)) {
    throw new Error('Unexpected removal response.');
  }
}

export async function transferOwnership(groupId: string, newOwnerUserId: string): Promise<void> {
  const raw = await api.post(`/groups/${encodeURIComponent(groupId)}/transfer-ownership`, {
    new_owner_user_id: newOwnerUserId,
  });
  if (!(raw && typeof raw === 'object' && (raw as Record<string, unknown>).ok === true)) {
    throw new Error('Unexpected transfer response.');
  }
}

// ─── Invites (§72: Owner/Admin only; §8.2 token shown once) ─────────────────

export interface CreateInviteInput {
  email?: string | null;
  role?: Exclude<MemberRole, 'OWNER'>;
  max_uses?: number | null;
}

export async function createInvite(groupId: string, input: CreateInviteInput): Promise<{ invite: Record<string, unknown>; token: string }> {
  const raw = await api.post(`/groups/${encodeURIComponent(groupId)}/invites`, input);
  const parsed = InviteCreatedSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invite response failed schema validation.');
  return parsed.data as unknown as { invite: Record<string, unknown>; token: string };
}

export type InviteRow = Record<string, unknown> & {
  id: string;
  email?: string | null;
  role?: string;
  expires_at?: string;
  uses_count?: number;
  max_uses?: number | null;
  revoked_at?: string | null;
};

export async function fetchInvites(groupId: string): Promise<InviteRow[]> {
  const raw = await api.get(`/groups/${encodeURIComponent(groupId)}/invites`);
  const parsed = InviteListSchema.safeParse(raw);
  if (!parsed.success) return [];
  return (parsed.data.items ?? []) as unknown as InviteRow[];
}

export async function revokeInvite(groupId: string, inviteId: string): Promise<void> {
  const raw = await api.post(
    `/groups/${encodeURIComponent(groupId)}/invites/${encodeURIComponent(inviteId)}/revoke`,
    {},
  );
  if (!(raw && typeof raw === 'object' && (raw as Record<string, unknown>).ok === true)) {
    throw new Error('Unexpected revoke response.');
  }
}
