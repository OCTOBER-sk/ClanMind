import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupDeletionRepository } from "@clanmind/domain";

/**
 * §9 Stage 3 purge. Tables with a direct `group_id` column are listed here;
 * project-scoped tables are purged via their owning projects. This is the
 * single place that knows the full Group-owned data footprint — every table
 * §9 requires is covered: shared metadata, messages, artifacts, files,
 * AI configuration, memory, GitHub connection metadata.
 */
const GROUP_DIRECT_TABLES = [
  // Membership & invites
  "member_nicknames",
  "group_invites",
  "group_members",
  // AI configuration (§9)
  "ai_model_routes",
  "ai_provider_configs",
  "search_provider_configs",
  "group_skills",
  "ai_agents",
  // Memory (§9)
  "memory_candidates",
  "memories",
  // AI runtime records (children before parents)
  "ai_tool_calls",
  "ai_run_steps",
  "ai_runs",
  "ai_action_approvals",
  "ai_actions",
  "ai_proactive_suggestions",
  // GitHub metadata (§9)
  "github_webhook_events",
  "github_actions",
  "github_connections",
  // Collaboration state
  "notification_preferences",
  "notifications",
  "activity_events",
  "sync_conflicts",
  "sync_operations",
  "sync_checkpoints",
  "usage_events",
  "quota_states",
  "outbox_events",
  // Message graph: children cascade from messages; private conversations
  // MUST come after messages (messages.private_conversation_id is NO ACTION).
  "attachments",
  "message_pins",
  "messages",
  "private_conversations", // members cascade
  "meeting_sessions", // candidates + summaries cascade
] as const;

/**
 * Everything project-scoped cascades from `projects` (§105/§110/§114/§120:
 * project_instructions, project_skills, artifacts(+versions+links),
 * decisions, tasks(+dependencies), project_snapshots, memories(PROJECT)).
 * One delete statement covers the whole subtree via ON DELETE CASCADE.
 */
const PROJECT_SCOPED_TABLES = ["projects"] as const;

export class SupabaseGroupDeletionRepository implements GroupDeletionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async purgeGroupScoped(groupId: string): Promise<string[]> {
    const purged: string[] = [];

    if (PROJECT_SCOPED_TABLES.length > 0) {
      const { data: projectIds, error: projectError } = await this.db
        .from("projects")
        .select("id")
        .eq("group_id", groupId);
      if (projectError) throw projectError;
      const ids = (projectIds ?? []).map((row: { id: string }) => row.id);
      if (ids.length > 0) {
        for (const table of PROJECT_SCOPED_TABLES) {
          const { error } = await this.db
            .from(table)
            .delete()
            .in("project_id", ids);
          if (error) throw error;
          purged.push(table);
        }
      }
    }

    for (const table of GROUP_DIRECT_TABLES) {
      const { error } = await this.db.from(table).delete().eq("group_id", groupId);
      if (error) throw error;
      purged.push(table);
    }

    return purged;
  }
}
