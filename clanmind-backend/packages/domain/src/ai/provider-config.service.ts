import { AppError } from "@clanmind/shared";

/** §31 */
export interface AiProviderConfig {
  id: string;
  group_id: string;
  kind: "APPLICATION" | "BYOK";
  provider: string;
  credential_ref: string | null;
  key_last4: string | null;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** §32 */
export interface AiModelRoute {
  id: string;
  group_id: string;
  provider_config_id: string;
  role: "PRIMARY" | "FALLBACK_1" | "FALLBACK_2" | "FALLBACK_3";
  model_id: string;
  priority: number;
  enabled: boolean;
  created_at: string;
}

export interface ProviderConfigRepository {
  insert(input: {
    group_id: string;
    kind: "APPLICATION" | "BYOK";
    provider: string;
    credential_ref: string | null;
    key_last4: string | null;
    created_by: string;
  }): Promise<AiProviderConfig>;
  findById(id: string): Promise<AiProviderConfig | null>;
  listByGroup(groupId: string): Promise<AiProviderConfig[]>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
}

export interface ModelRouteRepository {
  insert(input: {
    group_id: string;
    provider_config_id: string;
    role: AiModelRoute["role"];
    model_id: string;
    priority: number;
  }): Promise<AiModelRoute>;
  listByGroup(groupId: string): Promise<AiModelRoute[]>;
  delete(id: string): Promise<void>;
}

/**
 * §63.2 envelope encryption for BYOK secrets: a dedicated key outside the
 * database encrypts the raw key; only ciphertext ever lands in the secret
 * store. Decrypt happens in isolated server execution only.
 */
export interface SecretStore {
  putSecret(plaintext: string): Promise<{ secret_ref: string; key_last4: string }>;
  getSecret(secretRef: string): Promise<string | null>;
  deleteSecret(secretRef: string): Promise<void>;
}

/**
 * §63/§64 BYOK configuration. The admin's key is validated BEFORE the
 * configuration becomes active; after storage, only `sk-…9F2A`-style
 * metadata ever leaves the backend (§63.1).
 */
export class ProviderConfigService {
  constructor(
    private readonly configs: ProviderConfigRepository,
    private readonly secrets: SecretStore,
    private readonly validateKey: (
      provider: string,
      key: string,
    ) => Promise<{ valid: boolean; models: string[] }>,
  ) {}

  /** §64 BYOK model discovery flow. */
  async validateAndStore(input: {
    group_id: string;
    provider: string;
    api_key: string;
    created_by: string;
  }): Promise<{ config: AiProviderConfig; models: string[] }> {
    if (!input.api_key || input.api_key.length < 8) {
      throw new AppError("VALIDATION_FAILED", "API key looks invalid.");
    }
    const check = await this.validateKey(input.provider, input.api_key);
    if (!check.valid) {
      throw new AppError("VALIDATION_FAILED", "Provider rejected this key.");
    }
    const { secret_ref, key_last4 } = await this.secrets.putSecret(input.api_key);
    const config = await this.configs.insert({
      group_id: input.group_id,
      kind: "BYOK",
      provider: input.provider,
      credential_ref: secret_ref,
      key_last4,
      created_by: input.created_by,
    });
    // The raw key exists exactly here and is never persisted or returned.
    return { config, models: check.models };
  }

  /** §63.1: responses expose only metadata, never the secret. */
  sanitize(config: AiProviderConfig): AiProviderConfig {
    return {
      ...config,
      credential_ref: config.credential_ref ? `secret:${config.credential_ref}` : null,
    };
  }
}

/**
 * §61/§32 Model Router. One PRIMARY, at most three fallback positions.
 * Fallback only for retryable failures — never for invalid credentials,
 * schema, permission, or safety errors (Correction 16).
 */
export type FallbackEligibility = "RETRYABLE" | "NON_RETRYABLE";

const NON_RETRYABLE_PROVIDER_ERRORS = [
  "invalid_api_key",
  "invalid_request",
  "permission_denied",
  "safety_refusal",
  "unsupported_tool",
];

export function classifyProviderError(errorCode: string | null): FallbackEligibility {
  if (errorCode && NON_RETRYABLE_PROVIDER_ERRORS.includes(errorCode)) {
    return "NON_RETRYABLE";
  }
  if (errorCode === "rate_limited" || errorCode === "timeout") return "RETRYABLE";
  if (errorCode === "provider_unavailable" || errorCode === "5xx") {
    return "RETRYABLE";
  }
  // Fail closed: unknown or missing error codes never authorize a fallback
  // (Correction 16 — an unlabeled failure is not proven transient).
  return "NON_RETRYABLE";
}

export class ModelRouterService {
  constructor(private readonly routes: ModelRouteRepository) {}

  async validateRoutes(input: {
    group_id: string;
    routes: { provider_config_id: string; role: AiModelRoute["role"]; model_id: string }[];
  }): Promise<void> {
    const roles = input.routes.map((r) => r.role);
    const primaries = roles.filter((r) => r === "PRIMARY");
    if (primaries.length !== 1) {
      throw new AppError("VALIDATION_FAILED", "Exactly one PRIMARY route is required.");
    }
    const fallbacks = roles.filter((r) => r.startsWith("FALLBACK_"));
    if (fallbacks.length > 3) {
      throw new AppError("VALIDATION_FAILED", "At most three fallback positions.");
    }
  }

  /** Ordered route list for a run: PRIMARY first, then FALLBACK_1..3. */
  async resolveChain(groupId: string): Promise<AiModelRoute[]> {
    const routes = (await this.routes.listByGroup(groupId)).filter((r) => r.enabled);
    const order: Record<AiModelRoute["role"], number> = {
      PRIMARY: 0,
      FALLBACK_1: 1,
      FALLBACK_2: 2,
      FALLBACK_3: 3,
    };
    return routes.sort((a, b) => order[a.role] - order[b.role]);
  }

  /**
   * Next route after a failure — null when fallback must not happen
   * (Correction 16: no silent fallback on auth/permission errors).
   */
  nextAfterFailure(
    chain: AiModelRoute[],
    failed: AiModelRoute,
    errorCode: string | null,
  ): AiModelRoute | null {
    if (classifyProviderError(errorCode) === "NON_RETRYABLE") return null;
    const index = chain.findIndex((r) => r.id === failed.id);
    return chain[index + 1] ?? null;
  }
}
