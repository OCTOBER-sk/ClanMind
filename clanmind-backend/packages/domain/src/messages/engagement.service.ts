import { AppError } from "@clanmind/shared";

/** §41 */
export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

/** §39B — pin visibility inherits the pinned message's visibility. */
export interface MessagePin {
  group_id: string;
  project_id: string | null;
  message_id: string;
  pinned_by: string;
  pinned_at: string;
  unpinned_at: string | null;
}

export interface ReactionRepository {
  add(input: { message_id: string; user_id: string; emoji: string }): Promise<MessageReaction>;
  remove(messageId: string, userId: string, emoji: string): Promise<void>;
  listByMessage(messageId: string): Promise<MessageReaction[]>;
}

export interface PinRepository {
  pin(input: {
    group_id: string;
    project_id: string | null;
    message_id: string;
    pinned_by: string;
  }): Promise<MessagePin>;
  unpin(groupId: string, messageId: string): Promise<void>;
  listOpen(groupId: string): Promise<MessagePin[]>;
}

const EMOJI_MAX = 32;

/** §41 reactions — one row per (message, user, emoji); toggling removes. */
export class ReactionService {
  constructor(private readonly reactions: ReactionRepository) {}

  async react(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<{ added: boolean; reaction: MessageReaction | null }> {
    if (emoji.length === 0 || emoji.length > EMOJI_MAX) {
      throw new AppError("VALIDATION_FAILED", "Invalid emoji.");
    }
    const reaction = await this.reactions.add({ message_id: messageId, user_id: userId, emoji });
    return { added: true, reaction };
  }

  async unreact(messageId: string, userId: string, emoji: string): Promise<void> {
    await this.reactions.remove(messageId, userId, emoji);
  }
}

/**
 * §39B pinning. A PRIVATE_PAIR / PRIVATE_AI message can never be pinned into
 * a Group-visible pinned list — its pin inherits the message's visibility and
 * stays scoped to the conversation.
 */
export class PinService {
  constructor(private readonly pins: PinRepository) {}

  async pin(
    message: { id: string; group_id: string; project_id: string | null; visibility: string },
    actorUserId: string,
  ): Promise<MessagePin> {
    if (message.visibility !== "GROUP") {
      throw new AppError(
        "GROUP_PERMISSION_DENIED",
        "Private messages cannot be pinned to the Group list.",
      );
    }
    return this.pins.pin({
      group_id: message.group_id,
      project_id: message.project_id,
      message_id: message.id,
      pinned_by: actorUserId,
    });
  }

  async unpin(groupId: string, messageId: string): Promise<void> {
    await this.pins.unpin(groupId, messageId);
  }

  async listOpenPins(groupId: string): Promise<MessagePin[]> {
    return this.pins.listOpen(groupId);
  }
}

/**
 * §14.2 slash commands. Parsed server-side after basic syntax validation;
 * the backend is authoritative. Initial set: /ask /private /meeting
 * /research /memory /project.
 */
export const SLASH_COMMANDS = [
  "ask",
  "private",
  "meeting",
  "research",
  "memory",
  "project",
] as const;

export type SlashCommand = (typeof SLASH_COMMANDS)[number];

export interface ParsedSlashCommand {
  command: SlashCommand;
  args: string;
}

export function parseSlashCommand(body: string): ParsedSlashCommand | null {
  const match = body.match(/^\/([a-z]+)(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  const command = match[1] as SlashCommand;
  if (!(SLASH_COMMANDS as readonly string[]).includes(command)) return null;
  return { command, args: (match[2] ?? "").trim() };
}
