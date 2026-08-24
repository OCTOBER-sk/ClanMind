import React, { useEffect, useState } from 'react';
import {
  Settings,
  Users,
  Sparkles,
  Search,
  GitBranch,
  Bell,
  ShieldAlert,
  Key,
  Check,
  Activity,
  Loader2,
  Brain,
  Plus,
  UserRound,
  Palette,
  Info,
  BarChart3,
  Trash2,
} from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Switch } from '@/design-system/components/Switch';
import { Badge } from '@/design-system/components/Badge';
import { Input } from '@/design-system/components/Input';
import { Dialog } from '@/design-system/components/Dialog';
import { cn } from '@/design-system/utils';
import { SyncDiagnosticsView } from '@/features/sync/SyncDiagnosticsView';
import { resolveConflictThroughSync } from '@/sync/outbox';
import { useSyncStore } from '@/state/useSyncStore';
import { useAuthStore } from '@/state/useAuthStore';
import {
  fetchAiConfig,
  fetchProviderModels,
  saveModelRoutes,
  validateProviderKey,
  type ModelRouteInput,
} from '@/api/endpoints/aiConfig';
import {
  GITHUB_STATUS_LABEL,
  errorMessageOf as githubErrorMessageOf,
  useGithubConnection,
} from '@/features/github/useGithubConnection';
import { ApiError } from '@/api/errors';
import {
  AI_PERMISSIONS,
  useSettingsController,
  type PersonalityPreset,
  type SettingsController,
} from '@/features/settings/useSettingsController';
import { useUiStore } from '@/state/useUiStore';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  loadHidePreview,
  saveHidePreview,
  DEFAULT_CHANNELS,
  type ChannelPrefs,
} from '@/features/notifications/notificationPrefs';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import { requestNotificationPermission } from '@/tauri/bridge';
import { useToast } from '@/design-system/components/Toast';
import type {
  Group,
  GroupMember,
  GroupRole,
  ServerFeatureFlags,
  NotificationCategory,
  AiProviderConfig,
  AiModelRoute,
  ModelDescriptor,
} from '@/types';

export interface SettingsViewProps {
  group: Group;
  members: GroupMember[];
  featureFlags: ServerFeatureFlags;
  onUpdateGroup: (updates: Partial<Group>) => void;
  onUpdateFeatureFlags: (flags: ServerFeatureFlags) => void;
  onTransferOwnership: () => void;
  onDeleteGroup: () => void;
  onUpdateMemberRole?: (userId: string, role: GroupRole) => void;
  onRemoveMember?: (userId: string) => void;
}

type SettingsSection =
  | 'account'
  | 'appearance'
  | 'general'
  | 'members'
  | 'ai'
  | 'skills'
  | 'research'
  | 'github'
  | 'notifications'
  | 'usage'
  | 'security'
  | 'diagnostics'
  | 'danger';

/** §156 provider list — mirrors BE PROVIDER_BASE_URLS keys. */
const PROVIDERS = ['anthropic', 'openai', 'google', 'openrouter'] as const;

const ROUTE_ROLES: Array<{ role: ModelRouteInput['role']; label: string }> = [
  { role: 'PRIMARY', label: 'Primary' },
  { role: 'FALLBACK_1', label: 'Fallback 1' },
  { role: 'FALLBACK_2', label: 'Fallback 2' },
  { role: 'FALLBACK_3', label: 'Fallback 3' },
];

// §171 — exact backend category identifiers, mapped 1:1
const NOTIFICATION_CATEGORIES: Array<{
  id: NotificationCategory;
  label: string;
}> = [
  { id: 'MENTION', label: 'Mentions' },
  { id: 'PRIVATE_MESSAGE', label: 'Private' },
  { id: 'AI_RESPONSE', label: 'AI' },
  { id: 'AI_ACTION_APPROVAL', label: 'Approvals' },
  { id: 'TASK_ASSIGNMENT', label: 'Tasks' },
  { id: 'DECISION_APPROVAL', label: 'Decisions' },
  { id: 'ARTIFACT_READY', label: 'Artifacts' },
  { id: 'GITHUB_EVENT', label: 'GitHub' },
  { id: 'MEETING_SUMMARY', label: 'Meeting' },
  { id: 'PROACTIVE_AI', label: 'Odin suggestions' },
  { id: 'SYSTEM', label: 'System' },
];

// ChannelPrefs + DEFAULT_CHANNELS come from the shared §171 prefs module so
// the Settings matrix and the OS-notification pipeline read one source.

// §165A.2 skill list with risk visibility (§155)
const BUILT_IN_SKILLS = [
  { id: 'web_research', name: 'Web Research', risk: 'Read' },
  { id: 'deep_research', name: 'Deep Research', risk: 'Read' },
  { id: 'brainstorming', name: 'Brainstorming', risk: 'None' },
  { id: 'planning', name: 'Planning', risk: 'None' },
  { id: 'decision_analysis', name: 'Decision Analysis', risk: 'None' },
  { id: 'task_decomposition', name: 'Task Decomposition', risk: 'None' },
  { id: 'diagram', name: 'Diagram', risk: 'Create artifacts' },
  { id: 'document', name: 'Document', risk: 'Create artifacts' },
  { id: 'data_visualization', name: 'Data Visualization', risk: 'Create artifacts' },
  { id: 'meeting_facilitation', name: 'Meeting Facilitation', risk: 'Meeting state' },
  { id: 'github_analysis', name: 'GitHub Analysis', risk: 'Read GitHub' },
  { id: 'github_write', name: 'GitHub Changes', risk: 'Write GitHub' },
] as const;

/** §168 personality presets — exact spec vocabulary. */
const PERSONALITY_PRESETS: Array<{ id: PersonalityPreset; label: string }> = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'direct', label: 'Direct' },
  { id: 'creative', label: 'Creative' },
  { id: 'analytical', label: 'Analytical' },
  { id: 'custom', label: 'Custom' },
];

/** BE §228 recovery window — mirrors limits.group_soft_delete_recovery_days. */
const GROUP_RECOVERY_DAYS = 30;

export function SettingsView({
  group,
  members,
  featureFlags,
  onUpdateGroup,
  onUpdateFeatureFlags: _onUpdateFeatureFlags,
  onTransferOwnership,
  onDeleteGroup,
  onUpdateMemberRole,
  onRemoveMember,
}: SettingsViewProps) {
  const ctl = useSettingsController({
    group,
    members,
    onUpdateGroup,
    onUpdateMemberRole,
    onRemoveMember,
  });
  const me = useAuthStore((s) => s.user);
  const { toast } = useToast();
  const { theme, setTheme } = useUiStore();
  // §285 diagnostics inputs — read unconditionally (stable hook order).
  const sync = useSyncStore();
  const notifications = useProjectDataStore((s) => s.notifications);

  // Role-gated sections (§20 hide-don't-disable; §303 guests get the minimum;
  // Owner-only surfaces stay Owner-only — the server re-checks everything).
  const canSee = useMemoSectionVisibility(ctl.isAdmin, ctl.isOwner, ctl.myRole);

  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  // Deep-link safety: if the active section isn't visible to this role, fall
  // back to the first permitted one instead of rendering a blank pane.
  useEffect(() => {
    if (!canSee.includes(activeSection)) setActiveSection(canSee[0] ?? 'account');
  }, [canSee, activeSection]);

  const navItems: Array<{ id: SettingsSection; label: string; icon: React.ReactNode }> = [
    { id: 'account', label: 'Account', icon: <UserRound className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    ...(canSee.includes('general')
      ? [{ id: 'general' as const, label: 'General', icon: <Settings className="w-4 h-4" /> }]
      : []),
    ...(canSee.includes('members')
      ? [{ id: 'members' as const, label: 'Members', icon: <Users className="w-4 h-4" /> }]
      : []),
    ...(canSee.includes('ai')
      ? [{ id: 'ai' as const, label: 'AI', icon: <Sparkles className="w-4 h-4" /> }]
      : []),
    ...(canSee.includes('skills')
      ? [{ id: 'skills' as const, label: 'Skills', icon: <Brain className="w-4 h-4" /> }]
      : []),
    ...(canSee.includes('research')
      ? [{ id: 'research' as const, label: 'Research', icon: <Search className="w-4 h-4" /> }]
      : []),
    ...(canSee.includes('github')
      ? [{ id: 'github' as const, label: 'GitHub', icon: <GitBranch className="w-4 h-4" /> }]
      : []),
    ...(canSee.includes('notifications')
      ? [{ id: 'notifications' as const, label: 'Notifications', icon: <Bell className="w-4 h-4" /> }]
      : []),
    ...(canSee.includes('usage')
      ? [{ id: 'usage' as const, label: 'Usage', icon: <BarChart3 className="w-4 h-4" /> }]
      : []),
    ...(canSee.includes('security')
      ? [{ id: 'security' as const, label: 'Security', icon: <ShieldAlert className="w-4 h-4" /> }]
      : []),
    ...(canSee.includes('diagnostics')
      ? [{ id: 'diagnostics' as const, label: 'Sync Diagnostics', icon: <Activity className="w-4 h-4" /> }]
      : []),
    ...(canSee.includes('danger')
      ? [{ id: 'danger' as const, label: 'Danger Zone', icon: <ShieldAlert className="w-4 h-4" /> }]
      : []),
  ];

  const inputClass =
    'w-full px-3.5 py-2 rounded-lg border outline-none focus:shadow-[var(--focus-ring)]';

  const card = 'p-4 rounded-xl border space-y-4';
  const cardBorder = { borderColor: 'var(--color-border)' } as const;
  const sectionHeading = (title: string, sub: string) => (
    <div>
      <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
        {title}
      </h2>
      <p style={{ color: 'var(--color-text-secondary)' }}>{sub}</p>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden text-xs" style={{ background: 'var(--color-background)' }}>
      {/* Left Settings Sidebar (§166) */}
      <div
        className="w-56 p-4 border-r space-y-1"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <h2
          className="text-xs font-bold uppercase tracking-wider px-3 mb-3"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          Group Settings
        </h2>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-left',
              activeSection === item.id
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-fg)] shadow-[var(--shadow-sm)]'
                : 'hover:bg-[var(--color-surface-hover)]'
            )}
            style={activeSection === item.id ? undefined : { color: 'var(--color-text-secondary)' }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Right Settings Content */}
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl space-y-8">
        {/* ── ACCOUNT (§272 User Profile; GET/PATCH /me) ── */}
        {activeSection === 'account' && (
          <div className="space-y-6">
            {sectionHeading('Account', 'Your global profile (§272).')}
            <div className={card} style={cardBorder}>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text)' }}
                  aria-hidden="true"
                >
                  {(ctl.profileName || me?.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    {ctl.profileName || me?.name}
                  </div>
                  {ctl.myRole && (
                    <Badge variant={ctl.myRole === 'OWNER' ? 'spectral' : 'neutral'} size="sm">
                      {ctl.myRole}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Display name
                </label>
                <Input
                  value={ctl.profileName}
                  onChange={(e) => ctl.setProfileName(e.target.value)}
                  maxLength={100}
                  aria-label="Display name"
                />
              </div>

              {/* §272 global email — snapshot column (BE §23), never editable here */}
              <div className="space-y-1">
                <span className="block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Email
                </span>
                <span data-testid="account-email" style={{ color: 'var(--color-text)' }}>
                  {ctl.profileEmail || '—'}
                </span>
              </div>

              {/* §279 dirty state — only when something meaningful is pending */}
              {ctl.profileDirty && (
                <p className="text-[11px]" style={{ color: 'var(--color-warning)' }}>
                  Unsaved changes
                </p>
              )}
              {ctl.profileError && (
                <p className="text-[11px]" role="alert" style={{ color: 'var(--color-danger)' }}>
                  {ctl.profileError}
                </p>
              )}
              {ctl.profileSavedAt !== null && !ctl.profileDirty && (
                <p className="text-[11px]" role="status" style={{ color: 'var(--color-success)' }}>
                  Saved.
                </p>
              )}
              <Button
                size="sm"
                variant="primary"
                disabled={!ctl.profileDirty}
                isLoading={ctl.isSavingProfile}
                onClick={() =>
                  void ctl.saveProfile().then((ok) => {
                    if (ok) toast({ title: 'Profile saved', variant: 'success' });
                  })
                }
              >
                Save profile
              </Button>
            </div>
          </div>
        )}

        {/* ── APPEARANCE (theme = §11 local UI preference) ── */}
        {activeSection === 'appearance' && (
          <div className="space-y-6">
            {sectionHeading('Appearance', 'Theme preference for this device.')}
            <div className={card} style={cardBorder}>
              <fieldset>
                <legend className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Theme
                </legend>
                <div className="flex gap-2" role="radiogroup" aria-label="Theme">
                  {(['light', 'dark', 'system'] as const).map((option) => (
                    <label
                      key={option}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer capitalize',
                        theme === option && 'border-[var(--color-primary)]',
                      )}
                      style={{
                        borderColor: theme === option ? undefined : 'var(--color-border)',
                        background: theme === option ? 'var(--color-surface-hover)' : 'var(--color-surface-raised)',
                        color: 'var(--color-text)',
                      }}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={option}
                        checked={theme === option}
                        onChange={() => setTheme(option)}
                        aria-label={`${option} theme`}
                      />
                      <span className="capitalize">{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                System follows your OS preference automatically. This choice stays on this device
                and is never synced to the server.
              </p>
            </div>
          </div>
        )}

        {/* ── GENERAL / group identity (admin; PATCH /groups/:id) ── */}
        {activeSection === 'general' && (
          <div className="space-y-6">
            {sectionHeading('General Information', 'Group profile and identity.')}
            <div className="space-y-4">
              {/* §274 group avatar — generated initials (upload surface has no
                  object-storage contract yet; recorded in INTEGRATION_NOTES D26) */}
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg"
                  style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text)' }}
                  aria-hidden="true"
                >
                  {group.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  Group avatar shows generated initials.
                </span>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Group Name
                </label>
                <Input value={ctl.groupName} onChange={(e) => ctl.setGroupName(e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Description
                </label>
                <textarea
                  value={ctl.groupDesc}
                  onChange={(e) => ctl.setGroupDesc(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className={inputClass}
                  style={{
                    borderColor: 'var(--color-border-strong)',
                    background: 'var(--color-surface-raised)',
                    color: 'var(--color-text)',
                  }}
                />
              </div>
              {/* §279 dirty state */}
              {ctl.groupDirty && (
                <p className="text-[11px]" style={{ color: 'var(--color-warning)' }}>
                  Unsaved changes
                </p>
              )}
              {ctl.groupError && (
                <p className="text-[11px]" role="alert" style={{ color: 'var(--color-danger)' }}>
                  {ctl.groupError}
                </p>
              )}
              {ctl.groupSavedAt !== null && !ctl.groupDirty && (
                <p className="text-[11px]" role="status" style={{ color: 'var(--color-success)' }}>
                  Saved.
                </p>
              )}
              <Button
                size="sm"
                variant="primary"
                disabled={!ctl.groupDirty}
                isLoading={ctl.isSavingGroup}
                onClick={() =>
                  void ctl.saveGroupProfile().then((ok) => {
                    if (ok) toast({ title: 'Settings saved', variant: 'success' });
                  })
                }
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}

        {/* ── MEMBERS (§20, §170, §229, §230) ── */}
        {activeSection === 'members' && (
          <div className="space-y-6">
            {sectionHeading(
              'Members & Roles',
              ctl.isAdmin
                ? 'Manage teammates, invites and permissions in this Group.'
                : 'Teammates in this Group.',
            )}
            {ctl.roleMutationError && (
              <p className="text-[11px]" role="alert" style={{ color: 'var(--color-danger)' }}>
                {ctl.roleMutationError}
              </p>
            )}
            <MembersRoster ctl={ctl} members={members} />

            {/* §72 invite flow — Owner/Admin only */}
            {ctl.isAdmin && <InviteCard ctl={ctl} groupName={group.name} />}
          </div>
        )}

        {/* ── AI (§129, §150, §156–§157, §167–§169) ── */}
        {activeSection === 'ai' && (
          <div className="space-y-6">
            {sectionHeading('AI Teammate Configuration', "Configure your Group's shared AI identity and provider keys.")}

            {/* Identity + personality + permissions — ONE §280 section-level save */}
            <div className={card} style={cardBorder}>
              <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
                AI Identity &amp; Behavior
              </h3>
              <div className="space-y-1">
                <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  AI Name
                </label>
                <Input value={ctl.aiName} onChange={(e) => ctl.setAiName(e.target.value)} maxLength={20} aria-label="AI Name" />
              </div>

              {/* §168 personality presets + custom instructions */}
              <div className="space-y-1">
                <span className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Personality
                </span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Personality preset">
                  {PERSONALITY_PRESETS.map((p) => (
                    <label
                      key={p.id}
                      className={cn(
                        'px-3 py-1.5 rounded-lg border cursor-pointer',
                        ctl.preset === p.id && 'border-[var(--color-primary)]',
                      )}
                      style={{
                        borderColor: ctl.preset === p.id ? undefined : 'var(--color-border)',
                        background: ctl.preset === p.id ? 'var(--color-surface-hover)' : 'var(--color-surface-raised)',
                        color: 'var(--color-text)',
                      }}
                    >
                      <input
                        type="radio"
                        name="personality-preset"
                        className="sr-only"
                        value={p.id}
                        checked={ctl.preset === p.id}
                        onChange={() => ctl.setPreset(p.id)}
                        aria-label={p.label}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
                {ctl.preset === 'custom' && (
                  <textarea
                    value={ctl.customInstructions}
                    onChange={(e) => ctl.setCustomInstructions(e.target.value)}
                    placeholder="Describe exactly how your AI teammate should behave…"
                    rows={4}
                    aria-label="Custom instructions"
                    className={`${inputClass} mt-2`}
                    style={{
                      borderColor: 'var(--color-border-strong)',
                      background: 'var(--color-surface-raised)',
                      color: 'var(--color-text)',
                    }}
                  />
                )}
              </div>

              {/* §165A.2 proactive_ai flag hides the proactivity setting entirely */}
              {featureFlags.proactive_ai !== false && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    Proactivity
                  </label>
                  <select
                    value={ctl.proactivity}
                    onChange={(e) => ctl.setProactivity(e.target.value as Group['ai_proactivity'])}
                    className="px-3.5 py-2 rounded-lg border outline-none w-64 cursor-pointer"
                    aria-label="Proactivity"
                    style={{
                      borderColor: 'var(--color-border-strong)',
                      background: 'var(--color-surface-raised)',
                      color: 'var(--color-text)',
                    }}
                  >
                    <option value="off">Off (Speak only when addressed)</option>
                    <option value="low">Low</option>
                    <option value="balanced">Balanced (Default)</option>
                    <option value="high">High</option>
                  </select>
                </div>
              )}

              {ctl.agentLoadError && (
                <p className="text-[11px]" role="alert" style={{ color: 'var(--color-warning)' }}>
                  {ctl.agentLoadError}
                </p>
              )}
              {/* §279 dirty state */}
              {ctl.agentDirty && (
                <p className="text-[11px]" style={{ color: 'var(--color-warning)' }}>
                  Unsaved changes
                </p>
              )}
              {ctl.agentError && (
                <p className="text-[11px]" role="alert" style={{ color: 'var(--color-danger)' }}>
                  {ctl.agentError}
                </p>
              )}
              {ctl.agentSavedAt !== null && !ctl.agentDirty && (
                <p className="text-[11px]" role="status" style={{ color: 'var(--color-success)' }}>
                  Saved.
                </p>
              )}
              {/* §280 section-level save */}
              <Button
                size="sm"
                variant="primary"
                disabled={!ctl.agentDirty}
                isLoading={ctl.isSavingAgent}
                onClick={() =>
                  void ctl.saveAgent().then((ok) => {
                    if (ok) toast({ title: 'Settings saved', variant: 'success' });
                  })
                }
              >
                Save AI Settings
              </Button>
            </div>

            {/* §169 explicit capability toggles — same section-level save */}
            <div className={card} style={cardBorder}>
              <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
                AI Permissions
              </h3>
              <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {AI_PERMISSIONS.map(({ id, label }) => {
                  // §165A.2 — server-off flags HIDE risky affordances entirely.
                  if (id === 'merge_pr' && featureFlags.github_merge === false) return null;
                  return (
                    <div key={id} className="flex items-center justify-between py-2.5" data-testid={`perm-${id}`}>
                      <span style={{ color: 'var(--color-text)' }}>{label}</span>
                      <Switch
                        checked={ctl.permissions[id] ?? false}
                        onCheckedChange={(v) => ctl.setPermissions((prev) => ({ ...prev, [id]: v }))}
                        aria-label={label}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <ByokCard ctl={ctl} groupId={group.id} />
          </div>
        )}

        {/* ── SKILLS (§152, §154, §155) ── */}
        {activeSection === 'skills' && (
          <div className="space-y-6">
            {sectionHeading('Skills & Tools', 'Built-in skills plus Group custom skills.')}
            <div className={card} style={cardBorder}>
              <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
                Built-in skills
              </h3>
              <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {BUILT_IN_SKILLS.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2.5">
                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                      {s.name}
                    </span>
                    <span className="flex items-center gap-2">
                      {/* §155 High access risk */}
                      {s.risk.includes('Write') ? (
                        <Badge variant="danger" size="sm">
                          High access
                        </Badge>
                      ) : s.risk !== 'None' ? (
                        <Badge variant="neutral" size="sm">
                          {s.risk}
                        </Badge>
                      ) : null}
                      <Badge variant="success" size="sm">
                        Enabled
                      </Badge>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* §165A.2 custom_skills flag hides the add affordance */}
            {featureFlags.custom_skills !== false && (
              <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => {}}>
                Add custom skill
              </Button>
            )}
          </div>
        )}

        {/* ── RESEARCH (§158, §148) ── */}
        {activeSection === 'research' && (
          <ResearchSection ctl={ctl} featureFlags={featureFlags} sectionHeading={sectionHeading} card={card} cardBorder={cardBorder} />
        )}

        {/* ── GITHUB (§159–§165, §231) ── */}
        {activeSection === 'github' && (
          <div className="space-y-6">
            {sectionHeading('GitHub Connection', 'Repository access for your Group.')}
            <SettingsGithubCard groupId={group.id} />
          </div>
        )}

        {/* ── NOTIFICATIONS (§171) — all 11 categories, 3 channels ── */}
        {activeSection === 'notifications' && (
          <NotificationsSection groupId={group.id} sectionHeading={sectionHeading} />
        )}

        {/* ── USAGE (BE §92 counters; demo-parity route — D26) ── */}
        {activeSection === 'usage' && (
          <div className="space-y-6">
            {sectionHeading('Usage', 'Application AI metering for this Group.')}

            {ctl.usage.status === 'loading' && (
              <p className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Loading usage…
              </p>
            )}
            {ctl.usage.status === 'error' && (
              <p className="text-xs" role="alert" style={{ color: 'var(--color-danger)' }}>
                {ctl.usage.message}
              </p>
            )}
            {ctl.usage.status === 'ready' && (
              <>
                <div
                  className="grid grid-cols-2 gap-3 rounded-xl border p-4"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
                  data-testid="usage-counters"
                >
                  <UsageCell label="AI requests" value={ctl.usage.counters.ai_requests} />
                  <UsageCell label="Tool calls" value={ctl.usage.counters.tool_calls} />
                  <UsageCell label="Input tokens" value={ctl.usage.counters.input_tokens} />
                  <UsageCell label="Output tokens" value={ctl.usage.counters.output_tokens} />
                  <UsageCell
                    label="Estimated cost"
                    value={`$${Number(ctl.usage.counters.estimated_cost ?? 0).toFixed(2)}`}
                  />
                  <UsageCell label="Research calls" value={ctl.usage.counters.research_calls} />
                  <UsageCell label="Research sources" value={ctl.usage.counters.research_sources} />
                  <UsageCell label="Artifact generations" value={ctl.usage.counters.artifact_generations} />
                  <UsageCell label="GitHub actions" value={ctl.usage.counters.github_actions} />
                  <UsageCell
                    label="Shared storage"
                    value={`${(Number(ctl.usage.counters.shared_storage_bytes ?? 0) / (1024 * 1024)).toFixed(1)} MB`}
                  />
                </div>
                {ctl.usage.periodStart && (
                  <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    Counters since {new Date(ctl.usage.periodStart).toLocaleDateString()}.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── SECURITY (§292 statements; session action) ── */}
        {activeSection === 'security' && (
          <div className="space-y-6">
            {sectionHeading('Security', 'Session and key-handling guarantees.')}
            <div className={card} style={cardBorder}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    Signed in as {me?.email ?? ctl.profileEmail}
                  </h4>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                    Signing out keeps local drafts safe on this device.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => useAuthStore.getState().logout()}>
                  Sign out
                </Button>
              </div>
            </div>
            <SecurityStatement
              text="Provider keys are validated server-side and are never stored on this device or shown again."
            />
            <SecurityStatement text="Diagnostics never include API keys, secrets or private conversations." />
          </div>
        )}

        {/* ── SYNC DIAGNOSTICS (§285) ── */}
        {activeSection === 'diagnostics' && (
          <SyncDiagnosticsView
            status={sync.status}
            checkpoint={sync.checkpoint}
            pendingOperations={sync.pendingOperations}
            conflicts={sync.conflicts}
            notifications={notifications}
            onResolveConflict={(id, strategy) =>
              void resolveConflictThroughSync(id, strategy, useAuthStore.getState().user?.id ?? '')
            }
            onDismissOperation={(clientOperationId) =>
              useSyncStore.getState().dismissOperation(clientOperationId)
            }
          />
        )}

        {/* ── DANGER ZONE (§228, §229, §282) — Owner only ── */}
        {activeSection === 'danger' && (
          <DangerZone ctl={ctl} group={group} members={members} sectionHeading={sectionHeading} onTransferOwnership={onTransferOwnership} onDeleteGroup={onDeleteGroup} />
        )}
      </div>
    </div>
  );
}

// ─── Section visibility (FE rule 25 / §20 hide-don't-disable / §303) ──────────

function useMemoSectionVisibility(isAdmin: boolean, isOwner: boolean, myRole: GroupRole | null): SettingsSection[] {
  return React.useMemo(() => {
    const visible: SettingsSection[] = ['account', 'appearance'];
    if (myRole === null) return visible;
    if (myRole === 'GUEST') return visible; // §303 clean restricted set
    visible.push('members', 'notifications', 'security', 'diagnostics');
    if (isAdmin) visible.push('general', 'ai', 'skills', 'research', 'github', 'usage');
    if (isOwner) visible.push('danger');
    return visible;
  }, [isAdmin, isOwner, myRole]);
}

// ─── Members roster + dialogs (§230 removal, §229 transfer) ───────────────────

function MembersRoster({ ctl, members }: { ctl: SettingsController; members: GroupMember[] }) {
  const [removeTarget, setRemoveTarget] = useState<GroupMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const { toast } = useToast();
  const isAdminControlsVisible = ctl.isAdmin;

  return (
    <>
      <div
        className="divide-y rounded-xl overflow-hidden border"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
        data-testid="members-roster"
      >
        {members.map((m) => {
          // BE rules mirrored for affordance hiding: an Admin cannot manage
          // other Admins; nobody edits the Owner's role here (§7.2).
          const canEditRole =
            isAdminControlsVisible &&
            m.role !== 'OWNER' &&
            !(ctl.myRole === 'ADMIN' && m.role === 'ADMIN');
          const canRemove =
            isAdminControlsVisible &&
            m.role !== 'OWNER' &&
            !(ctl.myRole === 'ADMIN' && m.role === 'ADMIN');
          return (
            <div key={m.user_id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text)' }}
                  aria-hidden="true"
                >
                  {m.user.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    {m.user.name}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    {m.user.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.role === 'OWNER' ? 'spectral' : 'neutral'} size="sm">
                  {m.role}
                </Badge>
                {canEditRole && (
                  <select
                    value={m.role}
                    onChange={(e) => void ctl.changeRole(m.user_id, e.target.value as Exclude<GroupRole, 'OWNER'>)}
                    aria-label={`Role for ${m.user.name}`}
                    className="px-2 py-1 rounded-md border text-[11px] outline-none cursor-pointer"
                    style={{
                      borderColor: 'var(--color-border-strong)',
                      background: 'var(--color-surface-raised)',
                      color: 'var(--color-text)',
                    }}
                  >
                    {/* §7.2 — only the Owner creates Admins */}
                    {(ctl.isOwner ? (['ADMIN', 'MEMBER', 'GUEST'] as const) : (['MEMBER', 'GUEST'] as const)).map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                )}
                {canRemove && (
                  <Button size="sm" variant="ghost" onClick={() => setRemoveTarget(m)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* §230 exact consequence copy */}
      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title={`Remove ${removeTarget?.user.name ?? ''} from this Group?`}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              isLoading={isRemoving}
              onClick={() => {
                if (!removeTarget) return;
                setIsRemoving(true);
                void ctl.removeMemberById(removeTarget.user_id).then((ok) => {
                  setIsRemoving(false);
                  if (ok) toast({ title: `Removed ${removeTarget.user.name}`, variant: 'success' });
                  setRemoveTarget(null);
                });
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          They will lose access immediately. Shared contributions remain with the Group.
        </p>
      </Dialog>
    </>
  );
}

/** §72 invite screen — email invite + shareable link, token shown ONCE (§8.2). */
function InviteCard({ ctl, groupName }: { ctl: SettingsController; groupName: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<GroupRole, 'OWNER'>>('MEMBER');

  const inviteLink = ctl.pendingToken
    ? `${window.location.origin}/invite/${ctl.pendingToken.token}`
    : null;

  return (
    <div className={cn('p-4 rounded-xl border space-y-4')} style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}>
      <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
        Bring your team in
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
          aria-label="Invite email"
          className="!w-64"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Exclude<GroupRole, 'OWNER'>)}
          aria-label="Invite role"
          className="px-2.5 py-2 rounded-lg border outline-none cursor-pointer"
          style={{
            borderColor: 'var(--color-border-strong)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
          }}
        >
          <option value="ADMIN">Admin</option>
          <option value="MEMBER">Member</option>
          <option value="GUEST">Guest</option>
        </select>
        <Button
          size="sm"
          variant="primary"
          isLoading={ctl.isSendingInvite}
          disabled={email.trim().length === 0}
          onClick={() =>
            void ctl.sendInvite(email.trim() || null, role).then((ok) => {
              if (ok) {
                setEmail('');
              }
            })
          }
        >
          Send invites
        </Button>
      </div>
      {ctl.inviteError && (
        <p className="text-[11px]" role="alert" style={{ color: 'var(--color-danger)' }}>
          {ctl.inviteError}
        </p>
      )}
      {ctl.inviteSentAt !== null && !ctl.pendingToken && (
        <p className="text-[11px]" role="status" style={{ color: 'var(--color-success)' }}>
          Invite sent.
        </p>
      )}

      {/* §8.2 — raw token rendered ONCE, right after creation */}
      {ctl.pendingToken && inviteLink && (
        <div
          className="rounded-lg border p-3 space-y-2"
          style={{ borderColor: 'var(--color-info)', background: 'var(--color-surface)' }}
          data-testid="invite-token-panel"
        >
          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
            Invite link for {ctl.pendingToken.email ?? 'your teammate'}:
          </p>
          <code className="block text-[10px] break-all font-mono" style={{ color: 'var(--color-text-secondary)' }}>
            {inviteLink}
          </code>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(inviteLink).catch(() => undefined);
              }}
            >
              Copy invite link
            </Button>
            <Button size="sm" variant="ghost" onClick={ctl.clearPendingToken}>
              Done
            </Button>
          </div>
          <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
            This link is shown only once and expires in 7 days.
          </p>
        </div>
      )}

      {/* Pending invites list */}
      {ctl.invites.length > 0 && (
        <div className="divide-y rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }} data-testid="invites-list">
          {ctl.invites.map((inv) => {
            const revoked = !!inv.revoked_at;
            const expired = !!inv.expires_at && new Date(inv.expires_at).getTime() < Date.now();
            return (
              <div key={inv.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {inv.email || 'Link invite'}
                  </span>
                  <span className="ml-2 text-[10px] uppercase" style={{ color: 'var(--color-text-tertiary)' }}>
                    {String(inv.role ?? '')}
                  </span>
                  {!revoked && !expired && !!inv.expires_at && (
                    <span className="ml-2 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      expires {new Date(String(inv.expires_at)).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {revoked ? (
                  <Badge variant="neutral" size="sm">Revoked</Badge>
                ) : expired ? (
                  <Badge variant="neutral" size="sm">Expired</Badge>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => void ctl.revokeInviteById(inv.id)}>
                    Revoke
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
        Invites to {groupName} are visible to Owners and Admins only.
      </p>
    </div>
  );
}

// ─── BYOK card (§156/§157 states + §232 removal) ─────────────────────────────

function ByokCard({ ctl, groupId }: { ctl: SettingsController; groupId: string }) {
  const [byokProvider, setByokProvider] = useState<(typeof PROVIDERS)[number]>('anthropic');
  const [byokKey, setByokKey] = useState('');
  type ProviderTestState = 'idle' | 'testing' | 'connected' | 'failed';
  const [providerTestState, setProviderTestState] = useState<ProviderTestState>('idle');
  const [providerModels, setProviderModels] = useState<ModelDescriptor[]>([]);
  const [aiConfigs, setAiConfigs] = useState<AiProviderConfig[]>([]);
  const [aiRoutes, setAiRoutes] = useState<AiModelRoute[]>([]);
  const [aiConfigError, setAiConfigError] = useState<string | null>(null);
  const [isSavingRoutes, setIsSavingRoutes] = useState(false);
  const [removalTarget, setRemovalTarget] = useState<AiProviderConfig | null>(null);
  const [isRemovingProvider, setIsRemovingProvider] = useState(false);
  const { toast } = useToast();

  const reloadConfigs = (id: string) => {
    fetchAiConfig(id)
      .then((cfg) => {
        setAiConfigs(cfg.configs);
        setAiRoutes(cfg.routes);
      })
      .catch((err: unknown) => {
        // §302 — permission failures render the human copy, never codes.
        setAiConfigError(
          err instanceof ApiError && err.code === 'GROUP_PERMISSION_DENIED'
            ? 'Only Owners and Admins can change Group AI settings.'
            : githubErrorMessageOf(err),
        );
      });
  };

  // Load the sanitized config + route slots (Owner/Admin only server-side).
  useEffect(() => {
    let disposed = false;
    fetchAiConfig(groupId)
      .then((cfg) => {
        if (!disposed) {
          setAiConfigs(cfg.configs);
          setAiRoutes(cfg.routes);
        }
      })
      .catch((err: unknown) => {
        if (disposed) return;
        // §302 — permission failures render the human copy, never codes.
        setAiConfigError(
          err instanceof ApiError && err.code === 'GROUP_PERMISSION_DENIED'
            ? 'Only Owners and Admins can change Group AI settings.'
            : githubErrorMessageOf(err),
        );
      });
    return () => {
      disposed = true;
    };
  }, [groupId]);

  /**
   * §157 validate-before-store against POST …/providers/validate. Success
   * means the key is ALREADY stored server-side; only the sanitized config
   * (with key_last4) and discovered models come back.
   */
  const handleTestProvider = async () => {
    setProviderTestState('testing');
    try {
      const result = await validateProviderKey(groupId, byokProvider, byokKey);
      setAiConfigs((prev) => [...prev.filter((c) => c.id !== result.config.id), result.config]);
      setProviderModels(result.models);
      setProviderTestState('connected');
      // §63.1/§325.11 — the raw key has served its purpose; drop it NOW.
      setByokKey('');
    } catch {
      // §157 failure copy — never leaks backend error internals.
      setProviderTestState('failed');
    }
  };

  /** Route-slot draft state: role → {config_id, model_id}. */
  const [routeDraft, setRouteDraft] = useState<Record<string, { configId: string; modelId: string }>>({});
  /** §156 models per provider config — fetched WITHOUT any key material. */
  const [routeModelsCache, setRouteModelsCache] = useState<Record<string, ModelDescriptor[]>>({});
  useEffect(() => {
    const configIds = new Set<string>();
    for (const slot of ROUTE_ROLES) {
      const draft = routeDraft[slot.role];
      if (draft?.configId) configIds.add(draft.configId);
    }
    for (const configId of configIds) {
      if (routeModelsCache[configId]) continue;
      fetchProviderModels(groupId, configId)
        .then((res) => setRouteModelsCache((prev) => ({ ...prev, [configId]: res.models })))
        .catch(() => undefined); // slot stays empty; never fabricate models
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeDraft, groupId]);
  useEffect(() => {
    setRouteDraft(() => {
      const next: Record<string, { configId: string; modelId: string }> = {};
      for (const slot of ROUTE_ROLES) {
        const existing = aiRoutes.find((r) => r.role === slot.role);
        next[slot.role] = existing
          ? { configId: existing.provider_config_id, modelId: existing.model_id }
          : { configId: '', modelId: '' };
      }
      return next;
    });
  }, [aiRoutes]);

  const routesDirty = ROUTE_ROLES.some((slot) => {
    const draft = routeDraft[slot.role];
    const existing = aiRoutes.find((r) => r.role === slot.role);
    if (!draft) return false;
    if (!!draft.configId !== !!existing) return true;
    return !!existing && (existing.provider_config_id !== draft.configId || existing.model_id !== draft.modelId);
  });

  const handleSaveRoutes = async () => {
    const routes: ModelRouteInput[] = ROUTE_ROLES.flatMap((slot) => {
      const draft = routeDraft[slot.role];
      return draft && draft.configId && draft.modelId
        ? [{ provider_config_id: draft.configId, role: slot.role, model_id: draft.modelId }]
        : [];
    });
    if (!routes.some((r) => r.role === 'PRIMARY')) return;
    setIsSavingRoutes(true);
    try {
      const updated = await saveModelRoutes(groupId, routes);
      setAiRoutes(updated.routes);
    } catch (err) {
      setAiConfigError(githubErrorMessageOf(err));
    } finally {
      setIsSavingRoutes(false);
    }
  };

  return (
    <div className={cn('p-4 rounded-xl border space-y-4')} style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}>
      <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--color-text)' }}>
        <Key className="w-4 h-4" aria-hidden="true" />
        <span>Bring Your Own Key (BYOK)</span>
      </div>
      {aiConfigError && (
        <p className="text-[11px]" role="alert" style={{ color: 'var(--color-danger)' }}>
          {aiConfigError}
        </p>
      )}
      {ctl.byokRemovalError && (
        <p className="text-[11px]" role="alert" style={{ color: 'var(--color-danger)' }}>
          {ctl.byokRemovalError}
        </p>
      )}
      <p style={{ color: 'var(--color-text-secondary)' }}>
        Keys are validated and stored server-side — they are never kept on this device or shown again.
      </p>

      {/* Saved provider configs — sanitized metadata only (§63.1) */}
      {aiConfigs.length > 0 && (
        <div
          className="divide-y rounded-lg border overflow-hidden"
          style={{ borderColor: 'var(--color-border)' }}
          data-testid="byok-saved-configs"
        >
          {aiConfigs.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2">
              <span className="font-medium capitalize" style={{ color: 'var(--color-text)' }}>
                {c.provider}
                <span className="ml-2 text-[10px] uppercase" style={{ color: 'var(--color-text-tertiary)' }}>
                  {c.kind}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {/* §156/§63.1 — last4 only, NEVER the key itself */}
                {c.key_last4 && (
                  <span className="font-mono text-[10px]" data-testid="byok-last4" style={{ color: 'var(--color-text-tertiary)' }}>
                    ••••{c.key_last4}
                  </span>
                )}
                <Badge variant={c.enabled ? 'success' : 'neutral'} size="sm">
                  {c.enabled ? 'Active' : 'Off'}
                </Badge>
                {/* §232 — removal explains consequences; key never shown */}
                <Button size="sm" variant="ghost" onClick={() => setRemovalTarget(c)}>
                  Remove
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <label className="space-y-1 block">
          <span className="block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            Provider
          </span>
          <select
            value={byokProvider}
            onChange={(e) => {
              setByokProvider(e.target.value as (typeof PROVIDERS)[number]);
              setProviderTestState('idle');
            }}
            className="px-3.5 py-2 rounded-lg border outline-none cursor-pointer capitalize"
            style={{
              borderColor: 'var(--color-border-strong)',
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text)',
            }}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <Input
          type="password"
          placeholder={`Paste your ${byokProvider} API key`}
          value={byokKey}
          autoComplete="off"
          onChange={(e) => {
            setByokKey(e.target.value);
            setProviderTestState('idle');
          }}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            isLoading={providerTestState === 'testing'}
            disabled={byokKey.length === 0 || providerTestState === 'testing'}
            onClick={() => void handleTestProvider()}
          >
            Test connection
          </Button>
          {/* §157 exact states */}
          {providerTestState === 'testing' && (
            <span className="flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Testing…
            </span>
          )}
          {providerTestState === 'connected' && (
            <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--color-success)' }}>
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              Connected · {providerModels.length} model{providerModels.length === 1 ? '' : 's'} found
            </span>
          )}
          {providerTestState === 'failed' && (
            <span className="font-medium" style={{ color: 'var(--color-danger)' }}>
              Couldn&rsquo;t authenticate. Check the provider key.
            </span>
          )}
        </div>
      </div>

      {/* §156 model slots — Primary + Fallback 1..3 */}
      <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
          Model routes
        </p>
        {ROUTE_ROLES.map((slot) => {
          const draft = routeDraft[slot.role];
          const selectClass =
            'px-2.5 py-1.5 rounded-lg border outline-none text-[11px] cursor-pointer';
          const selectStyle = {
            borderColor: 'var(--color-border-strong)',
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text)',
          } as const;
          return (
            <div key={slot.role} className="grid grid-cols-[90px_1fr_1fr] items-center gap-2">
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {slot.label}
              </span>
              <select
                value={draft?.configId ?? ''}
                aria-label={`${slot.label} provider`}
                onChange={(e) => {
                  const configId = e.target.value;
                  setRouteDraft((prev) => ({
                    ...prev,
                    [slot.role]: { configId, modelId: '' },
                  }));
                }}
                className={selectClass}
                style={selectStyle}
              >
                <option value="">—</option>
                {aiConfigs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.provider}
                  </option>
                ))}
              </select>
              <select
                value={draft?.modelId ?? ''}
                aria-label={`${slot.label} model`}
                onChange={(e) => {
                  const modelId = e.target.value;
                  setRouteDraft((prev) => ({
                    ...prev,
                    [slot.role]: { configId: prev[slot.role]?.configId ?? '', modelId },
                  }));
                }}
                className={selectClass}
                style={selectStyle}
              >
                <option value="">—</option>
                {(routeModelsCache[draft?.configId ?? ''] ?? []).map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.display_name}
                  </option>
                ))}
                {draft?.modelId && !(routeModelsCache[draft.configId] ?? []).some((m) => m.model_id === draft.modelId) && (
                  <option value={draft.modelId}>{draft.modelId}</option>
                )}
              </select>
            </div>
          );
        })}
        {routesDirty && (
          <p className="text-[11px]" style={{ color: 'var(--color-warning)' }}>
            Unsaved changes
          </p>
        )}
        <Button
          size="sm"
          variant="primary"
          disabled={!routesDirty}
          isLoading={isSavingRoutes}
          onClick={() => void handleSaveRoutes()}
        >
          Save model routes
        </Button>
      </div>

      {/* §232 exact consequence copy; the raw key is NEVER revealed */}
      <Dialog
        open={removalTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemovalTarget(null);
        }}
        title={`Remove ${removalTarget?.provider ?? ''} key?`}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setRemovalTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              isLoading={isRemovingProvider}
              onClick={() => {
                if (!removalTarget) return;
                setIsRemovingProvider(true);
                void ctl.removeProvider(removalTarget.id).then((ok) => {
                  setIsRemovingProvider(false);
                  if (ok) {
                    reloadConfigs(groupId);
                    toast({ title: 'Provider removed', variant: 'success' });
                  }
                  setRemovalTarget(null);
                });
              }}
            >
              Remove key
            </Button>
          </>
        }
      >
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Odin will no longer use this provider configuration.
        </p>
      </Dialog>
    </div>
  );
}

// ─── Research section (§158 probe through the controller) ─────────────────────

type SectionHeadingFn = (title: string, sub: string) => React.ReactNode;

function ResearchSection({
  ctl,
  featureFlags,
  sectionHeading,
  card,
  cardBorder,
}: {
  ctl: SettingsController;
  featureFlags: ServerFeatureFlags;
  sectionHeading: SectionHeadingFn;
  card: string;
  cardBorder: { borderColor: string };
}) {
  // §158 search-provider test states: Connecting → Searching → Results
  // received → Ready (failure renders an honest error, never fake success).
  type SearchTestState = 'idle' | 'connecting' | 'searching' | 'received' | 'ready' | 'failed';
  const [searchTestState, setSearchTestState] = useState<SearchTestState>('idle');
  const [searchResultsSampled, setSearchResultsSampled] = useState(0);

  const handleTestSearchProvider = async () => {
    setSearchTestState('connecting');
    try {
      // One real probe drives all four staged labels; timing is client-side.
      const stage = setTimeout(() => setSearchTestState('searching'), 350);
      const sampled = await ctl.testSearchProvider();
      clearTimeout(stage);
      setSearchResultsSampled(sampled);
      setSearchTestState('received');
      setTimeout(() => setSearchTestState('ready'), 350);
    } catch {
      setSearchTestState('failed');
    }
  };

  return (
    <div className="space-y-6">
      {sectionHeading('Research', 'Web search provider configuration.')}
      <div className={card} style={cardBorder}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
              Search Provider
            </h3>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              {featureFlags.deep_research === false
                ? 'Deep Research is disabled for this Group (§165A.2).'
                : 'Deep Research is enabled for this Group.'}
            </p>
          </div>
          <Badge variant={featureFlags.deep_research === false ? 'neutral' : 'success'} size="sm">
            {featureFlags.deep_research === false ? 'Deep mode off' : 'Deep mode on'}
          </Badge>
        </div>
        {/* §158 search-provider test — same staged pattern as §157.
            The real backend has no search-provider endpoint yet; a failed
            probe renders an honest failure state (never fake success). Demo
            transport answers for parity. */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            isLoading={searchTestState === 'connecting' || searchTestState === 'searching'}
            onClick={() => void handleTestSearchProvider()}
          >
            Test search provider
          </Button>
          {searchTestState === 'connecting' && <span style={{ color: 'var(--color-text-secondary)' }}>Connecting…</span>}
          {searchTestState === 'searching' && <span style={{ color: 'var(--color-text-secondary)' }}>Searching…</span>}
          {searchTestState === 'received' && (
            <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--color-info)' }}>
              <Check className="w-3.5 h-3.5" aria-hidden="true" /> Results received
            </span>
          )}
          {searchTestState === 'ready' && (
            <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--color-success)' }}>
              <Check className="w-3.5 h-3.5" aria-hidden="true" /> Ready · {searchResultsSampled} results sampled
            </span>
          )}
          {searchTestState === 'failed' && (
            <span className="font-medium" style={{ color: 'var(--color-danger)' }}>
              Couldn&rsquo;t reach the search provider.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Notifications section (§171 matrix + §278 privacy toggle) ────────────────

function NotificationsSection({
  groupId,
  sectionHeading,
}: {
  groupId: string;
  sectionHeading: SectionHeadingFn;
}) {
  const [notifPrefs, setNotifPrefs] = useState<Record<NotificationCategory, ChannelPrefs>>(() =>
    loadNotificationPrefs(groupId),
  );

  useEffect(() => {
    saveNotificationPrefs(groupId, notifPrefs);
  }, [notifPrefs, groupId]);

  const [hidePreview, setHidePreview] = useState<boolean>(() => loadHidePreview());
  useEffect(() => {
    saveHidePreview(hidePreview);
  }, [hidePreview]);

  const updateChannel = (category: NotificationCategory, channel: keyof ChannelPrefs, value: boolean) => {
    setNotifPrefs((prev) => ({
      ...prev,
      [category]: { ...prev[category], [channel]: value },
    }));
    // §194 — the ONE clear moment to ask for OS notification permission:
    // the instant a user deliberately enables a Desktop channel. Never a
    // startup prompt; silently no-ops outside Tauri.
    if (channel === 'desktop' && value) {
      void requestNotificationPermission();
    }
  };

  return (
    <div className="space-y-6">
      {sectionHeading('Notification Preferences', 'Categories map 1:1 to backend identifiers.')}
      <div
        className="rounded-xl overflow-hidden border"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
      >
        {/* Header row */}
        <div
          className="grid grid-cols-[1fr_90px_90px_90px] px-4 py-2 border-b text-[10px] font-bold uppercase tracking-wider"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}
        >
          <span>Category</span>
          <span className="text-center">In-app</span>
          <span className="text-center">Desktop</span>
          <span className="text-center">Email</span>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {NOTIFICATION_CATEGORIES.map((item) => {
            const prefs = notifPrefs[item.id] ?? DEFAULT_CHANNELS;
            return (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_90px_90px_90px] items-center px-4 py-3"
              >
                <div>
                  <span className="font-semibold block" style={{ color: 'var(--color-text)' }}>
                    {item.label}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                    {item.id}
                  </span>
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={prefs.inApp}
                    onCheckedChange={(v) => updateChannel(item.id, 'inApp', v)}
                    aria-label={`${item.label} in-app`}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={prefs.desktop}
                    onCheckedChange={(v) => updateChannel(item.id, 'desktop', v)}
                    aria-label={`${item.label} desktop`}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={prefs.email}
                    onCheckedChange={(v) => updateChannel(item.id, 'email', v)}
                    aria-label={`${item.label} email`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
        Desktop delivery is derived client-side from in-app preference + OS permission — it is
        not a backend column (§171).
      </p>

      {/* §278 — desktop notification privacy */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl border"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
      >
        <div>
          <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>
            Hide message content in previews
          </h4>
          <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
            OS notifications show only the title, never message content (§278).
          </p>
        </div>
        <Switch
          checked={hidePreview}
          onCheckedChange={setHidePreview}
          aria-label="Hide message content in previews"
        />
      </div>
    </div>
  );
}

// ─── Danger zone (Owner-only; §229 transfer dialog, §228 deletion) ────────────

function DangerZone({
  ctl,
  group,
  members,
  sectionHeading,
  onTransferOwnership,
  onDeleteGroup,
}: {
  ctl: SettingsController;
  group: Group;
  members: GroupMember[];
  sectionHeading: SectionHeadingFn;
  onTransferOwnership: () => void;
  onDeleteGroup: () => void;
}) {
  const { toast } = useToast();
  const [transferOpen, setTransferOpen] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const meId = useAuthStore((s) => s.user?.id ?? '');
  // §7.2 — any active teammate except the current Owner is eligible.
  const candidates = members.filter(
    (m) => m.group_id === group.id && m.user_id !== meId && m.role !== 'OWNER' && m.role !== 'GUEST',
  );

  return (
    <div className="space-y-6">
      {sectionHeading('Danger Zone', 'Irreversible and high-impact actions.')}
      <div
        className="p-4 rounded-xl border space-y-4"
        style={{ borderColor: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold" style={{ color: 'var(--color-text)' }}>
              Transfer Ownership
            </h4>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Transfer Group ownership to another teammate. You will become Admin.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setNewOwnerId(candidates[0]?.user_id ?? '');
              setTransferOpen(true);
            }}
          >
            Transfer
          </Button>
        </div>

        <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-danger)' }}>
          <div>
            <h4 className="font-bold" style={{ color: 'var(--color-danger)' }}>
              Delete Group
            </h4>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              The Group enters a {GROUP_RECOVERY_DAYS}-day recovery window, then permanent deletion.
            </p>
          </div>
          <Button size="sm" variant="danger" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setDeleteOpen(true)}>
            Delete Group
          </Button>
        </div>

        {ctl.deleteError && (
          <p className="text-[11px]" role="alert" style={{ color: 'var(--color-danger)' }}>
            {ctl.deleteError}
          </p>
        )}
      </div>

      {/* §229 dialog — exact structure */}
      <Dialog
        open={transferOpen}
        onOpenChange={(open) => {
          if (!open) setTransferOpen(false);
        }}
        title="Transfer ownership"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!newOwnerId}
              onClick={() => {
                void ctl.transferTo(newOwnerId).then((ok) => {
                  setTransferOpen(false);
                  if (ok) {
                    toast({ title: 'Ownership transferred.', variant: 'success' });
                    onTransferOwnership();
                  }
                });
              }}
            >
              Transfer
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              New owner
            </span>
            <select
              value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.target.value)}
              aria-label="New owner"
              className="px-3 py-2 rounded-lg border outline-none w-full cursor-pointer"
              style={{
                borderColor: 'var(--color-border-strong)',
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text)',
              }}
            >
              {candidates.length === 0 && <option value="">No eligible teammate</option>}
              {candidates.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text)' }}>
            You will become Admin.
          </p>
        </div>
      </Dialog>

      {/* §228 deletion — recovery window explained, then permanent */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteOpen(false);
            setConfirmText('');
          }
        }}
        title={`Delete ${group.name}?`}
        footer={
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDeleteOpen(false);
                setConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              isLoading={ctl.isDeletingGroup}
              disabled={confirmText !== group.name}
              onClick={() => {
                void ctl.deleteThisGroup().then((ok) => {
                  setDeleteOpen(false);
                  setConfirmText('');
                  if (ok) {
                    toast({ title: 'Group moved to the recovery window.', variant: 'success' });
                    onDeleteGroup();
                  }
                });
              }}
            >
              Delete Group
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            The Group moves into a {GROUP_RECOVERY_DAYS}-day recovery window where an Owner can restore it.
            After that window it is deleted permanently — conversations, artifacts and project history
            cannot be recovered.
          </p>
          <div className="space-y-1">
            <span className="block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Type “{group.name}” to confirm
            </span>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Confirm group name" />
          </div>
        </div>
      </Dialog>
    </div>
  );
}

// ─── Shared small pieces ──────────────────────────────────────────────────────

function UsageCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-text-tertiary)' }}>
        {label}
      </div>
      <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function SecurityStatement({ text }: { text: string }) {
  return (
    <div
      className="flex items-start gap-2 px-4 py-3 rounded-xl border"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
    >
      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
      <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
        {text}
      </p>
    </div>
  );
}

/**
 * Compact §159 connection card for the Settings GitHub section — status
 * matrix (§165), repo metadata, §160 read-only rule, §231 disconnect dialog.
 * Action/PR management lives in the GitHub project panel, not Settings.
 */
function SettingsGithubCard({ groupId }: { groupId: string }) {
  const { status, connection, error, connect, disconnect } = useGithubConnection(groupId, null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const isConnected = status === 'READ_ONLY' || status === 'READ_WRITE';

  return (
    <div
      className="p-4 rounded-xl border space-y-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
            {connection?.repo_full_name ?? GITHUB_STATUS_LABEL[status]}
          </h3>
          {connection && (
            <>
              <p className="font-mono text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                {connection.repo_full_name} · {connection.default_branch ?? '—'}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                Last synced{' '}
                {connection.connected_at
                  ? new Date(connection.connected_at).toLocaleDateString()
                  : '—'}
              </p>
            </>
          )}
        </div>
        <Badge variant={status === 'READ_WRITE' ? 'success' : status === 'READ_ONLY' ? 'info' : 'neutral'} size="sm">
          {GITHUB_STATUS_LABEL[status]}
        </Badge>
      </div>

      {error && (
        <p className="text-[11px]" role="alert" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}

      {/* §160: a public URL never grants write access */}
      <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
        A public repository URL provides read access only. For write capability, connect GitHub.
      </p>

      <div className="flex items-center gap-2">
        {isConnected && (
          <Button size="sm" variant="outline" onClick={() => setDisconnectOpen(true)}>
            Disconnect
          </Button>
        )}
        {!isConnected && status !== 'CONNECTING' && <ConnectInlineForm onConnect={connect} />}
      </div>

      {/* §231 exact consequence copy */}
      <Dialog
        open={disconnectOpen}
        onOpenChange={(open) => {
          setDisconnectOpen(open);
        }}
        title="Disconnect GitHub?"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setDisconnectOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setDisconnectOpen(false);
                void disconnect();
              }}
            >
              Disconnect
            </Button>
          </>
        }
      >
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          ClanMind will stop repository actions. Existing project history remains.
        </p>
      </Dialog>
    </div>
  );
}

/** Minimal Owner/Admin connect form (§160 write-capability grant). */
function ConnectInlineForm({
  onConnect,
}: {
  onConnect: (input: {
    installation_id: number;
    owner_login: string;
    repo_name: string;
    default_branch?: string | null;
    permission_mode?: 'READ_ONLY' | 'READ_WRITE';
  }) => Promise<boolean>;
}) {
  const [ownerLogin, setOwnerLogin] = useState('');
  const [repoName, setRepoName] = useState('');
  const [installationId, setInstallationId] = useState('');
  const [busy, setBusy] = useState(false);
  const valid =
    ownerLogin.trim().length > 0 &&
    repoName.trim().length > 0 &&
    Number.isInteger(Number(installationId)) &&
    Number(installationId) > 0;

  return (
    <div className="flex flex-wrap items-end gap-2" data-testid="settings-connect-form">
      <Input value={ownerLogin} onChange={(e) => setOwnerLogin(e.target.value)} placeholder="owner" className="!w-32" />
      <Input value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="repository" className="!w-40" />
      <input
        value={installationId}
        onChange={(e) => setInstallationId(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        placeholder="Installation ID"
        aria-label="GitHub App installation ID"
        className="px-3.5 py-2 rounded-lg border outline-none w-36 font-mono text-xs focus:shadow-[var(--focus-ring)]"
        style={{
          borderColor: 'var(--color-border-strong)',
          background: 'var(--color-surface-raised)',
          color: 'var(--color-text)',
        }}
      />
      <Button
        size="sm"
        variant="primary"
        disabled={!valid}
        isLoading={busy}
        onClick={() => {
          setBusy(true);
          void onConnect({
            installation_id: Number(installationId),
            owner_login: ownerLogin.trim(),
            repo_name: repoName.trim(),
            default_branch: 'main',
            permission_mode: 'READ_WRITE',
          }).then(() => setBusy(false));
        }}
      >
        Connect GitHub
      </Button>
    </div>
  );
}

