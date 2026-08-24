/**
 * AI provider configuration endpoints (BE §107 ai-config routes) — the ONLY
 * REST sites for BYOK management (FE §9 layer boundary):
 *
 *   GET   /groups/:groupId/ai/config                    → {configs, routes}
 *   PATCH /groups/:groupId/ai/config                    → {ok, routes}  (§32 slots)
 *   POST  /groups/:groupId/ai/providers/validate        → {config, models} (§64)
 *   POST  /groups/:groupId/ai/providers/:id/models      → {provider, models}
 *
 * §63.1 — responses are SANITIZED server-side: credential material never
 * leaves the backend; `key_last4` is the only key-derived field. The raw key
 * exists exactly once, inside the validate request body, and is never stored
 * client-side (§325.11: no BYOK secrets in local storage).
 */

import { api } from '@/api/client';
import { AiAgentConfigSchema, AiConfigResponseSchema, ValidateProviderResponseSchema } from '@/api/schemas';
import type { AiAgentConfig, AiConfigResponse, AiRouteRole, ModelDescriptor } from '@/types';

export async function fetchAiConfig(groupId: string): Promise<AiConfigResponse> {
  const raw = await api.get(`/groups/${encodeURIComponent(groupId)}/ai/config`);
  const parsed = AiConfigResponseSchema.safeParse(raw);
  if (!parsed.success) return { configs: [], routes: [] };
  return parsed.data as AiConfigResponse;
}

export interface ModelRouteInput {
  provider_config_id: string;
  role: AiRouteRole;
  model_id: string;
}

/** PATCH — exactly one PRIMARY + ≤3 fallback slots (BE §61/§32). */
export async function saveModelRoutes(
  groupId: string,
  routes: ModelRouteInput[],
): Promise<AiConfigResponse> {
  const raw = await api.patch(`/groups/${encodeURIComponent(groupId)}/ai/config`, { routes });
  // Response is { ok, routes }; re-read the full config for canonical state.
  void raw;
  return fetchAiConfig(groupId);
}

/**
 * §64 validate-before-store. Success ⇒ the key is already stored server-side
 * and only the sanitized config + discovered models come back.
 */
export async function validateProviderKey(
  groupId: string,
  provider: string,
  apiKey: string,
): Promise<{ config: AiConfigResponse['configs'][number]; models: ModelDescriptor[] }> {
  const raw = await api.post(`/groups/${encodeURIComponent(groupId)}/ai/providers/validate`, {
    provider,
    api_key: apiKey,
  });
  const parsed = ValidateProviderResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Provider validation response failed schema validation.');
  return {
    config: parsed.data.config as AiConfigResponse['configs'][number],
    models: (parsed.data.models ?? []) as unknown as ModelDescriptor[],
  };
}

/** POST models — re-discover models for an ALREADY STORED config (no key sent). */
export async function fetchProviderModels(
  groupId: string,
  configId: string,
): Promise<{ provider: string; models: ModelDescriptor[] }> {
  const raw = await api.post(
    `/groups/${encodeURIComponent(groupId)}/ai/providers/${encodeURIComponent(configId)}/models`,
    {},
  );
  if (
    raw &&
    typeof raw === 'object' &&
    typeof (raw as Record<string, unknown>).provider === 'string' &&
    Array.isArray((raw as Record<string, unknown>).models)
  ) {
    return raw as { provider: string; models: ModelDescriptor[] };
  }
  throw new Error('Provider models response failed schema validation.');
}

// ─── Group AI agent identity/personality (BE §30 row) ───────────────────────
//
// The real Worker stores this in `ai_agents` (§30) but ships NO read/write
// route yet. These two calls use the documented demo-parity route
// `GET|PATCH /groups/:id/ai/agent`; live mode surfaces an honest failure
// instead of pretending a save happened (INTEGRATION_NOTES D26).

export async function fetchAiAgent(groupId: string): Promise<AiAgentConfig | null> {
  const raw = await api.get(`/groups/${encodeURIComponent(groupId)}/ai/agent`, { retries: 0 });
  const parsed = AiAgentConfigSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data as unknown as AiAgentConfig;
}

export interface AiAgentUpdateInput {
  name?: string;
  tone?: string | null;
  personality_config?: AiAgentConfig['personality_config'];
  mode_policy?: AiAgentConfig['mode_policy'];
}

export async function updateAiAgent(
  groupId: string,
  input: AiAgentUpdateInput,
): Promise<AiAgentConfig> {
  const raw = await api.patch(`/groups/${encodeURIComponent(groupId)}/ai/agent`, input);
  const parsed = AiAgentConfigSchema.safeParse(raw);
  if (!parsed.success) throw new Error('AI agent response failed schema validation.');
  return parsed.data as unknown as AiAgentConfig;
}

/**
 * §232 BYOK key removal. No DELETE route exists on the real Worker yet —
 * demo-parity only; live mode surfaces the honest failure (D26).
 */
export async function removeProviderConfig(groupId: string, configId: string): Promise<void> {
  const raw = await api.delete(
    `/groups/${encodeURIComponent(groupId)}/ai/providers/${encodeURIComponent(configId)}`,
  );
  if (!(raw && typeof raw === 'object' && (raw as Record<string, unknown>).ok === true)) {
    throw new Error('Unexpected removal response.');
  }
}
