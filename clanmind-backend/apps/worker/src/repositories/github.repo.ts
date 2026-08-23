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
}
