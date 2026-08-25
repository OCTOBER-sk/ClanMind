import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ListMessagesInput,
  Message,
  MessageRepository,
  SendMessageInput,
} from "@clanmind/domain";

/** Supabase implementation of the §184 message repository. */
export class SupabaseMessageRepository implements MessageRepository {
  constructor(private readonly db: SupabaseClient) {}

  async createWithMentions(
    input: SendMessageInput & {
      sender_user_id: string | null;
      sender_type?: "USER" | "AI" | "SYSTEM";
      sender_ai_id?: string | null;
    },
  ): Promise<Message> {
    // §122: message + mentions + attachment links + outbox committed by one
    // SQL function.
    const { data, error } = await this.db.rpc("create_message_with_mentions", {
      input: {
        group_id: input.group_id,
        project_id: input.project_id ?? null,
        sender_type: input.sender_type ?? "USER",
        sender_user_id: input.sender_user_id,
        sender_ai_id: input.sender_ai_id ?? null,
        visibility: input.visibility ?? "GROUP",
        private_conversation_id: input.private_conversation_id ?? null,
        body: input.body,
        body_format: "markdown",
        reply_to_id: input.reply_to_id ?? null,
        client_message_id: input.client_message_id,
        mention_user_ids: input.mention_user_ids ?? [],
        attachment_ids: input.attachment_ids ?? [],
      },
    });
    if (error) throw error;
    return data as Message;
  }

  async findById(id: string): Promise<Message | null> {
    const { data, error } = await this.db
      .from("messages")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as Message | null) ?? null;
  }

  async recordRevision(input: {
    message_id: string;
    previous_body: string;
    previous_body_format: string;
    edited_by_user_id: string;
  }): Promise<void> {
    const { error } = await this.db.from("message_revisions").insert(input);
    if (error) throw error;
  }

  async updateBody(id: string, body: string, editedAt: string): Promise<Message | null> {
    const { data, error } = await this.db
      .from("messages")
      .update({ body, edited_at: editedAt })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as Message | null) ?? null;
  }

  async softDelete(id: string, deletedAt: string): Promise<void> {
    const { error } = await this.db
      .from("messages")
      .update({ deleted_at: deletedAt })
      .eq("id", id);
    if (error) throw error;
  }

  async listGroupVisible(input: ListMessagesInput): Promise<Message[]> {
    // §11.2: enforce access in the query — visibility + membership, never a
    // client-supplied flag.
    let query = this.db
      .from("messages")
      .select("*")
      .eq("group_id", input.group_id)
      .eq("visibility", "GROUP")
      .order("server_sequence", { ascending: false })
      .limit(input.limit);
    if (input.project_id) query = query.eq("project_id", input.project_id);
    if (input.before) {
      try {
        const cursor = JSON.parse(
          Buffer.from(input.before, "base64url").toString("utf8"),
        ) as { s?: number };
        if (typeof cursor.s === "number") query = query.lt("server_sequence", cursor.s);
      } catch {
        throw new Error("Invalid cursor");
      }
    }
    const { data, error } = await query;
    if (error) throw error;
    return ((data as Message[]) ?? []).slice().reverse();
  }
}
