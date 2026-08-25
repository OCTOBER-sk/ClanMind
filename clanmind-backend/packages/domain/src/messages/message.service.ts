import { AppError } from "@clanmind/shared";
import type { Page } from "@clanmind/shared";
import type { EventOutbox } from "../common/ports";

/** §39 message row. */
export interface Message {
  id: string;
  group_id: string;
  project_id: string | null;
  sender_type: "USER" | "AI" | "SYSTEM";
  sender_user_id: string | null;
  sender_ai_id: string | null;
  visibility: "GROUP" | "PRIVATE_PAIR" | "PRIVATE_AI";
  private_conversation_id: string | null;
  body: string;
  body_format: string;
  reply_to_id: string | null;
  client_message_id: string;
  server_sequence: number;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface SendMessageInput {
  group_id: string;
  project_id?: string | null;
  client_message_id: string;
  body: string;
  reply_to_id?: string | null;
  mention_user_ids?: string[];
  /** §2.4 private scope — set only by PrivateConversationService callers. */
  visibility?: "GROUP" | "PRIVATE_PAIR" | "PRIVATE_AI";
  private_conversation_id?: string | null;
  /**
   * §43/§122 — uploaded attachment row ids to link inside the message
   * transaction. The composer uploads bytes before the message exists, so
   * the link rides the create call; the §122 RPC inserts the
   * `message_attachments` rows atomically with the message itself.
   */
  attachment_ids?: string[];
}

export interface ListMessagesInput {
  group_id: string;
  project_id?: string;
  before?: string; // cursor
  limit: number;
}

/**
 * §184 repository contract over messages. `createWithMentions` runs inside
 * the atomic §122 SQL function (message + mentions + outbox together).
 */
export interface MessageRepository {
  createWithMentions(input: SendMessageInput & { sender_user_id: string }): Promise<Message>;
  findById(id: string): Promise<Message | null>;
  recordRevision(input: {
    message_id: string;
    previous_body: string;
    previous_body_format: string;
    edited_by_user_id: string;
  }): Promise<void>;
  updateBody(id: string, body: string, editedAt: string): Promise<Message | null>;
  softDelete(id: string, deletedAt: string): Promise<void>;
  listGroupVisible(input: ListMessagesInput): Promise<Message[]>;
}

/**
 * §11/§12 message domain. Cloud ordering wins (§21.1); edits keep pre-edit
 * history in message_revisions (§39A); deletion is a tombstone (§12.2).
 * Private visibility flows through PrivateConversationService (B6).
 */
export class MessageService {
  constructor(
    private readonly messages: MessageRepository,
    private readonly limits: { message_body_max_chars: number },
    /** Optional §123 outbox: edit/delete events fan out through the
     * broadcaster when wired (send already emits via the §122 RPC). */
    private readonly outbox?: EventOutbox,
    /** M1 (BACKEND_AUDIT2_REPORT §6) / §185 #11 / §86: re-verifies ACTIVE
     * Group membership at WRITE time. Connect-time or send-time checks go
     * stale the moment a member is removed — a removed member must not keep
     * edit/delete on their old messages. Wired by the worker (REST services
     * and the DO room share this one gate). */
    private readonly assertActiveMember?: (
      groupId: string,
      userId: string,
    ) => Promise<void>,
    /** M2 (BACKEND_AUDIT2 §6): a client-supplied project_id must belong to the
     * message's Group — never trusted as a foreign cross-group reference. */
    private readonly assertProjectInGroup?: (
      projectId: string,
      groupId: string,
    ) => Promise<void>,
  ) {}

  async send(
    input: SendMessageInput & { sender_user_id: string },
  ): Promise<Message> {
    const body = input.body ?? "";
    if (body.trim().length === 0) {
      throw new AppError("VALIDATION_FAILED", "Message body is required.");
    }
    if (body.length > this.limits.message_body_max_chars) {
      throw new AppError(
        "VALIDATION_FAILED",
        `Message body exceeds ${this.limits.message_body_max_chars} characters.`,
      );
    }
    if (!input.client_message_id || input.client_message_id.length > 128) {
      throw new AppError("VALIDATION_FAILED", "client_message_id is required.");
    }
    // M2/§185 #4: a foreign project reference must not be written. When the
    // callback is wired it re-derives project.group_id and rejects any value
    // that does not belong to this message's Group.
    if (input.project_id) {
      await this.assertProjectInGroup?.(input.project_id, input.group_id);
    }
    return this.messages.createWithMentions(input);
  }

  async edit(messageId: string, actorUserId: string, body: string): Promise<Message> {
    const message = await this.requireEditable(messageId, actorUserId);
    if (body.trim().length === 0 || body.length > this.limits.message_body_max_chars) {
      throw new AppError("VALIDATION_FAILED", "Invalid message body.");
    }
    // §39A: archive the pre-edit body, then update the live row.
    await this.messages.recordRevision({
      message_id: message.id,
      previous_body: message.body,
      previous_body_format: message.body_format,
      edited_by_user_id: actorUserId,
    });
    const updated = await this.messages.updateBody(message.id, body, new Date().toISOString());
    if (!updated) throw new AppError("NOT_FOUND", "Message not found.");
    // §114: the outbox broadcaster fans message.updated out to room clients.
    await this.outbox?.publish({
      event_type: "message.edited",
      aggregate_type: "message",
      aggregate_id: updated.id,
      group_id: updated.group_id,
      actor_id: actorUserId,
      payload: {
        message_id: updated.id,
        visibility: updated.visibility,
        private_conversation_id: updated.private_conversation_id,
        project_id: updated.project_id,
        group_id: updated.group_id,
        edited_at: updated.edited_at,
      },
    });
    return updated;
  }

  async softDelete(messageId: string, actorUserId: string): Promise<void> {
    const message = await this.requireEditable(messageId, actorUserId);
    await this.messages.softDelete(messageId, new Date().toISOString());
    await this.outbox?.publish({
      event_type: "message.deleted",
      aggregate_type: "message",
      aggregate_id: message.id,
      group_id: message.group_id,
      actor_id: actorUserId,
      payload: {
        message_id: message.id,
        visibility: message.visibility,
        private_conversation_id: message.private_conversation_id,
        project_id: message.project_id,
        group_id: message.group_id,
      },
    });
  }

  /**
   * Read authorization (§11.2): GROUP messages need membership; private
   * messages need conversation membership (acl callback wired in B6).
   */
  async requireReadable(
    messageId: string,
    userId: string,
    acl?: (conversationId: string, userId: string) => Promise<boolean>,
  ): Promise<Message> {
    const message = await this.messages.findById(messageId);
    if (!message || message.deleted_at) throw new AppError("NOT_FOUND", "Message not found.");
    if (message.visibility === "GROUP") return message; // membership checked by caller context
    if (message.private_conversation_id && acl) {
      const allowed = await acl(message.private_conversation_id, userId);
      if (allowed) return message;
    }
    throw new AppError("FORBIDDEN", "You cannot access this message.");
  }

  private async requireEditable(messageId: string, actorUserId: string): Promise<Message> {
    const message = await this.messages.findById(messageId);
    if (!message) throw new AppError("NOT_FOUND", "Message not found.");
    if (message.deleted_at) throw new AppError("NOT_FOUND", "Message not found.");
    // §12: the sender edits/deletes their own messages.
    if (message.sender_user_id !== actorUserId) {
      throw new AppError("GROUP_PERMISSION_DENIED", "Only the sender can modify this message.");
    }
    // M1: sender identity alone is not authorization — a REMOVED member keeps
    // no write access to their old messages. Re-verify ACTIVE membership in
    // the message's Group right now (§86 chain, §185 #11).
    await this.assertActiveMember?.(message.group_id, actorUserId);
    return message;
  }

  listGroupVisible(input: ListMessagesInput): Promise<Page<Message>> {
    return this.messages.listGroupVisible(input).then((items) => ({
      items,
      // Pages are the newest window in chronological order; the cursor marks
      // the page's oldest sequence so the next fetch continues backwards.
      next_cursor:
        items.length === input.limit && items[0] !== undefined
          ? Buffer.from(JSON.stringify({ s: items[0].server_sequence })).toString("base64url")
          : null,
    }));
  }
}

/**
 * §14.1 mention extraction: `@Name` tokens resolve to member ids server-side;
 * rendered usernames are never trusted as identifiers.
 */
export function extractMentionTokens(body: string): string[] {
  const matches = body.match(/@([A-Za-z0-9_.\-]{1,60})/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}
