import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityRepository,
  ActivityRow,
  Message,
  MessageSearchRepository,
  SearchMessagesInput,
  NotificationRepository,
  NotificationRow,
} from "@clanmind/domain";

/**
 * §13/§125 message search. Every query applies the ACL: GROUP visibility via
 * membership, private via conversation membership — the FTS index inherits
 * the source data's privacy boundary.
 */
export class SupabaseMessageSearchRepository implements MessageSearchRepository {
  constructor(private readonly db: SupabaseClient) {}

  async search(input: SearchMessagesInput): Promise<Message[]> {
    const terms = input.query
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((t) => `${t}:*`)
      .join(" & ");

    let query = this.db
      .from("messages")
      .select("*")
      .eq("group_id", input.group_id)
      .is("deleted_at", null)
      .textSearch("search_vector", terms)
      .order("created_at", { ascending: false })
      .limit(input.limit);

    if (input.project_id) query = query.eq("project_id", input.project_id);
    if (input.sender_user_id) query = query.eq("sender_user_id", input.sender_user_id);
    if (input.from) query = query.gte("created_at", input.from);
    if (input.to) query = query.lte("created_at", input.to);
    if (input.ai_messages_only) query = query.eq("sender_type", "AI");

    let conversationIds: string[] = [];
    if (input.include_private === true && input.requester_user_id) {
      // §11.2/§13/§55A: private search only within the requester's OWN
      // authorized private scope — never the whole Group's private traffic.
      const { data: memberRows, error: memberError } = await this.db
        .from("private_conversation_members")
        .select("conversation_id")
        .eq("user_id", input.requester_user_id);
      if (memberError) throw memberError;
      conversationIds = (memberRows ?? []).map(
        (r: { conversation_id: string }) => r.conversation_id,
      );
    }

    if (conversationIds.length > 0) {
      // GROUP messages plus exactly the private conversations the requester
      // participates in — enforced here in the backend query (§11.2).
      query = query.or(
        `visibility.eq.GROUP,private_conversation_id.in.(${conversationIds.join(",")})`,
      );
    } else {
      query = query.eq("visibility", "GROUP");
    }

    const { data, error } = await query;
    if (error) throw error;
    let rows = (data as Message[]) ?? [];

    if (input.mention_of) {
      const { data: mentionRows, error: mentionError } = await this.db
        .from("message_mentions")
        .select("message_id")
        .eq("mentioned_user_id", input.mention_of);
      if (mentionError) throw mentionError;
      const ids = new Set((mentionRows ?? []).map((m: { message_id: string }) => m.message_id));
      rows = rows.filter((m) => ids.has(m.id));
    }

    if (input.has_attachments) {
      const { data: linkRows, error: linkError } = await this.db
        .from("message_attachments")
        .select("message_id")
        .in("message_id", rows.map((m) => m.id));
      if (linkError) throw linkError;
      const ids = new Set((linkRows ?? []).map((l: { message_id: string }) => l.message_id));
      rows = rows.filter((m) => ids.has(m.id));
    }

    return rows;
  }
}

/** §95A notifications repository. */
export class SupabaseNotificationRepository implements NotificationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(
    input: Omit<NotificationRow, "id" | "created_at" | "read_at">,
  ): Promise<NotificationRow> {
    const { data, error } = await this.db
      .from("notifications")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as NotificationRow;
  }

  async listForUser(
    userId: string,
    limit: number,
    unreadOnly: boolean,
  ): Promise<NotificationRow[]> {
    let query = this.db
      .from("notifications")
      .select("*")
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (unreadOnly) query = query.is("read_at", null);
    const { data, error } = await query;
    if (error) throw error;
    return (data as NotificationRow[]) ?? [];
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const { error } = await this.db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("recipient_user_id", userId);
    if (error) throw error;
  }

  async preference(
    userId: string,
    groupId: string,
    category: NotificationRow["category"],
  ): Promise<{ in_app_enabled: boolean; email_enabled: boolean } | null> {
    const { data, error } = await this.db
      .from("notification_preferences")
      .select("in_app_enabled, email_enabled")
      .eq("user_id", userId)
      .eq("group_id", groupId)
      .eq("category", category)
      .maybeSingle();
    if (error) throw error;
    return (data as { in_app_enabled: boolean; email_enabled: boolean } | null) ?? null;
  }
}

/** §98A activity repository. */
export class SupabaseActivityRepository implements ActivityRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: Omit<ActivityRow, "id" | "occurred_at">): Promise<ActivityRow> {
    const { data, error } = await this.db.from("activity_events").insert(input).select().single();
    if (error) throw error;
    return data as ActivityRow;
  }

  async listByGroup(groupId: string, limit: number): Promise<ActivityRow[]> {
    const { data, error } = await this.db
      .from("activity_events")
      .select("*")
      .eq("group_id", groupId)
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as ActivityRow[]) ?? [];
  }

  async listByProject(projectId: string, limit: number): Promise<ActivityRow[]> {
    const { data, error } = await this.db
      .from("activity_events")
      .select("*")
      .eq("project_id", projectId)
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as ActivityRow[]) ?? [];
  }
}
