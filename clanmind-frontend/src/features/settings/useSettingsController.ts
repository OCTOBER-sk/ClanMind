/**
 * Settings feature controller (FE §9 layer boundary) — every Settings REST
 * call funnels through here; SettingsView stays presentation-only.
 *
 * Contract sites:
 *   Profile        GET/PATCH /me                          (BE §104, real)
 *   Group profile  PATCH   /groups/:id                    (BE §104, real)
 *   Roles/removal  PATCH|DELETE /groups/:id/members/:uid,
 *                  POST /groups/:id/transfer-ownership    (BE §104, real)
 *   Invites        POST|GET /groups/:id/invites(+revoke)  (BE §104, real)
 *   AI agent       GET|PATCH /groups/:id/ai/agent         (demo parity, D26)
 *   BYOK removal   DELETE /groups/:id/ai/providers/:cid   (demo parity, D26)
 *   Usage          GET /groups/:id/usage                  (demo parity, D26)
 *   Search probe   POST /groups/:id/search-provider/test  (demo parity, D20)
 *
 * Permission model mirrors the REAL backend checks (domain/membership.service):
 * AI/GitHub/invites/usage are Owner/Admin surfaces; transfer + delete-group are
 * Owner-only. The client HIDES sections the user could never exercise (FE rule
 * 25 / §20) while the server remains the authority.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  fetchAiAgent,
  removeProviderConfig,
  updateAiAgent,
} from '@/api/endpoints/aiConfig';
import { deleteGroup, updateGroup } from '@/api/endpoints/groups';
import {
  createInvite,
  fetchInvites,
  removeMember,
  revokeInvite,
  transferOwnership,
  updateMemberRole,
  type InviteRow,
} from '@/api/endpoints/members';
import { fetchMyProfile, updateMyProfile } from '@/api/endpoints/me';
import { useAuthStore } from '@/state/useAuthStore';
import { useGroupStore } from '@/state/useGroupStore';
import type { AiAgentConfig, Group, GroupMember, GroupRole } from '@/types';

export function errorMessageOf(err: unknown): string {
  if (err instanceof ApiError && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return 'Something went wrong. Try again.';
}

export type PersonalityPreset = AiAgentConfig['personality_config']['preset'];

export type AiPermissionId =
  | 'read_shared_files'
  | 'create_artifacts'
  | 'edit_project_objects'
  | 'use_web'
  | 'read_github'
  | 'modify_github'
  | 'create_pr'
  | 'merge_pr';

/** Exact FE §169 control vocabulary (ids mirror the BE capability names). */
export const AI_PERMISSIONS: Array<{ id: AiPermissionId; label: string }> = [
  { id: 'read_shared_files', label: 'Read shared files' },
  { id: 'create_artifacts', label: 'Create artifacts' },
  { id: 'edit_project_objects', label: 'Edit project objects' },
  { id: 'use_web', label: 'Use web' },
  { id: 'read_github', label: 'Read GitHub' },
  { id: 'modify_github', label: 'Modify GitHub' },
  { id: 'create_pr', label: 'Create PR' },
  { id: 'merge_pr', label: 'Merge PR' },
];

export interface SettingsControllerOptions {
  group: Group;
  members: GroupMember[];
  /** Store-sync callbacks owned by the shell (run AFTER endpoint success). */
  onUpdateGroup: (updates: Partial<Group>) => void;
  onUpdateMemberRole?: (userId: string, role: GroupRole) => void;
  onRemoveMember?: (userId: string) => void;
}

export function useSettingsController({
  group,
  members,
  onUpdateGroup,
  onUpdateMemberRole,
  onRemoveMember,
}: SettingsControllerOptions) {
  const me = useAuthStore((s) => s.user);

  // ─── Role derivation (mirrors the server's requireRole gates) ──────────────
  const myRole: GroupRole | null = useMemo(
    () => members.find((m) => m.user_id === me?.id)?.role ?? null,
    [members, me?.id],
  );
  const isAdmin = myRole === 'OWNER' || myRole === 'ADMIN';
  const isOwner = myRole === 'OWNER';

  // ─── Own profile (§272; GET/PATCH /me) ─────────────────────────────────────
  const [profileName, setProfileName] = useState(me?.name ?? '');
  const [profileEmail, setProfileEmail] = useState(me?.email ?? '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSavedAt, setProfileSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let disposed = false;
    fetchMyProfile()
      .then((row) => {
        if (disposed) return;
        // BE §23: email lives in email_snapshot (D11); display_name is editable.
        setProfileName(row.display_name);
        setProfileEmail(row.email_snapshot ?? row.email ?? me?.email ?? '');
      })
      .catch(() => undefined); // auth-store values remain the honest fallback
    return () => {
      disposed = true;
    };
  }, [me?.email]);

  const profileDirty = profileName.trim() !== (me?.name ?? '') && profileName.trim().length > 0;

  const saveProfile = useCallback(async (): Promise<boolean> => {
    const nextName = profileName.trim();
    if (nextName.length === 0 || nextName === me?.name) return false;
    setIsSavingProfile(true);
    setProfileError(null);
    try {
      await updateMyProfile({ display_name: nextName });
      const { setUser } = useAuthStore.getState();
      if (useAuthStore.getState().user) {
        setUser({ ...useAuthStore.getState().user!, name: nextName });
      }
      setProfileSavedAt(Date.now());
      return true;
    } catch (err) {
      setProfileError(errorMessageOf(err));
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  }, [profileName, me?.name]);

  // ─── Group identity (PATCH /groups/:id — real endpoint) ────────────────────
  const [groupName, setGroupName] = useState(group.name);
  const [groupDesc, setGroupDesc] = useState(group.description ?? '');
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupSavedAt, setGroupSavedAt] = useState<number | null>(null);
  useEffect(() => {
    setGroupName(group.name);
    setGroupDesc(group.description ?? '');
  }, [group.id, group.name, group.description]);
  const groupDirty =
    groupName !== group.name || groupDesc !== (group.description ?? '');

  const saveGroupProfile = useCallback(async (): Promise<boolean> => {
    setIsSavingGroup(true);
    setGroupError(null);
    try {
      await updateGroup(group.id, { name: groupName, description: groupDesc || null });
      onUpdateGroup({ name: groupName, description: groupDesc || undefined });
      setGroupSavedAt(Date.now());
      return true;
    } catch (err) {
      setGroupError(errorMessageOf(err));
      return false;
    } finally {
      setIsSavingGroup(false);
    }
  }, [group.id, group.name, group.description, groupName, groupDesc, onUpdateGroup]);

  // ─── Group AI agent (identity §129, personality §168, permissions §169) ────
  const [agent, setAgent] = useState<AiAgentConfig | null>(null);
  const [agentLoadError, setAgentLoadError] = useState<string | null>(null);
  const [aiName, setAiName] = useState(group.ai_name || 'Odin');
  const [preset, setPreset] = useState<PersonalityPreset>('balanced');
  const [customInstructions, setCustomInstructions] = useState('');
  const [proactivity, setProactivity] = useState<Group['ai_proactivity']>(
    group.ai_proactivity || 'balanced',
  );
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isSavingAgent, setIsSavingAgent] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentSavedAt, setAgentSavedAt] = useState<number | null>(null);

  const hydrateAgentDraft = useCallback(
    (row: AiAgentConfig | null) => {
      setAgent(row);
      if (!row) return;
      setAiName(row.name);
      setPreset(row.personality_config.preset);
      setCustomInstructions(row.personality_config.custom_instructions ?? '');
      setProactivity(row.mode_policy.proactivity ?? group.ai_proactivity ?? 'balanced');
      setPermissions({ ...(row.mode_policy.permissions ?? {}) });
    },
    [group.ai_proactivity],
  );

  useEffect(() => {
    if (!isAdmin) return;
    let disposed = false;
    fetchAiAgent(group.id)
      .then((row) => {
        if (disposed) return;
        if (row) hydrateAgentDraft(row);
      })
      .catch((err: unknown) => {
        if (disposed) return;
        // Live honesty (D26): no real route yet — fall back to Group columns
        // rather than rendering nothing; saving surfaces the true error.
        setAiName(group.ai_name || 'Odin');
        setProactivity(group.ai_proactivity || 'balanced');
        setAgentLoadError(err instanceof ApiError ? err.message : null);
      });
    return () => {
      disposed = true;
    };
  }, [group.id, group.ai_name, group.ai_proactivity, isAdmin, hydrateAgentDraft]);

  const agentDirty =
    agent === null
      ? false
      : aiName !== agent.name ||
        preset !== agent.personality_config.preset ||
        customInstructions !== (agent.personality_config.custom_instructions ?? '') ||
        proactivity !== (agent.mode_policy.proactivity ?? group.ai_proactivity ?? 'balanced') ||
        AI_PERMISSIONS.some(
          ({ id }) => (permissions[id] ?? false) !== (agent.mode_policy.permissions?.[id] ?? false),
        );

  const saveAgent = useCallback(async (): Promise<boolean> => {
    setIsSavingAgent(true);
    setAgentError(null);
    try {
      const updated = await updateAiAgent(group.id, {
        name: aiName.trim() || 'Odin',
        personality_config: {
          preset,
          ...(preset === 'custom' ? { custom_instructions: customInstructions } : {}),
        },
        mode_policy: { proactivity, permissions },
      });
      hydrateAgentDraft(updated);
      // Keep the legacy Group mirror coherent for every other surface.
      onUpdateGroup({ ai_name: updated.name, ai_proactivity: proactivity });
      setAgentSavedAt(Date.now());
      return true;
    } catch (err) {
      setAgentError(errorMessageOf(err));
      return false;
    } finally {
      setIsSavingAgent(false);
    }
  }, [
    group.id,
    aiName,
    preset,
    customInstructions,
    proactivity,
    permissions,
    hydrateAgentDraft,
    onUpdateGroup,
  ]);

  // ─── Members administration (real endpoints) ───────────────────────────────
  const [roleMutationError, setRoleMutationError] = useState<string | null>(null);

  const changeRole = useCallback(
    async (userId: string, role: Exclude<GroupRole, 'OWNER'>): Promise<boolean> => {
      setRoleMutationError(null);
      try {
        await updateMemberRole(group.id, userId, role);
        onUpdateMemberRole?.(userId, role);
        return true;
      } catch (err) {
        setRoleMutationError(errorMessageOf(err));
        return false;
      }
    },
    [group.id, onUpdateMemberRole],
  );

  const removeMemberById = useCallback(
    async (userId: string): Promise<boolean> => {
      setRoleMutationError(null);
      try {
        await removeMember(group.id, userId);
        onRemoveMember?.(userId);
        return true;
      } catch (err) {
        setRoleMutationError(errorMessageOf(err));
        return false;
      }
    },
    [group.id, onRemoveMember],
  );

  const transferTo = useCallback(
    async (userId: string): Promise<boolean> => {
      setRoleMutationError(null);
      try {
        await transferOwnership(group.id, userId);
        // §7.2 outcome — previous Owner becomes Admin; target becomes Owner.
        useGroupStore.getState().transferOwnership(me?.id ?? '', userId);
        return true;
      } catch (err) {
        setRoleMutationError(errorMessageOf(err));
        return false;
      }
    },
    [group.id, me?.id],
  );

  // ─── Invites (§72; Owner/Admin; token shown ONCE — §8.2) ───────────────────
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [pendingToken, setPendingToken] = useState<{ token: string; email: string | null } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSentAt, setInviteSentAt] = useState<number | null>(null);
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const refreshInvites = useCallback(async () => {
    try {
      setInvites(await fetchInvites(group.id));
    } catch {
      setInvites([]); // non-admins get an empty list; they never see the section
    }
  }, [group.id]);

  useEffect(() => {
    if (!isAdmin) return;
    void refreshInvites();
  }, [isAdmin, refreshInvites]);

  const sendInvite = useCallback(
    async (email: string | null, role: Exclude<GroupRole, 'OWNER'>): Promise<boolean> => {
      setIsSendingInvite(true);
      setInviteError(null);
      try {
        const { invite, token } = await createInvite(group.id, { email, role });
        setPendingToken({ token, email: (invite.email as string | null) ?? email });
        setInviteSentAt(Date.now());
        void refreshInvites();
        return true;
      } catch (err) {
        setInviteError(errorMessageOf(err));
        return false;
      } finally {
        setIsSendingInvite(false);
      }
    },
    [group.id, refreshInvites],
  );

  const revokeInviteById = useCallback(
    async (inviteId: string): Promise<boolean> => {
      setInviteError(null);
      try {
        await revokeInvite(group.id, inviteId);
        void refreshInvites();
        return true;
      } catch (err) {
        setInviteError(errorMessageOf(err));
        return false;
      }
    },
    [group.id, refreshInvites],
  );

  // ─── §232 BYOK removal (demo-parity route — D26) ───────────────────────────
  const [byokRemovalError, setByokRemovalError] = useState<string | null>(null);

  const removeProvider = useCallback(
    async (configId: string): Promise<boolean> => {
      setByokRemovalError(null);
      try {
        await removeProviderConfig(group.id, configId);
        return true;
      } catch (err) {
        setByokRemovalError(errorMessageOf(err));
        return false;
      }
    },
    [group.id],
  );

  // ─── §158 search provider probe (demo-parity route — D20/D26) ──────────────
  const testSearchProvider = useCallback(async (): Promise<number> => {
    const raw = await api.post<{ ok?: boolean; results_sampled?: number }>(
      `/groups/${encodeURIComponent(group.id)}/search-provider/test`,
      {},
    );
    return Number(raw?.results_sampled ?? 0);
  }, [group.id]);

  // ─── BE §92 usage (demo-parity route — D26) ────────────────────────────────
  type UsageState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; counters: Record<string, number>; periodStart: string | null }
    | { status: 'error'; message: string };
  const [usage, setUsage] = useState<UsageState>({ status: 'idle' });

  useEffect(() => {
    if (!isAdmin) return;
    let disposed = false;
    setUsage({ status: 'loading' });
    api
      .get(`/groups/${encodeURIComponent(group.id)}/usage`, { retries: 0 })
      .then((raw) => {
        if (disposed) return;
        const body = raw as { counters?: Record<string, number>; period_start?: string | null };
        if (body && typeof body === 'object' && body.counters) {
          setUsage({ status: 'ready', counters: body.counters, periodStart: body.period_start ?? null });
        } else {
          setUsage({ status: 'error', message: 'Usage response failed schema validation.' });
        }
      })
      .catch((err: unknown) => {
        if (disposed) return;
        setUsage({ status: 'error', message: errorMessageOf(err) });
      });
    return () => {
      disposed = true;
    };
  }, [group.id, isAdmin]);

  // ─── §228 group deletion (real soft-delete endpoint) ───────────────────────
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteThisGroup = useCallback(async (): Promise<boolean> => {
    setIsDeletingGroup(true);
    setDeleteError(null);
    try {
      await deleteGroup(group.id);
      return true;
    } catch (err) {
      setDeleteError(errorMessageOf(err));
      return false;
    } finally {
      setIsDeletingGroup(false);
    }
  }, [group.id]);

  return {
    // role gates
    myRole,
    isAdmin,
    isOwner,
    // profile
    profileName,
    setProfileName,
    profileEmail,
    profileDirty,
    isSavingProfile,
    profileError,
    profileSavedAt,
    saveProfile,
    // group identity
    groupName,
    setGroupName,
    groupDesc,
    setGroupDesc,
    groupDirty,
    isSavingGroup,
    groupError,
    groupSavedAt,
    saveGroupProfile,
    // AI agent
    aiName,
    setAiName,
    preset,
    setPreset,
    customInstructions,
    setCustomInstructions,
    proactivity,
    setProactivity,
    permissions,
    setPermissions,
    agentDirty,
    isSavingAgent,
    agentError,
    agentSavedAt,
    agentLoadError,
    saveAgent,
    // members
    changeRole,
    removeMemberById,
    transferTo,
    roleMutationError,
    // invites
    invites,
    pendingToken,
    clearPendingToken: () => setPendingToken(null),
    inviteError,
    inviteSentAt,
    isSendingInvite,
    sendInvite,
    revokeInviteById,
    // byok
    removeProvider,
    byokRemovalError,
    // research probe + usage + danger
    testSearchProvider,
    usage,
    isDeletingGroup,
    deleteError,
    deleteThisGroup,
  };
}

export type SettingsController = ReturnType<typeof useSettingsController>;
