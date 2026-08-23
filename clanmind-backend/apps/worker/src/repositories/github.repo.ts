import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * §77 GitHub connection state + §80 durable webhook event storage. One Group
 * = one connected repository today (unique group_id); the schema keeps the
 * rows extensible toward multiple connections later.
 */
export interface GithubConnectionRow {
  id: string;
  group_id: string;
  installation_id: number | null;
  owner_login: string | null;
  repo_name: string | null;
  repo_full_name: string | null;
  default_branch: string | null;
  permission_mode: "READ_ONLY" | "READ_WRITE";
  connected_at: string | null;
  disconnected_at: string | null;
}

export class SupabaseGithubConnectionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByGroup(groupId: string): Promise<GithubConnectionRow | null> {
    const { data, error } = await this.db
      .from("github_connections")
      .select("*")
      .eq("group_id", groupId)
      .maybeSingle();
    if (error) throw error;
    return (data as GithubConnectionRow) ?? null;
  }

  async findByInstallation(installationId: number): Promise<GithubConnectionRow | null> {
    const { data, error } = await this.db
      .from("github_connections")
      .select("*")
      .eq("installation_id", installationId)
      .is("disconnected_at", null)
      .maybeSingle();
    if (error) throw error;
    return (data as GithubConnectionRow) ?? null;
  }

  async connect(input: {
    group_id: string;
    installation_id: number;
    owner_login: string;
    repo_name: string;
    default_branch: string | null;
    permission_mode: "READ_ONLY" | "READ_WRITE";
  }): Promise<GithubConnectionRow> {
    const repoFullName =
      input.owner_login && input.repo_name ? `${input.owner_login}/${input.repo_name}` : null;
    const { data, error } = await this.db
      .from("github_connections")
      .upsert(
        {
          group_id: input.group_id,
          installation_id: input.installation_id,
          owner_login: input.owner_login,
          repo_name: input.repo_name,
          repo_full_name: repoFullName,
          default_branch: input.default_branch,
          permission_mode: input.permission_mode,
          connected_at: new Date().toISOString(),
          disconnected_at: null,
        },
        { onConflict: "group_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return data as GithubConnectionRow;
  }

  async disconnect(groupId: string): Promise<void> {
    // §142 disconnect: invalidate cached installation metadata, keep history.
    const { error } = await this.db
      .from("github_connections")
      .update({
        installation_id: null,
        disconnected_at: new Date().toISOString(),
      })
      .eq("group_id", groupId);
    if (error) throw error;
  }
}

/**
 * §80 step 5: every webhook delivery is persisted; the unique delivery_id is
 * the durable dedupe anchor — an insert conflict means "already processed".
 * Unlike the in-process fallback set, this survives restarts and isolates.
 */
export class SupabaseWebhookEventStore {
  constructor(private readonly db: SupabaseClient) {}

  /** Returns true when the delivery was already recorded (duplicate). */
  async beginDelivery(input: {
    delivery_id: string;
    event_type: string;
    installation_id: number | null;
    payload: Record<string, unknown>;
  }): Promise<boolean> {
    const { data, error } = await this.db
      .from("github_webhook_events")
      .upsert(
        {
          delivery_id: input.delivery_id,
          event_type: input.event_type,
          installation_id: input.installation_id,
          payload: input.payload,
        },
        { onConflict: "delivery_id", ignoreDuplicates: true },
      )
      .select("delivery_id");
    if (error) throw error;
    // Empty result ⇒ conflict ignored ⇒ duplicate delivery.
    return (data ?? []).length === 0;
  }

  /** §80 step 4: map event to its Group once the installation resolves. */
  async attachGroup(deliveryId: string, groupId: string): Promise<void> {
    const { error } = await this.db
      .from("github_webhook_events")
      .update({ group_id: groupId })
      .eq("delivery_id", deliveryId);
    if (error) throw error;
  }
}

/** §78 — GitHub-specific fields; approval state joins through ai_action_id. */
export interface GithubActionRow {
  id: string;
  ai_action_id: string;
  group_id: string;
  project_id: string | null;
  action_type: "create_branch" | "apply_patch" | "create_pr" | "merge_pr";
  branch_name: string | null;
  base_sha?: string | null;
  target_sha: string | null;
  pr_number: number | null;
  preview_json: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

export class SupabaseGithubActionsRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: {
    ai_action_id: string;
    group_id: string;
    project_id: string | null;
    action_type: GithubActionRow["action_type"];
    branch_name: string | null;
    target_sha: string | null;
    preview_json: Record<string, unknown> | null;
  }): Promise<GithubActionRow> {
    const { data, error } = await this.db
      .from("github_actions")
      .insert({
        ai_action_id: input.ai_action_id,
        group_id: input.group_id,
        project_id: input.project_id,
        action_type: input.action_type,
        branch_name: input.branch_name,
        target_sha: input.target_sha,
        preview_json: input.preview_json,
      })
      .select()
      .single();
    if (error) throw error;
    return data as GithubActionRow;
  }

  async findById(id: string): Promise<GithubActionRow | null> {
    const { data, error } = await this.db
      .from("github_actions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as GithubActionRow) ?? null;
  }

  /** §78A.2: status/risk/payload always come from the joined ai_actions row. */
  async listByProjectWithStatus(
    projectId: string,
  ): Promise<(GithubActionRow & { status: string; risk_level: string })[]> {
    const { data, error } = await this.db
      .from("github_actions")
      .select("*, ai_actions!inner(status, risk_level)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data as unknown[]) ?? []).map((row) => {
      const r = row as GithubActionRow & { ai_actions: { status: string; risk_level: string } };
      const { ai_actions, ...rest } = r;
      return { ...rest, status: ai_actions.status, risk_level: ai_actions.risk_level };
    });
  }
}
