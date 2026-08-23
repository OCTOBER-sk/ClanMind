import { describe, expect, it } from "vitest";
import {
  ModelRouterService,
  ProviderConfigService,
  classifyProviderError,
  type AiModelRoute,
  type AiProviderConfig,
  type ModelRouteRepository,
  type ProviderConfigRepository,
  type SecretStore,
} from "../src/index";

const G = "g1";

function configRepo() {
  const rows: AiProviderConfig[] = [];
  const r: ProviderConfigRepository = {
    async insert(input) {
      const row: AiProviderConfig = {
        ...input,
        id: crypto.randomUUID(),
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      rows.push(row);
      return row;
    },
    async findById(id) {
      return rows.find((c) => c.id === id) ?? null;
    },
    async listByGroup(groupId) {
      return rows.filter((c) => c.group_id === groupId);
    },
    async setEnabled() {},
  };
  return { rows, r };
}

const secrets: SecretStore = {
  async putSecret(plaintext) {
    return { secret_ref: `enc_${plaintext.length}`, key_last4: plaintext.slice(-4) };
  },
  async getSecret() {
    return null;
  },
  async deleteSecret() {},
};

describe("§63/§64 BYOK", () => {
  it("validates the key before storing; only ciphertext + last4 persist", async () => {
    const { rows, r } = configRepo();
    const svc = new ProviderConfigService(r, secrets, async (provider, key) => ({
      valid: key.startsWith("sk-"),
      models: provider === "openai" ? ["gpt-4o", "gpt-4o-mini"] : [],
    }));
    const result = await svc.validateAndStore({
      group_id: G,
      provider: "openai",
      api_key: "sk-test-abcd1234",
      created_by: "u1",
    });
    expect(result.models).toEqual(["gpt-4o", "gpt-4o-mini"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.key_last4).toBe("1234");
    expect(rows[0]?.credential_ref).not.toContain("sk-test");
  });

  it("rejects an invalid key before any storage", async () => {
    const { rows, r } = configRepo();
    const svc = new ProviderConfigService(r, secrets, async () => ({ valid: false, models: [] }));
    await expect(
      svc.validateAndStore({ group_id: G, provider: "x", api_key: "sk-bad", created_by: "u1" }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(rows).toHaveLength(0);
  });

  it("sanitized configs never expose raw credential material (§63.1)", async () => {
    const { r } = configRepo();
    const svc = new ProviderConfigService(r, secrets, async () => ({ valid: true, models: [] }));
    const { config } = await svc.validateAndStore({
      group_id: G,
      provider: "openai",
      api_key: "sk-test-abcd1234",
      created_by: "u1",
    });
    const sanitized = svc.sanitize(config);
    expect(JSON.stringify(sanitized)).not.toContain("sk-test");
  });
});

function route(role: AiModelRoute["role"], id: string): AiModelRoute {
  return {
    id,
    group_id: G,
    provider_config_id: "pc1",
    role,
    model_id: "m",
    priority: 0,
    enabled: true,
    created_at: new Date().toISOString(),
  };
}

function routeRepo(rows: AiModelRoute[]): ModelRouteRepository {
  return {
    async insert(input) {
      return { ...input, id: crypto.randomUUID(), enabled: true, created_at: new Date().toISOString() };
    },
    async listByGroup(groupId) {
      return rows.filter((r) => r.group_id === groupId);
    },
    async delete() {},
  };
}

describe("§61 model router fallback rules", () => {
  const chain = [route("PRIMARY", "p"), route("FALLBACK_1", "f1"), route("FALLBACK_2", "f2")];
  const svc = new ModelRouterService(routeRepo(chain));

  it("resolves the chain PRIMARY-first", async () => {
    const resolved = await svc.resolveChain(G);
    expect(resolved.map((r) => r.role)).toEqual(["PRIMARY", "FALLBACK_1", "FALLBACK_2"]);
  });

  it("falls back on retryable errors (5xx/timeout/rate-limit)", async () => {
    expect(svc.nextAfterFailure(chain, chain[0]!, "5xx")?.id).toBe("f1");
    expect(svc.nextAfterFailure(chain, chain[0]!, "timeout")?.id).toBe("f1");
    expect(svc.nextAfterFailure(chain, chain[0]!, "rate_limited")?.id).toBe("f1");
  });

  it("never falls back on auth/permission/schema/safety errors (Correction 16)", () => {
    for (const code of ["invalid_api_key", "permission_denied", "invalid_request", "safety_refusal"]) {
      expect(svc.nextAfterFailure(chain, chain[0]!, code)).toBeNull();
    }
  });

  it("exhausts the chain cleanly", () => {
    expect(svc.nextAfterFailure(chain, chain[2]!, "5xx")).toBeNull();
  });

  it("classification table matches §121/§61 — fail closed on unknown/null codes", () => {
    expect(classifyProviderError(null)).toBe("NON_RETRYABLE");
    expect(classifyProviderError("provider_unavailable")).toBe("RETRYABLE");
    expect(classifyProviderError("whatever_else")).toBe("NON_RETRYABLE");
  });

  it("enforces one PRIMARY and at most three fallbacks (§32)", async () => {
    await expect(
      svc.validateRoutes({ group_id: G, routes: [{ provider_config_id: "pc", role: "PRIMARY", model_id: "m" }, { provider_config_id: "pc", role: "PRIMARY", model_id: "m2" }] }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      svc.validateRoutes({
        group_id: G,
        routes: [
          { provider_config_id: "pc", role: "PRIMARY", model_id: "m" },
          ...(["FALLBACK_1", "FALLBACK_2", "FALLBACK_3"] as const).map((role) => ({
            provider_config_id: "pc",
            role,
            model_id: "m",
          })),
        ],
      }),
    ).resolves.toBeUndefined();
  });
});
