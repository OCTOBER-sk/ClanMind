/**
 * P7 — §156/§157/§158 BYOK settings surfaces.
 *
 * Product rule under test (§325.11 + §63.1): a saved provider key is NEVER
 * revealed — only `••••last4` metadata renders, the entry field is a password
 * input, and the raw key is dropped from client state the moment validation
 * finishes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsView } from '@/features/settings/SettingsView';
import type {
  AiConfigResponse,
  AiProviderConfig,
  Group,
  ModelDescriptor,
  ServerFeatureFlags,
} from '@/types';

vi.mock('@/api/endpoints/aiConfig', () => ({
  fetchAiConfig: vi.fn(),
  saveModelRoutes: vi.fn(),
  validateProviderKey: vi.fn(),
  fetchProviderModels: vi.fn(),
}));

import {
  fetchAiConfig,
  validateProviderKey,
} from '@/api/endpoints/aiConfig';

const mockedFetchAiConfig = vi.mocked(fetchAiConfig);
const mockedValidate = vi.mocked(validateProviderKey);

const RAW_KEY = 'sk-ant-api03-SUPERSECRETKEYMATERIAL9F2Axx';

function groupFixture(): Group {
  return {
    id: 'grp_robotics_1',
    name: 'Robotics Core Team',
    description: 'Autonomous drones.',
    status: 'ACTIVE',
    ai_name: 'Odin',
    ai_proactivity: 'balanced',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

const FLAGS: ServerFeatureFlags = {
  meeting_mode: true,
  proactive_ai: true,
  github_write: true,
  github_merge: true,
  custom_skills: false,
  deep_research: true,
  offline_sync_v2: false,
  interactive_artifacts: true,
};

function configFixture(): AiProviderConfig {
  return {
    id: 'apc_anthropic_1',
    group_id: 'grp_robotics_1',
    kind: 'BYOK',
    provider: 'anthropic',
    credential_ref: 'secret:enc_demo_anthropic_ref',
    key_last4: 'F2AX',
    enabled: true,
    created_at: new Date().toISOString(),
  };
}

function modelsFixture(): ModelDescriptor[] {
  return [
    { model_id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5', context_window: 200000 },
    { model_id: 'claude-haiku-4', display_name: 'Claude Haiku 4', context_window: 100000 },
  ];
}

function renderSettings() {
  const user = userEvent.setup();
  const onUpdateGroup = vi.fn();
  render(
    <SettingsView
      group={groupFixture()}
      members={[]}
      featureFlags={FLAGS}
      onUpdateGroup={onUpdateGroup}
      onUpdateFeatureFlags={vi.fn()}
      onTransferOwnership={vi.fn()}
      onDeleteGroup={vi.fn()}
    />,
  );
  return { user, onUpdateGroup };
}

async function openAiSection(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^ai$/i }));
  expect(await screen.findByText('Bring Your Own Key (BYOK)')).toBeInTheDocument();
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockedFetchAiConfig.mockResolvedValue({
    configs: [configFixture()],
    routes: [],
  } satisfies AiConfigResponse);
});

describe('BYOK saved configs — §156 "Never reveal saved key"', () => {
  it('renders last4 metadata only; full key material never reaches the DOM or storage', async () => {
    const { user } = renderSettings();
    await openAiSection(user);

    const configs = screen.getByTestId('byok-saved-configs');
    expect(configs.textContent).toContain('anthropic');
    expect(screen.getByTestId('byok-last4').textContent).toBe('••••F2AX');

    // The sanitized row is the ONLY thing rendered — no credential_ref, no key.
    expect(document.body.textContent).not.toContain('enc_demo_anthropic_ref');
    expect(document.body.textContent).not.toContain(RAW_KEY);
    // And nothing was ever persisted locally (§325.11).
    for (let i = 0; i < window.localStorage.length; i++) {
      const value = window.localStorage.getItem(window.localStorage.key(i)!);
      expect(value).not.toContain(RAW_KEY);
    }
  });

  it('the key entry field masks input and never echoes what was typed', async () => {
    const { user } = renderSettings();
    await openAiSection(user);

    const input = screen.getByPlaceholderText(/paste your anthropic api key/i) as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'password');
    await user.type(input, RAW_KEY);
    expect(input.value).toBe(RAW_KEY); // held transiently for submit only
    expect(input).toHaveAttribute('autocomplete', 'off');
  });
});

describe('§157 Provider Test states', () => {
  it('Testing… → Connected · N models found; raw key wiped after validation', async () => {
    mockedValidate.mockResolvedValue({
      config: configFixture(),
      models: modelsFixture(),
    });
    const { user } = renderSettings();
    await openAiSection(user);

    const input = screen.getByPlaceholderText(/paste your anthropic api key/i);
    await user.type(input, RAW_KEY);
    await user.click(screen.getByRole('button', { name: /test connection/i }));

    expect(mockedValidate).toHaveBeenCalledTimes(1);
    expect(mockedValidate).toHaveBeenCalledWith('grp_robotics_1', 'anthropic', RAW_KEY);

    // §157 success state with discovered model count.
    expect(await screen.findByText(/Connected · 2 models found/)).toBeInTheDocument();

    // §63.1/§325.11 — the key has served its purpose; gone from the field…
    expect((input as HTMLInputElement).value).toBe('');
    // …and the saved-configs list now shows the new sanitized row only by last4.
    expect(document.body.textContent).not.toContain(RAW_KEY);
  });

  it('failure shows the exact §157 copy without leaking backend internals', async () => {
    mockedValidate.mockRejectedValue(new Error('401 invalid_api_key sig_failed'));
    const { user } = renderSettings();
    await openAiSection(user);

    const input = screen.getByPlaceholderText(/paste your anthropic api key/i);
    await user.type(input, 'invalid-key-123');
    await user.click(screen.getByRole('button', { name: /test connection/i }));

    expect(
      await screen.findByText('Couldn’t authenticate. Check the provider key.'),
    ).toBeInTheDocument();
    // Backend internals never surface (§302 human copy).
    expect(screen.queryByText(/invalid_api_key/)).not.toBeInTheDocument();
    // Failed attempts keep the draft so the user can correct it.
    expect((input as HTMLInputElement).value).toBe('invalid-key-123');
  });
});
