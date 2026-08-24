import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsView, type SettingsViewProps } from '@/features/settings/SettingsView';
import { ToastProvider } from '@/design-system/components/Toast';
import { useAuthStore } from '@/state/useAuthStore';
import type { Group, GroupMember, GroupRole, ServerFeatureFlags } from '@/types';

// BYOK reads go through the ai-config endpoints; mock them so the test never
// depends on a live transport. The response is the SANITIZED shape §63.1 —
// metadata + key_last4 ONLY, never the credential.
const aiConfigModule = await import('@/api/endpoints/aiConfig');
vi.mock('@/api/endpoints/aiConfig', () => ({  fetchAiConfig: vi.fn(),
  fetchProviderModels: vi.fn().mockResolvedValue({ provider: 'anthropic', models: [] }),
  saveModelRoutes: vi.fn(),
  validateProviderKey: vi.fn(),
  // P12 controller surface — stubbed so the mocked namespace stays complete.
  fetchAiAgent: vi.fn().mockResolvedValue(null),
  updateAiAgent: vi.fn(),
  removeProviderConfig: vi.fn(),
}));

vi.mock('@/api/endpoints/me', () => ({
  fetchMyProfile: vi
    .fn()
    .mockResolvedValue({ id: 'u_1', display_name: 'Priya Sharma', email_snapshot: 'priya@x.io' }),
  updateMyProfile: vi.fn(),
}));
vi.mock('@/api/endpoints/members', () => ({
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  transferOwnership: vi.fn(),
  createInvite: vi.fn(),
  fetchInvites: vi.fn().mockResolvedValue([]),
  revokeInvite: vi.fn(),
}));
vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('offline in test')),
    post: vi.fn().mockRejectedValue(new Error('offline in test')),
    patch: vi.fn().mockRejectedValue(new Error('offline in test')),
    delete: vi.fn().mockRejectedValue(new Error('offline in test')),
  },
}));

const mockFetchAiConfig = aiConfigModule.fetchAiConfig as unknown as ReturnType<typeof vi.fn>;

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'grp_1',
    name: 'Robotics',
    status: 'ACTIVE',
    ai_name: 'Odin',
    ai_proactivity: 'balanced',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeMember(overrides: Partial<GroupMember> = {}): GroupMember {
  return {
    user_id: 'u_1',
    group_id: 'grp_1',
    role: 'OWNER' as GroupRole,
    user: { id: 'u_1', email: 'priya@x.io', name: 'Priya Sharma', created_at: new Date().toISOString() },
    joined_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeFlags(overrides: Partial<ServerFeatureFlags> = {}): ServerFeatureFlags {
  return {
    meeting_mode: true,
    proactive_ai: true,
    github_write: true,
    github_merge: true,
    custom_skills: true,
    deep_research: true,
    offline_sync_v2: true,
    interactive_artifacts: true,
    ...overrides,
  };
}

function renderSettings(props: Partial<SettingsViewProps> = {}) {
  const base: SettingsViewProps = {
    group: makeGroup(),
    members: [makeMember()],
    featureFlags: makeFlags(),
    onUpdateGroup: vi.fn(),
    onUpdateFeatureFlags: vi.fn(),
    onTransferOwnership: vi.fn(),
    onDeleteGroup: vi.fn(),
  };
  // Role gating needs the viewer on the roster — sign in the fixture Owner.
  useAuthStore.getState().setUser({
    id: 'u_1',
    email: 'priya@x.io',
    name: 'Priya Sharma',
    created_at: new Date().toISOString(),
  });
  return render(
    <ToastProvider>
      <SettingsView {...base} {...props} />
    </ToastProvider>,
  );
}

describe('BYOK — §156/§63.1/§325.11 key secrecy', () => {
  beforeEach(() => {
    mockFetchAiConfig.mockReset();
  });

  it('never reveals the saved key — only key_last4 renders (§63.1/§156)', async () => {
    const user = userEvent.setup();
    mockFetchAiConfig.mockResolvedValue({
      configs: [
        {
          id: 'cfg_1',
          group_id: 'grp_1',
          kind: 'BYOK',
          provider: 'anthropic',
          credential_ref: 'vault://cfg_1',
          key_last4: '9F2A',
          enabled: true,
          created_at: new Date().toISOString(),
        },
      ],
      routes: [],
    });

    renderSettings();
    await user.click(screen.getByRole('button', { name: /^ai$/i }));

    // The only key-derived field is the last-4 mask.
    const last4 = screen.getByTestId('byok-last4');
    expect(last4.textContent).toBe('••••9F2A');
    // The saved provider config row carries the provider name.
    const saved = screen.getByTestId('byok-saved-configs');
    expect(saved.textContent).toContain('anthropic');
    // No raw key material anywhere on the page.
    expect(screen.queryByText(/sk-ant-|api[_-]?key|vault:\/\//i)).not.toBeInTheDocument();
  });

  it('renders no last4 when the backend returns none (nothing to leak)', async () => {
    const user = userEvent.setup();
    mockFetchAiConfig.mockResolvedValue({
      configs: [{ id: 'cfg_1', group_id: 'grp_1', kind: 'APPLICATION', provider: 'openai', credential_ref: null, key_last4: null, enabled: true, created_at: new Date().toISOString() }],
      routes: [],
    });
    renderSettings();
    await user.click(screen.getByRole('button', { name: /^ai$/i }));
    expect(screen.queryByTestId('byok-last4')).not.toBeInTheDocument();
  });
});
