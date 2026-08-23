import { AppError } from "@clanmind/shared";

/** §40 */
export interface PrivateConversation {
  id: string;
  group_id: string;
  type: "HUMAN_PAIR" | "AI";
  created_by: string;
  ai_agent_id: string | null;
  created_at: string;
}

export interface PrivateConversationRepository {
  findHumanPair(groupId: string, userA: string, userB: string): Promise<PrivateConversation | null>;
  findAi(groupId: string, userId: string, aiAgentId: string): Promise<PrivateConversation | null>;
  insert(input: {
    group_id: string;
    type: "HUMAN_PAIR" | "AI";
    created_by: string;
    ai_agent_id: string | null;
    member_user_ids: string[];
  }): Promise<PrivateConversation>;
  isMember(conversationId: string, userId: string): Promise<boolean>;
  memberIds(conversationId: string): Promise<string[]>;
}

/**
 * §2.4/§40 privacy-isolated conversations.
 *
 * PRIVATE_PAIR: only the sender and recipient see it.
 * PRIVATE_AI: only the requesting member and Odin see it.
 *
 * Private content never enters group memory, public AI context, activity
 * feeds, or public notifications (§2.4) — consumers enforce this by checking
 * the event visibility these services attach.
 */
export class PrivateConversationService {
  constructor(private readonly conversations: PrivateConversationRepository) {}

  async findOrCreateHumanPair(
    groupId: string,
    userA: string,
    userB: string,
  ): Promise<PrivateConversation> {
    if (userA === userB) {
      throw new AppError("VALIDATION_FAILED", "A private pair needs two different members.");
    }
    const existing = await this.conversations.findHumanPair(groupId, userA, userB);
    if (existing) return existing;
    return this.conversations.insert({
      group_id: groupId,
      type: "HUMAN_PAIR",
      created_by: userA,
      ai_agent_id: null,
      member_user_ids: [userA, userB],
    });
  }

  async findOrCreateAi(
    groupId: string,
    userId: string,
    aiAgentId: string,
  ): Promise<PrivateConversation> {
    const existing = await this.conversations.findAi(groupId, userId, aiAgentId);
    if (existing) return existing;
    return this.conversations.insert({
      group_id: groupId,
      type: "AI",
      created_by: userId,
      ai_agent_id: aiAgentId,
      member_user_ids: [userId],
    });
  }

  /** §11.2: enforce access in backend queries — never a client flag. */
  async requireMember(conversationId: string, userId: string): Promise<PrivateConversation> {
    const allowed = await this.conversations.isMember(conversationId, userId);
    if (!allowed) {
      throw new AppError("FORBIDDEN", "You cannot access this conversation.");
    }
    const memberIds = await this.conversations.memberIds(conversationId);
    return {
      id: conversationId,
      group_id: "",
      type: memberIds.length === 1 ? "AI" : "HUMAN_PAIR",
      created_by: memberIds[0] ?? "",
      ai_agent_id: null,
      created_at: new Date().toISOString(),
    };
  }

  /** Audience for private realtime fan-out (§11.2). */
  audience(conversationId: string): Promise<string[]> {
    return this.conversations.memberIds(conversationId);
  }
}
