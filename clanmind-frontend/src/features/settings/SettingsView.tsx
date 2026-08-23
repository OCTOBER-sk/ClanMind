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
} from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Switch } from '@/design-system/components/Switch';
import { Badge } from '@/design-system/components/Badge';
import { Input } from '@/design-system/components/Input';
import { cn } from '@/design-system/utils';
import { SyncDiagnosticsView } from '@/features/sync/SyncDiagnosticsView';
import { useSyncStore } from '@/state/useSyncStore';
import type { Group, GroupMember, GroupRole, ServerFeatureFlags, NotificationCategory } from '@/types';

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
  | 'general'
  | 'members'
  | 'ai'
  | 'skills'
  | 'research'
  | 'github'
  | 'notifications'
  | 'diagnostics'
  | 'danger';

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

interface ChannelPrefs {
  inApp: boolean;
  desktop: boolean; // §171 — client-derived, not a backend column
  email: boolean;
}

const DEFAULT_CHANNELS: ChannelPrefs = { inApp: true, desktop: true, email: false };

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
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  // ─── General (controlled + §279 dirty state) ───
  const [groupName, setGroupName] = useState(group.name);
  const [groupDesc, setGroupDesc] = useState(group.description ?? '');
  const generalDirty = groupName !== group.name || groupDesc !== (group.description ?? '');

  // ─── AI & BYOK ───
  const [aiName, setAiName] = useState(group.ai_name || 'Odin');
  const [proactivity, setProactivity] = useState<Group['ai_proactivity']>(group.ai_proactivity || 'balanced');
  const aiDirty = aiName !== group.ai_name || proactivity !== group.ai_proactivity;
  const [byokKey, setByokKey] = useState('');
  const [providerTestState, setProviderTestState] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const testTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // §157 provider test — cleanup on unmount
  useEffect(() => {
    return () => {
      if (testTimerRef.current) clearTimeout(testTimerRef.current);
    };
  }, []);

  const handleTestProvider = () => {
    setProviderTestState('testing');
    if (testTimerRef.current) clearTimeout(testTimerRef.current);
    testTimerRef.current = setTimeout(() => {
      // §157 — mock connection result; real provider validation arrives with the API layer
      setProviderTestState(byokKey.length > 8 ? 'connected' : 'failed');
    }, 1200);
  };

  // ─── §171 notification preferences (client-local mirror of notification_preferences) ───
  const [notifPrefs, setNotifPrefs] = useState<Record<NotificationCategory, ChannelPrefs>>(() => {
    const stored = localStorage.getItem(`cm_notif_${group.id}`);
    if (stored) {
      try {
        return JSON.parse(stored) as Record<NotificationCategory, ChannelPrefs>;
      } catch {
        /* fall through to defaults */
      }
    }
    return Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.id, { ...DEFAULT_CHANNELS }])) as Record<
      NotificationCategory,
      ChannelPrefs
    >;
  });

  useEffect(() => {
    localStorage.setItem(`cm_notif_${group.id}`, JSON.stringify(notifPrefs));
  }, [notifPrefs, group.id]);

  const updateChannel = (category: NotificationCategory, channel: keyof ChannelPrefs, value: boolean) => {
    setNotifPrefs((prev) => ({
      ...prev,
      [category]: { ...prev[category], [channel]: value },
    }));
  };

  // ─── Diagnostics (§285) ───
  const sync = useSyncStore();
  const { status, checkpoint, pendingOperations, conflicts } = sync;

  const navItems: Array<{ id: SettingsSection; label: string; icon: React.ReactNode }> = [
    { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { id: 'members', label: 'Members', icon: <Users className="w-4 h-4" /> },
    { id: 'ai', label: 'AI', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'skills', label: 'Skills', icon: <Brain className="w-4 h-4" /> },
    { id: 'research', label: 'Research', icon: <Search className="w-4 h-4" /> },
    { id: 'github', label: 'GitHub', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'diagnostics', label: 'Sync Diagnostics', icon: <Activity className="w-4 h-4" /> },
    { id: 'danger', label: 'Danger Zone', icon: <ShieldAlert className="w-4 h-4" /> },
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
        {/* ── GENERAL (§280) ── */}
        {activeSection === 'general' && (
          <div className="space-y-6">
            {sectionHeading('General Information', 'Group profile and identity.')}
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Group Name
                </label>
                <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Description
                </label>
                <textarea
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
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
              {generalDirty && (
                <p className="text-[11px]" style={{ color: 'var(--color-warning)' }}>
                  Unsaved changes
                </p>
              )}
              <Button
                size="sm"
                variant="primary"
                disabled={!generalDirty}
                onClick={() => onUpdateGroup({ name: groupName, description: groupDesc || undefined })}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}

        {/* ── MEMBERS (§20, §170) ── */}
        {activeSection === 'members' && (
          <div className="space-y-6">
            {sectionHeading('Members & Roles', 'Manage teammates and permissions in this Group.')}
            <div
              className="divide-y rounded-xl overflow-hidden border"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
            >
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                      style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text)' }}
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
                    {m.role !== 'OWNER' && (
                      <select
                        value={m.role}
                        onChange={(e) => onUpdateMemberRole?.(m.user_id, e.target.value as GroupRole)}
                        aria-label={`Role for ${m.user.name}`}
                        className="px-2 py-1 rounded-md border text-[11px] outline-none cursor-pointer"
                        style={{
                          borderColor: 'var(--color-border-strong)',
                          background: 'var(--color-surface-raised)',
                          color: 'var(--color-text)',
                        }}
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Member</option>
                        <option value="GUEST">Guest</option>
                      </select>
                    )}
                    {m.role !== 'OWNER' && onRemoveMember && (
                      <Button size="sm" variant="ghost" onClick={() => onRemoveMember(m.user_id)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI (§129, §150, §156, §157, §167, §168, §169) ── */}
        {activeSection === 'ai' && (
          <div className="space-y-6">
            {sectionHeading('AI Teammate Configuration', "Configure your Group's shared AI identity and provider keys.")}
            <div className={card} style={cardBorder}>
              <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
                AI Identity (§129)
              </h3>
              <div className="space-y-1">
                <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  AI Name
                </label>
                <Input value={aiName} onChange={(e) => setAiName(e.target.value)} maxLength={20} />
              </div>
              {/* §165A.2 proactive_ai flag hides the proactivity setting entirely */}
              {featureFlags.proactive_ai !== false && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    Proactivity (§150)
                  </label>
                  <select
                    value={proactivity}
                    onChange={(e) => setProactivity(e.target.value as Group['ai_proactivity'])}
                    className="px-3.5 py-2 rounded-lg border outline-none w-64 cursor-pointer"
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
              {aiDirty && (
                <p className="text-[11px]" style={{ color: 'var(--color-warning)' }}>
                  Unsaved changes
                </p>
              )}
              {/* §280 section-level save */}
              <Button
                size="sm"
                variant="primary"
                disabled={!aiDirty}
                onClick={() => onUpdateGroup({ ai_name: aiName, ai_proactivity: proactivity })}
              >
                Save AI Settings
              </Button>
            </div>

            {/* BYOK (§156 — never reveal saved key, never store locally) */}
            <div className={card} style={cardBorder}>
              <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--color-text)' }}>
                <Key className="w-4 h-4" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
                <span>Bring Your Own Key (BYOK) Configuration</span>
              </div>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                Provide custom API keys for your provider. Keys are never stored on this device.
              </p>
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="Enter API Key (e.g. sk-ant-...)"
                  value={byokKey}
                  onChange={(e) => {
                    setByokKey(e.target.value);
                    setProviderTestState('idle');
                  }}
                />
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={providerTestState === 'testing'}
                    disabled={byokKey.length === 0}
                    onClick={handleTestProvider}
                  >
                    Test Connection
                  </Button>
                  {providerTestState === 'connected' && (
                    <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--color-success)' }}>
                      <Check className="w-3.5 h-3.5" aria-hidden="true" /> Connected · 3 models found
                    </span>
                  )}
                  {providerTestState === 'failed' && (
                    <span className="font-medium" style={{ color: 'var(--color-danger)' }}>
                      Couldn&rsquo;t authenticate. Check the provider key.
                    </span>
                  )}
                  {providerTestState === 'testing' && (
                    <span className="flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Testing…
                    </span>
                  )}
                </div>
              </div>
            </div>
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
              <Button size="sm" variant="outline">
                Test search provider
              </Button>
            </div>
          </div>
        )}

        {/* ── GITHUB (§159, §160, §165) ── */}
        {activeSection === 'github' && (
          <div className="space-y-6">
            {sectionHeading('GitHub Connection', 'Repository access for your Project.')}
            <div className={card} style={cardBorder}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
                    Connected
                  </h3>
                  <p className="font-mono text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                    robotics-core/flight-controller · main
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    Last synced just now
                  </p>
                </div>
                <Badge
                  variant={featureFlags.github_write === false ? 'neutral' : 'success'}
                  size="sm"
                >
                  {featureFlags.github_write === false ? 'Read only' : 'Read/write'}
                </Badge>
              </div>
              {/* §160: a public URL never grants write access */}
              <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                A public repository URL provides read access only. For write capability, connect GitHub.
              </p>
              <Button size="sm" variant="outline">
                Disconnect
              </Button>
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS (§171) — all 11 categories, 3 channels ── */}
        {activeSection === 'notifications' && (
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
          </div>
        )}

        {/* ── SYNC DIAGNOSTICS (§285) ── */}
        {activeSection === 'diagnostics' && (
          <SyncDiagnosticsView
            status={status}
            checkpoint={checkpoint}
            pendingOperations={pendingOperations}
            conflicts={conflicts}
            onResolveConflict={(id, strategy) =>
              useSyncStore.getState().resolveConflict(id, strategy, 'user_arun_1')
            }
          />
        )}

        {/* ── DANGER ZONE (§228, §229, §282) ── */}
        {activeSection === 'danger' && (
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
                    Transfer Group ownership to another Admin. You will become Admin.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={onTransferOwnership}>
                  Transfer
                </Button>
              </div>

              <div
                className="pt-3 border-t flex items-center justify-between"
                style={{ borderColor: 'var(--color-danger)' }}
              >
                <div>
                  <h4 className="font-bold" style={{ color: 'var(--color-danger)' }}>
                    Delete Group
                  </h4>
                  <p style={{ color: 'var(--color-text-secondary)' }}>
                    Schedule Group deletion with a 30-day recovery window, then permanent deletion.
                  </p>
                </div>
                <Button size="sm" variant="danger" onClick={onDeleteGroup}>
                  Delete Group
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}