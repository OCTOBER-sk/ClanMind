import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiRunStatus } from "@clanmind/contracts";
import type {
  AiAction,
  AiActionApproval,
  ActionRepository,
  AiModelRoute,
  ModelRouteRepository,
  AiProviderConfig,
  ProviderConfigRepository,
  AiRun,
  AiRunRepository,
  ProactiveSuggestion,
  ProactiveRepository,
  SecretStore,
  ToolCallLedger,
  UsageEvent,
  UsageRepository,
} from "@clanmind/domain";

/**
 * Supabase implementations of the AI runtime ports: §52 ai_runs, §57A
 * ai_tool_calls, §78A ai_actions/approvals, §31/§32 provider configs and
 * model routes, §63.2 secret store, §93 usage ledger, §71 proactivity.
 */

export class SupabaseAiRunRepository implements AiRunRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: {
    group_id: string;
    project_id: string | null;
    requester_user_id: string;
    ai_agent_id: string;
    mode: AiRun["mode"];
    visibility: AiRun["visibility"];
    model_id: string;
    input_message_id: string | null;
  }): Promise<AiRun> {
    // The run is created against the group's enabled PRIMARY route config.
    const { data: route, error: routeError } = await this.db
      .from("ai_model_routes")
      .select("provider_config_id, id")
      .eq("group_id", input.group_id)
      .eq("role", "PRIMARY")
      .eq("enabled", true)
      .maybeSingle();
    if (routeError) throw routeError;

    const { data, error } = await this.db
      .from("ai_runs")
      .insert({
        group_id: input.group_id,
        project_id: input.project_id,
        requester_user_id: input.requester_user_id,
        ai_agent_id: input.ai_agent_id,
        mode: input.mode,
        visibility: input.visibility,
        provider_config_id: route?.provider_config_id ?? null,
        model_id: input.model_id,
        status: "QUEUED",
        input_message_id: input.input_message_id,
      })
      .select()
      .single();
    if (error) throw error;
    return data as AiRun;
  }

  async findById(id: string): Promise<AiRun | null> {
    const { data, error } = await this.db.from("ai_runs").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as AiRun) ?? null;
  }

  async setStatus(
    id: string,
    status: AiRunStatus,
    extra?: { failure_code?: string | null; usage_json?: Record<string, unknown> | null },
  ): Promise<void> {
    const patch: Record<string, unknown> = { status };
    if (extra?.failure_code !== undefined) patch.failure_code = extra.failure_code;
    if (extra?.usage_json !== undefined) patch.usage_json = extra.usage_json;
    if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
      patch.completed_at = new Date().toISOString();
    }
    const { error } = await this.db.from("ai_runs").update(patch).eq("id", id);
    if (error) throw error;
  }

  async listByGroup(groupId: string, limit: number): Promise<AiRun[]> {
    const { data, error } = await this.db
      .from("ai_runs")
      .select("*")
      .eq("group_id", groupId)
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as AiRun[]) ?? [];
  }
}

/** §57A tool-call ledger — every capability invocation lands here. */
export class SupabaseToolCallLedger implements ToolCallLedger {
  constructor(private readonly db: SupabaseClient) {}

  async record(input: {
    ai_run_id: string;
    tool_name: string;
    tool_version: string;
    risk_level: string;
    input_json: Record<string, unknown>;
    requires_approval: boolean;
  }): Promise<string> {
    const { data, error } = await this.db
      .from("ai_tool_calls")
      .insert({
        ai_run_id: input.ai_run_id,
        tool_name: input.tool_name,
        tool_version: input.tool_version,
        risk_level: input.risk_level,
        input_json: input.input_json,
        requires_approval: input.requires_approval,
        status: "PENDING",
      })
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: string }).id;
  }

  async complete(
    id: string,
    status: "SUCCEEDED" | "FAILED" | "DENIED",
    output: Record<string, unknown> | null,
    errorCode?: string,
  ): Promise<void> {
    const { error } = await this.db
      .from("ai_tool_calls")
      .update({
        status,
        output_json: output,
        error_code: errorCode ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }
}

/** §78A action + approval repository over ai_actions / ai_action_approvals. */
export class SupabaseActionRepository implements ActionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(
    input: Omit<AiAction, "id" | "created_at" | "updated_at" | "status"> & {
      status?: AiAction["status"];
    },
  ): Promise<AiAction> {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from("ai_actions")
      .insert({
        group_id: input.group_id,
        project_id: input.project_id,
        ai_run_id: input.ai_run_id,
        initiated_by_user_id: input.initiated_by_user_id,
        action_kind: input.action_kind,
        risk_level: input.risk_level,
        payload: input.payload,
        payload_hash: input.payload_hash,
        payload_version: input.payload_version,
        status: input.status ?? "PROPOSED",
        requires_approval: input.requires_approval,
        expires_at: input.expires_at ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    void now;
    return data as AiAction;
  }

  async findById(id: string): Promise<AiAction | null> {
    const { data, error } = await this.db
      .from("ai_actions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as Record<string, unknown>;
    // Map the DB row onto the domain shape (risk_level column ↔ risk field).
    return {
      ...(row as unknown as AiAction),
      risk_level: row.risk_level as AiAction["risk_level"],
    };
  }

  async setStatus(id: string, status: AiAction["status"]): Promise<void> {
    const { error } = await this.db
      .from("ai_actions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  async findApproval(actionId: string): Promise<AiActionApproval | null> {
    const { data, error } = await this.db
      .from("ai_action_approvals")
      .select("*")
      .eq("action_id", actionId)
      .order("approved_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as AiActionApproval) ?? null;
  }

  async insertApproval(
    input: Omit<AiActionApproval, "id" | "approved_at">,
  ): Promise<AiActionApproval> {
    const { data, error } = await this.db
      .from("ai_action_approvals")
      .insert({
        action_id: input.action_id,
        approved_by: input.approved_by,
        approver_role: input.approver_role,
        approved_payload_hash: input.approved_payload_hash,
        approved_payload_version: input.approved_payload_version,
        execution_result: input.execution_result ?? null,
        executed_at: input.executed_at ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as AiActionApproval;
  }

  async completeApproval(actionId: string, result: Record<string, unknown>): Promise<void> {
    const { error } = await this.db
      .from("ai_action_approvals")
      .update({ execution_result: result, executed_at: new Date().toISOString() })
      .eq("action_id", actionId);
    if (error) throw error;
  }

  async expireStale(nowIso: string): Promise<number> {
    const { data, error } = await this.db
      .from("ai_actions")
      .update({ status: "EXPIRED", updated_at: nowIso })
      .in("status", ["WAITING_APPROVAL", "APPROVED"])
      .not("expires_at", "is", null)
      .lte("expires_at", nowIso)
      .select("id");
    if (error) throw error;
    return (data as unknown[]).length;
  }
}

export class SupabaseProviderConfigRepository implements ProviderConfigRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: {
    group_id: string;
    kind: AiProviderConfig["kind"];
    provider: string;
    credential_ref: string | null;
    key_last4: string | null;
    created_by: string;
  }): Promise<AiProviderConfig> {
    const { data, error } = await this.db
      .from("ai_provider_configs")
      .insert({
        group_id: input.group_id,
        kind: input.kind,
        provider: input.provider,
        credential_ref: input.credential_ref,
        key_last4: input.key_last4,
        enabled: true,
        created_by: input.created_by,
      })
      .select()
      .single();
    if (error) throw error;
    return data as AiProviderConfig;
  }

  async findById(id: string): Promise<AiProviderConfig | null> {
    const { data, error } = await this.db
      .from("ai_provider_configs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as AiProviderConfig) ?? null;
  }

  async listByGroup(groupId: string): Promise<AiProviderConfig[]> {
    const { data, error } = await this.db
      .from("ai_provider_configs")
      .select("*")
      .eq("group_id", groupId);
    if (error) throw error;
    return (data as AiProviderConfig[]) ?? [];
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const { error } = await this.db
      .from("ai_provider_configs")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }
}

export class SupabaseModelRouteRepository implements ModelRouteRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: {
    group_id: string;
    provider_config_id: string;
    role: AiModelRoute["role"];
    model_id: string;
    priority: number;
  }): Promise<AiModelRoute> {
    // One route per role per group (§32): upsert keeps the constraint honest.
    const { data, error } = await this.db
      .from("ai_model_routes")
      .upsert(
        { ...input, enabled: true },
        { onConflict: "group_id,role" },
      )
      .select()
      .single();
    if (error) throw error;
    return data as AiModelRoute;
  }

  async listByGroup(groupId: string): Promise<AiModelRoute[]> {
    const { data, error } = await this.db
      .from("ai_model_routes")
      .select("*")
      .eq("group_id", groupId);
    if (error) throw error;
    return (data as AiModelRoute[]) ?? [];
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("ai_model_routes").delete().eq("id", id);
    if (error) throw error;
  }
}

/**
 * §63.2 envelope-encrypted secret store. The raw BYOK key is encrypted with
 * AES-GCM under a key derived (SHA-256) from a Worker secret that lives
 * OUTSIDE the database; only ciphertext is persisted as credential_ref.
 */
export class EnvelopeSecretStore implements SecretStore {
  constructor(private readonly masterSecret: string) {}

  private async key(): Promise<CryptoKey> {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(this.masterSecret),
    );
    return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  async putSecret(plaintext: string): Promise<{ secret_ref: string; key_last4: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await this.key();
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      new TextEncoder().encode(plaintext),
    );
    const bytes = new Uint8Array(ciphertext);
    let ivB64 = "";
    for (const b of iv) ivB64 += String.fromCharCode(b);
    let ctB64 = "";
    for (const b of bytes) ctB64 += String.fromCharCode(b);
    // btoa unavailable in some Workers runtimes; manual base64 via Buffer.
    const packed = `${Buffer.from(iv).toString("base64")}:${Buffer.from(bytes).toString("base64")}`;
    void ivB64;
    void ctB64;
    return { secret_ref: `enc1:${packed}`, key_last4: plaintext.slice(-4) };
  }

  async getSecret(secretRef: string): Promise<string | null> {
    if (!secretRef.startsWith("enc1:")) return null;
    try {
      const [ivB64, ctB64] = secretRef.slice(5).split(":");
      if (!ivB64 || !ctB64) return null;
      const iv = Uint8Array.from(Buffer.from(ivB64, "base64"));
      const ct = Buffer.from(ctB64, "base64");
      const cryptoKey = await this.key();
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        ct,
      );
      return new TextDecoder().decode(plaintext);
    } catch {
      return null;
    }
  }

  async deleteSecret(_secretRef: string): Promise<void> {
    // Ciphertext lives inside ai_provider_configs; row deletion by the caller
    // removes it. Nothing else to clean.
  }
}

export class SupabaseUsageRepository implements UsageRepository {
  constructor(private readonly db: SupabaseClient) {}

  async record(event: UsageEvent): Promise<void> {
    const { error } = await this.db.from("usage_events").insert({
      group_id: event.group_id,
      user_id: event.user_id ?? null,
      category: event.category,
      provider: event.provider ?? null,
      model: event.model ?? null,
      quantity: event.quantity,
      unit: event.unit,
      estimated_cost: event.estimated_cost ?? null,
    });
    if (error) throw error;
  }

  async sumGroupUsage(groupId: string, category: string, since: string): Promise<number> {
    const { data, error } = await this.db
      .from("usage_events")
      .select("quantity")
      .eq("group_id", groupId)
      .eq("category", category)
      .gte("created_at", since);
    if (error) throw error;
    return (data as { quantity: number }[]).reduce((sum, row) => sum + Number(row.quantity), 0);
  }

  async quotaLimit(groupId: string, category: string, defaultLimit: number): Promise<number> {
    // §178: per-Group overrides live in quota_states.limit_override (the
    // column the migration actually defines — 20260822000117_ai_runs_tools_usage.sql).
    const { data, error } = await this.db
      .from("quota_states")
      .select("limit_override")
      .eq("group_id", groupId)
      .eq("category", category)
      .maybeSingle();
    if (error) throw error;
    const override = data as { limit_override?: number } | null;
    return typeof override?.limit_override === "number" ? override.limit_override : defaultLimit;
  }
}

export class SupabaseProactiveRepository implements ProactiveRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: {
    group_id: string;
    project_id: string | null;
    reason_code: string;
    summary: string;
    confidence: number;
    created_at?: string;
  }): Promise<ProactiveSuggestion> {
    const { data, error } = await this.db
      .from("ai_proactive_suggestions")
      .insert({
        group_id: input.group_id,
        project_id: input.project_id,
        reason_code: input.reason_code,
        summary: input.summary,
        confidence: input.confidence,
        status: "PENDING",
      })
      .select()
      .single();
    if (error) throw error;
    return data as ProactiveSuggestion;
  }

  async countRecent(groupId: string, sinceIso: string): Promise<number> {
    const { count, error } = await this.db
      .from("ai_proactive_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)
      .gte("created_at", sinceIso);
    if (error) throw error;
    return count ?? 0;
  }

  async latestCreatedAt(groupId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from("ai_proactive_suggestions")
      .select("created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as { created_at: string } | null)?.created_at ?? null;
  }
}
