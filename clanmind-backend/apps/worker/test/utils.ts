import {
  GroupDeletionService,
  IdempotencyService,
  GroupService,
  InviteService,
  MembershipService,
  MessageService,
  NicknameService,
  PinService,
  PrivateConversationService,
  AiAgentService,
  ApprovalEngine,
  ArtifactService,
  AttachmentService,
  DecisionService,
  MeetingService,
  TaskService,
  createHmacSignedUrlCodec,
  MemoryService,
  ProfileService,
  ProjectService,
  ReactionService,
  SearchService,
  NotificationService,
  ActivityService,
  NOOP_AUDIT,
  NOOP_JOB_QUEUE,
  NOOP_OUTBOX,
  type Group,
  type GroupInvite,
  type GroupMember,
  type GroupRepository,
  type InviteRepository,
  type MembershipRepository,
  type Profile,
  type IdempotencyRepository,
  type MemberNickname,
  type Message,
  type MessageReaction,
  type MessageRepository,
  type PinRepository,
  type PrivateConversationRepository,
  type AiAgentRepository,
  type AiAgent,
  type Attachment,
  type AttachmentRepository,
  type ObjectStoragePort,
  type SignedUrlCodec,
  type MessageSearchRepository,
  type NotificationRepository,
  type NotificationRow,
  type ActivityRepository,
  type ReactionRepository,
  type NicknameRepository,
  type ProfileRepository,
  type Project,
  type ProjectInstruction,
  type ProjectInstructionRepository,
  type ProjectRepository,
} from "@clanmind/domain";
import { parseLimits } from "@clanmind/shared";
import type { AppServices } from "../src/services";
import type { Env } from "../src/env";

/** Shared in-memory environment + services for worker route tests. */
export const TEST_JWT_SECRET = "test-jwt-secret-value";

export const TEST_ENV = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test-key",
  SUPABASE_JWT_SECRET: TEST_JWT_SECRET,
  ENVIRONMENT: "local",
  LOG_LEVEL: "error",
  LIMITS_JSON: "",
} as unknown as Env;

export interface TestState {
  services: AppServices;
  groupRows: Group[];
  memberRows: GroupMember[];
  profileRows: Profile[];
  inviteRows: GroupInvite[];
  projectRows: Project[];
  instructionRows: ProjectInstruction[];
  messageRows: Message[];
  memoryRows: import("@clanmind/domain").Memory[];
  candidateRows: import("@clanmind/domain").MemoryCandidate[];
  notificationRows: NotificationRow[];
  artifactRows: import("@clanmind/domain").Artifact[];
  artifactVersionRows: import("@clanmind/domain").ArtifactVersion[];
  decisionRows: import("@clanmind/domain").Decision[];
  taskRows: import("@clanmind/domain").Task[];
  meetingSessionRows: import("@clanmind/domain").MeetingSession[];
  meetingCandidateRows: import("@clanmind/domain").MeetingCandidate[];
  activityRows: Record<string, unknown>[];
  pinRows: import("@clanmind/domain").MessagePin[];
  reactionRows: import("@clanmind/domain").MessageReaction[];
  githubConnRows: Record<string, unknown>[];
  githubActionRows: Record<string, unknown>[];
  webhookEventRows: Record<string, unknown>[];
  outboxEvents: import("@clanmind/domain").OutboxEventInput[];
  realtimePublishes: {
    group_id: string;
    event_type: string;
    visibility?: string;
    audience_user_ids?: string[];
  }[];
}

export function makeTestServices(): TestState {
  const groupRows: Group[] = [];
  const memberRows: GroupMember[] = [];
  const profileRows: Profile[] = [];
  const inviteRows: GroupInvite[] = [];
  const projectRows: Project[] = [];
  const instructionRows: ProjectInstruction[] = [];

  const groups: GroupRepository = {
    async insert(input) {
      const now = new Date().toISOString();
      const g: Group = {
        id: crypto.randomUUID(),
        name: input.name,
        description: input.description ?? null,
        avatar_object_id: null,
        owner_user_id: input.owner_user_id,
        status: "ACTIVE",
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      groupRows.push(g);
      return g;
    },
    async findById(id) {
      return groupRows.find((g) => g.id === id) ?? null;
    },
    async update(id, input) {
      const g = groupRows.find((x) => x.id === id);
      if (!g) return null;
      Object.assign(g, input);
      return g;
    },
    async setStatus(id, status, deletedAt) {
      const g = groupRows.find((x) => x.id === id);
      if (!g) return null;
      g.status = status;
      g.deleted_at = deletedAt;
      return g;
    },
    async listForUser(userId) {
      const ids = new Set(
        memberRows.filter((m) => m.user_id === userId && !m.removed_at).map((m) => m.group_id),
      );
      return groupRows.filter((g) => ids.has(g.id));
    },
  };

  const members: MembershipRepository = {
    async insert(input) {
      const m: GroupMember = {
        ...input,
        joined_at: new Date().toISOString(),
        removed_at: null,
        group_display_name: null,
        group_avatar_object_id: null,
      };
      memberRows.push(m);
      return m;
    },
    async findActive(group_id, user_id) {
      return (
        memberRows.find(
          (m) => m.group_id === group_id && m.user_id === user_id && !m.removed_at,
        ) ?? null
      );
    },
    async listActive(group_id) {
      return memberRows.filter((m) => m.group_id === group_id && !m.removed_at);
    },
    async countActive(group_id) {
      return memberRows.filter((m) => m.group_id === group_id && !m.removed_at).length;
    },
    async updateRole(group_id, user_id, role) {
      const m = memberRows.find(
        (x) => x.group_id === group_id && x.user_id === user_id && !x.removed_at,
      );
      if (!m) return null;
      m.role = role;
      return m;
    },
    async markRemoved(group_id, user_id) {
      const m = memberRows.find((x) => x.group_id === group_id && x.user_id === user_id);
      if (m) m.removed_at = new Date().toISOString();
    },
    async transferOwnership(group_id, fromUserId, toUserId) {
      const from = memberRows.find((x) => x.group_id === group_id && x.user_id === fromUserId);
      const to = memberRows.find((x) => x.group_id === group_id && x.user_id === toUserId);
      if (from) from.role = "ADMIN";
      if (to) to.role = "OWNER";
      const g = groupRows.find((x) => x.id === group_id);
      if (g) g.owner_user_id = toUserId;
    },
  };

  const profiles: ProfileRepository = {
    async findById(id) {
      return profileRows.find((p) => p.id === id) ?? null;
    },
    async insert(input) {
      const now = new Date().toISOString();
      const p: Profile = {
        ...input,
        avatar_object_id: null,
        created_at: now,
        updated_at: now,
        last_seen_at: null,
      };
      profileRows.push(p);
      return p;
    },
    async update(id, input) {
      const p = profileRows.find((x) => x.id === id);
      if (!p) return null;
      Object.assign(p, input);
      return p;
    },
    async touchLastSeen(id) {
      const p = profileRows.find((x) => x.id === id);
      if (p) p.last_seen_at = new Date().toISOString();
    },
  };

  const invites: InviteRepository = {
    async insert(input) {
      const invite: GroupInvite = {
        id: crypto.randomUUID(),
        uses_count: 0,
        revoked_at: null,
        created_at: new Date().toISOString(),
        ...input,
      };
      inviteRows.push(invite);
      return invite;
    },
    async findById(id) {
      return inviteRows.find((i) => i.id === id) ?? null;
    },
    async findByTokenHash(tokenHash) {
      return inviteRows.find((i) => i.token_hash === tokenHash) ?? null;
    },
    async listByGroup(groupId) {
      return inviteRows.filter((i) => i.group_id === groupId);
    },
    async markRevoked(id) {
      const i = inviteRows.find((x) => x.id === id);
      if (i) i.revoked_at = new Date().toISOString();
    },
    async incrementUses(id) {
      const i = inviteRows.find((x) => x.id === id);
      if (i) i.uses_count += 1;
    },
  };

  const projectRepos: ProjectRepository = {
    async insert(input) {
      const now = new Date().toISOString();
      const p: Project = {
        ...input,
        id: crypto.randomUUID(),
        project_type: (input.project_type as Project["project_type"]) ?? null,
        status: "active",
        progress: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      };
      projectRows.push(p);
      return p;
    },
    async findById(id) {
      return projectRows.find((p) => p.id === id) ?? null;
    },
    async update(id, input) {
      const p = projectRows.find((x) => x.id === id);
      if (!p) return null;
      Object.assign(p, input);
      return p;
    },
    async setStatus(id, status, archivedAt) {
      const p = projectRows.find((x) => x.id === id);
      if (!p) return null;
      p.status = status;
      p.archived_at = archivedAt;
      return p;
    },
    async listByGroup(groupId, includeArchived) {
      return projectRows.filter(
        (p) => p.group_id === groupId && (includeArchived || p.status === "active"),
      );
    },
    async countActive(groupId) {
      return projectRows.filter((p) => p.group_id === groupId && p.status === "active")
        .length;
    },
  };

  const instructionRepos: ProjectInstructionRepository = {
    async insert(input) {
      const now = new Date().toISOString();
      const row: ProjectInstruction = {
        ...input,
        id: crypto.randomUUID(),
        enabled: true,
        created_at: now,
        updated_at: now,
      };
      instructionRows.push(row);
      return row;
    },
    async listByProject(projectId) {
      return instructionRows
        .filter((i) => i.project_id === projectId)
        .sort((a, b) => a.priority - b.priority);
    },
    async update(id, input) {
      const row = instructionRows.find((i) => i.id === id);
      if (!row) return null;
      Object.assign(row, input);
      return row;
    },
    async delete(id) {
      const idx = instructionRows.findIndex((i) => i.id === id);
      if (idx >= 0) instructionRows.splice(idx, 1);
    },
  };

  const nicknameRows: MemberNickname[] = [];
  const nicknameRepo: NicknameRepository = {
    async upsert(input) {
      const now = new Date().toISOString();
      const existing = nicknameRows.find(
        (n) =>
          n.group_id === input.group_id &&
          n.viewer_user_id === input.viewer_user_id &&
          n.target_user_id === input.target_user_id,
      );
      if (existing) {
        Object.assign(existing, { nickname: input.nickname, updated_at: now });
        return existing;
      }
      const row: MemberNickname = { ...input, created_at: now, updated_at: now };
      nicknameRows.push(row);
      return row;
    },
    async find(groupId, viewerUserId, targetUserId) {
      return (
        nicknameRows.find(
          (n) =>
            n.group_id === groupId &&
            n.viewer_user_id === viewerUserId &&
            n.target_user_id === targetUserId,
        ) ?? null
      );
    },
    async listForViewer(groupId, viewerUserId) {
      return nicknameRows.filter(
        (n) => n.group_id === groupId && n.viewer_user_id === viewerUserId,
      );
    },
    async delete(groupId, viewerUserId, targetUserId) {
      const idx = nicknameRows.findIndex(
        (n) =>
          n.group_id === groupId &&
          n.viewer_user_id === viewerUserId &&
          n.target_user_id === targetUserId,
      );
      if (idx >= 0) nicknameRows.splice(idx, 1);
    },
  };

  const messageRows: Message[] = [];
  let messageSeq = 0;
  const messageRepo: MessageRepository = {
    async createWithMentions(input) {
      const existing = messageRows.find(
        (m) => m.group_id === input.group_id && m.client_message_id === input.client_message_id,
      );
      if (existing) return existing; // §19 idempotent duplicate
      messageSeq += 1;
      const row: Message = {
        id: crypto.randomUUID(),
        group_id: input.group_id,
        project_id: input.project_id ?? null,
        sender_type: "USER",
        sender_user_id: input.sender_user_id,
        sender_ai_id: null,
        visibility: input.visibility ?? "GROUP",
        private_conversation_id: input.private_conversation_id ?? null,
        body: input.body,
        body_format: "markdown",
        reply_to_id: input.reply_to_id ?? null,
        client_message_id: input.client_message_id,
        server_sequence: messageSeq,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
      };
      messageRows.push(row);
      return row;
    },
    async findById(id) {
      return messageRows.find((m) => m.id === id) ?? null;
    },
    async recordRevision() {},
    async updateBody(id, body, editedAt) {
      const m = messageRows.find((x) => x.id === id);
      if (!m) return null;
      m.body = body;
      m.edited_at = editedAt;
      return m;
    },
    async softDelete(id, deletedAt) {
      const m = messageRows.find((x) => x.id === id);
      if (m) m.deleted_at = deletedAt;
    },
    async listGroupVisible(input) {
      let beforeSeq: number | null = null;
      if (input.before) {
        const cursor = JSON.parse(
          Buffer.from(input.before, "base64url").toString("utf8"),
        ) as { s?: number };
        beforeSeq = typeof cursor.s === "number" ? cursor.s : null;
      }
      return messageRows
        .filter(
          (m) =>
            m.group_id === input.group_id &&
            m.visibility === "GROUP" &&
            (input.project_id ? m.project_id === input.project_id : true) &&
            (beforeSeq === null || m.server_sequence < beforeSeq),
        )
        .sort((a, b) => b.server_sequence - a.server_sequence)
        .slice(0, input.limit)
        .reverse();
    },
  };

  const idemRows: {
    operation_id: string;
    actor_id: string;
    request_hash: string;
    result_status: number | null;
    result_body: unknown;
    result_reference: string | null;
    created_at: string;
  }[] = [];
  const idemRepo: IdempotencyRepository = {
    async find(actorId, operationId) {
      return (idemRows.find(
        (r) => r.actor_id === actorId && r.operation_id === operationId,
      ) ?? null) as never;
    },
    async insert(input) {
      const row = { ...input, result_status: null, result_body: null, result_reference: null, created_at: new Date().toISOString() };
      idemRows.push(row);
      return row as never;
    },
    async recordResult(input) {
      const row = idemRows.find(
        (r) => r.actor_id === input.actor_id && r.operation_id === input.operation_id,
      );
      if (row) {
        row.result_status = input.result_status;
        row.result_body = input.result_body;
        row.result_reference = input.result_reference;
      }
    },
    async deleteOlderThan() {},
  };

  const membership = new MembershipService(groups, members);
  const deletion = new GroupDeletionService(
    groups,
    membership,
    { async purgeGroupScoped() { return []; } },
    NOOP_AUDIT,
  );
  const notificationRows: NotificationRow[] = [];
  const notificationRepo: NotificationRepository = {
    async insert(input) {
      const created: NotificationRow = {
        ...input,
        id: crypto.randomUUID(),
        read_at: null,
        created_at: new Date().toISOString(),
      };
      notificationRows.push(created);
      return created;
    },
    async listForUser(userId, limit, unreadOnly) {
      return notificationRows
        .filter((n) => n.recipient_user_id === userId && (!unreadOnly || !n.read_at))
        .slice(0, limit);
    },
    async markRead(userId, notificationId) {
      const n = notificationRows.find(
        (x) => x.id === notificationId && x.recipient_user_id === userId,
      );
      if (n) n.read_at = new Date().toISOString();
    },
    async preference() {
      return null;
    },
  };

  const activityRows: Record<string, unknown>[] = [];
  const activityRepo: ActivityRepository = {
    async insert(input) {
      const row = { ...input, id: crypto.randomUUID(), occurred_at: new Date().toISOString() };
      activityRows.push(row);
      return row as never;
    },
    async listByGroup() {
      return [];
    },
    async listByProject() {
      return [];
    },
  };

  // §13/§125 in-memory search implementing the SAME ACL contract as
  // SupabaseMessageSearchRepository: GROUP rows plus only the private
  // conversations where the requester is a member — never group-wide private.
  const searchRepo: MessageSearchRepository = {
    async search(input) {
      const q = input.query.trim().toLowerCase();
      const allowedConversations = new Set<string>();
      if (input.include_private === true) {
        for (const [convId, members] of convMembers) {
          if (members.includes(input.requester_user_id)) allowedConversations.add(convId);
        }
      }
      return messageRows.filter((m) => {
        if (m.group_id !== input.group_id || m.deleted_at) return false;
        if (q.length > 0 && !m.body.toLowerCase().includes(q)) return false;
        if (m.visibility === "GROUP") return true;
        return allowedConversations.has(m.private_conversation_id ?? "");
      });
    },
  };

  const attachmentRows: Attachment[] = [];
  const storedObjects = new Map<string, Uint8Array>();
  const storagePort: ObjectStoragePort = {
    async put(key, bytes) {
      storedObjects.set(key, bytes);
    },
    async get(key) {
      const bytes = storedObjects.get(key);
      return bytes ? { bytes, contentType: "application/octet-stream" } : null;
    },
  };
  const attachmentRepo: AttachmentRepository = {
    async insert(input) {
      const row: Attachment = { ...input, created_at: new Date().toISOString(), deleted_at: null };
      attachmentRows.push(row);
      return row;
    },
    async findById(id) {
      return attachmentRows.find((a) => a.id === id) ?? null;
    },
    async softDelete(id) {
      const row = attachmentRows.find((a) => a.id === id);
      if (row) row.deleted_at = new Date().toISOString();
    },
    async linkToMessage() {},
    async listByMessage() {
      return [];
    },
  };
  const signedUrls: SignedUrlCodec = createHmacSignedUrlCodec(TEST_JWT_SECRET);

  const agentRows: AiAgent[] = [];
  const agentRepo: AiAgentRepository = {
    async findByGroup(groupId) {
      return agentRows.find((a) => a.group_id === groupId) ?? null;
    },
    async insert(input) {
      const now = new Date().toISOString();
      const row: AiAgent = {
        id: crypto.randomUUID(),
        avatar_object_id: null,
        language: null,
        tone: null,
        personality_config: {},
        mode_policy: {},
        created_at: now,
        updated_at: now,
        ...input,
      };
      agentRows.push(row);
      return row;
    },
  };

  const convRows: import("@clanmind/domain").PrivateConversation[] = [];
  const convMembers = new Map<string, string[]>();
  const convRepo: PrivateConversationRepository = {
    async findHumanPair(groupId, userA, userB) {
      return (
        convRows.find(
          (c) =>
            c.group_id === groupId &&
            c.type === "HUMAN_PAIR" &&
            (convMembers.get(c.id) ?? []).includes(userA) &&
            (convMembers.get(c.id) ?? []).includes(userB),
        ) ?? null
      );
    },
    async findAi(groupId, userId) {
      return convRows.find((c) => c.group_id === groupId && c.type === "AI" && c.created_by === userId) ?? null;
    },
    async insert(input) {
      const row = {
        id: crypto.randomUUID(),
        group_id: input.group_id,
        type: input.type,
        created_by: input.created_by,
        ai_agent_id: input.ai_agent_id,
        created_at: new Date().toISOString(),
      };
      convRows.push(row);
      convMembers.set(row.id, input.member_user_ids);
      return row;
    },
    async isMember(conversationId, userId) {
      return (convMembers.get(conversationId) ?? []).includes(userId);
    },
    async memberIds(conversationId) {
      return convMembers.get(conversationId) ?? [];
    },
  };

  const reactionRows: MessageReaction[] = [];
  const reactionRepo: ReactionRepository = {
    async add(input) {
      const existing = reactionRows.find(
        (r) =>
          r.message_id === input.message_id &&
          r.user_id === input.user_id &&
          r.emoji === input.emoji,
      );
      if (existing) return existing;
      const row: MessageReaction = { ...input, created_at: new Date().toISOString() };
      reactionRows.push(row);
      return row;
    },
    async remove(messageId, userId, emoji) {
      const idx = reactionRows.findIndex(
        (r) => r.message_id === messageId && r.user_id === userId && r.emoji === emoji,
      );
      if (idx >= 0) reactionRows.splice(idx, 1);
    },
    async listByMessage(messageId) {
      return reactionRows.filter((r) => r.message_id === messageId);
    },
  };

  const pinRows: import("@clanmind/domain").MessagePin[] = [];
  const pinRepo: PinRepository = {
    async pin(input) {
      const existing = pinRows.find(
        (p) => p.group_id === input.group_id && p.message_id === input.message_id,
      );
      if (existing) {
        existing.unpinned_at = null;
        return existing;
      }
      const row = { ...input, pinned_at: new Date().toISOString(), unpinned_at: null };
      pinRows.push(row);
      return row;
    },
    async unpin(groupId, messageId) {
      const row = pinRows.find((p) => p.group_id === groupId && p.message_id === messageId);
      if (row) row.unpinned_at = new Date().toISOString();
    },
    async listOpen(groupId) {
      // §39B contract (mirrors the SQL): only GROUP-visibility pins surface.
      return pinRows.filter((p) => {
        if (p.group_id !== groupId || p.unpinned_at) return false;
        const message = messageRows.find((m) => m.id === p.message_id);
        return message?.visibility === "GROUP";
      });
    },
  };

  const realtimePublishes: {
    group_id: string;
    event_type: string;
    visibility?: string;
    audience_user_ids?: string[];
  }[] = [];
  const realtime = {
    async publish(input: {
      group_id: string;
      event_type: string;
      visibility?: string;
      audience_user_ids?: string[];
    }) {
      realtimePublishes.push(input);
    },
    async evict() {},
  };

  const outboxEvents: import("@clanmind/domain").OutboxEventInput[] = [];
  const outbox: import("@clanmind/domain").EventOutbox = {
    async publish(event) {
      outboxEvents.push(event);
    },
  };

  // §35/§36 in-memory memory stores for endpoint tests.
  const memoryRows: import("@clanmind/domain").Memory[] = [];
  const candidateRows: import("@clanmind/domain").MemoryCandidate[] = [];
  const memRepo: import("@clanmind/domain").MemoryRepository = {
    async insert(input) {
      const row: import("@clanmind/domain").Memory = {
        ...input,
        status: input.status ?? "ACTIVE",
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_used_at: null,
        archived_at: null,
      };
      memoryRows.push(row);
      return row;
    },
    async findById(id) {
      return memoryRows.find((m) => m.id === id) ?? null;
    },
    async update(id, patch) {
      const row = memoryRows.find((m) => m.id === id);
      if (!row) return null;
      Object.assign(row, patch);
      return row;
    },
    async archive(id) {
      const row = memoryRows.find((m) => m.id === id);
      if (row) row.status = "ARCHIVED";
    },
    async supersede(id) {
      const row = memoryRows.find((m) => m.id === id);
      if (row) row.status = "SUPERSEDED";
    },
    async delete(id) {
      const idx = memoryRows.findIndex((m) => m.id === id);
      if (idx >= 0) memoryRows.splice(idx, 1);
    },
    async searchInScope(input) {
      return memoryRows
        .filter(
          (m) =>
            m.group_id === input.group_id &&
            m.scope_type === input.scope_type &&
            m.status === "ACTIVE" &&
            (input.scope_type !== "PROJECT" || m.project_id === input.project_id) &&
            (input.scope_type !== "USER_PRIVATE" || m.user_id === input.user_id),
        )
        .slice(0, input.limit);
    },
    async findByNormalizedContent(input) {
      return (
        memoryRows.find(
          (m) =>
            m.group_id === input.group_id &&
            m.memory_type === input.memory_type &&
            m.normalized_content === input.normalized_content,
        ) ?? null
      );
    },
  };
  const candRepo: import("@clanmind/domain").MemoryCandidateRepository = {
    async insert(input) {
      const row: import("@clanmind/domain").MemoryCandidate = {
        ...input,
        status: input.status ?? "PENDING",
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      candidateRows.push(row);
      return row;
    },
    async findById(id) {
      return candidateRows.find((c) => c.id === id) ?? null;
    },
    async setStatus(id, status) {
      const row = candidateRows.find((c) => c.id === id);
      if (row) row.status = status;
    },
    async listByGroup(groupId, status) {
      return candidateRows.filter((c) => c.group_id === groupId && c.status === status);
    },
  };

  // §77/§80 GitHub connection + webhook stores (stubbed unless a test drives them).
  const githubConnRows: Record<string, unknown>[] = [];
  const githubConnections = {
    async findByGroup(groupId: string) {
      return githubConnRows.find((r) => r.group_id === groupId) ?? null;
    },
    async findByInstallation(installationId: number) {
      return (
        githubConnRows.find((r) => r.installation_id === installationId && !r.disconnected_at) ??
        null
      );
    },
    async connect(input: Record<string, unknown>) {
      const row = {
        disconnected_at: null,
        connected_at: new Date().toISOString(),
        repo_full_name:
          input.owner_login && input.repo_name
            ? `${String(input.owner_login)}/${String(input.repo_name)}`
            : null,
        ...input,
      };
      const existing = githubConnRows.findIndex((r) => r.group_id === input.group_id);
      if (existing >= 0) githubConnRows[existing] = row;
      else githubConnRows.push(row);
      return row;
    },
    async disconnect(groupId: string) {
      const row = githubConnRows.find((r) => r.group_id === groupId);
      if (row) {
        row.installation_id = null;
        row.disconnected_at = new Date().toISOString();
      }
    },
  };
  const seenDeliveries = new Set<string>();
  const webhookEventRows: {
    delivery_id: string;
    event_type: string;
    installation_id: number | null;
    payload: Record<string, unknown>;
    group_id: string | null;
  }[] = [];
  const webhookEvents = {
    async beginDelivery(input: { delivery_id: string; event_type: string; installation_id: number | null; payload: Record<string, unknown> }) {
      if (webhookEventRows.some((r) => r.delivery_id === input.delivery_id)) return true;
      webhookEventRows.push({ ...input, group_id: null });
      return false;
    },
    async attachGroup(deliveryId: string, groupId: string) {
      const row = webhookEventRows.find((r) => r.delivery_id === deliveryId);
      if (row) row.group_id = groupId;
    },
  };

  // §109–§112 in-memory project-intelligence stores.
  const artifactRows: import("@clanmind/domain").Artifact[] = [];
  const artifactVersionRows: import("@clanmind/domain").ArtifactVersion[] = [];
  const artifactsRepo: import("@clanmind/domain").ArtifactRepository = {
    ...(() => {
      const now = () => new Date().toISOString();
      return {
        async insert(input) {
          const a: import("@clanmind/domain").Artifact = {
            ...input,
            id: crypto.randomUUID(),
            created_by_ai_id: null,
            status: "ACTIVE",
            pinned: false,
            current_version_id: null,
            created_at: now(),
            updated_at: now(),
            deleted_at: null,
          };
          artifactRows.push(a);
          return a;
        },
        async findById(id) {
          return artifactRows.find((a) => a.id === id) ?? null;
        },
        async update(id, input) {
          const a = artifactRows.find((x) => x.id === id);
          if (!a) return null;
          Object.assign(a, input, { updated_at: now() });
          return a;
        },
        async listByProject(projectId) {
          return artifactRows.filter((a) => a.project_id === projectId && !a.deleted_at);
        },
        async nextVersionNumber(artifactId) {
          return (
            artifactVersionRows.filter((v) => v.artifact_id === artifactId).length + 1
          );
        },
        async insertVersion(input) {
          const v: import("@clanmind/domain").ArtifactVersion = {
            ...input,
            version_number:
              input.version_number ??
              artifactVersionRows.filter((x) => x.artifact_id === input.artifact_id).length + 1,
            id: crypto.randomUUID(),
            created_at: now(),
          };
          artifactVersionRows.push(v);
          return v;
        },
        async findVersion(artifactId, versionNumber) {
          return (
            artifactVersionRows.find(
              (v) => v.artifact_id === artifactId && v.version_number === versionNumber,
            ) ?? null
          );
        },
        async listVersions(artifactId) {
          return artifactVersionRows
            .filter((v) => v.artifact_id === artifactId)
            .sort((a, b) => a.version_number - b.version_number);
        },
        async addLink() {},
      };
    })(),
  };
  const decisionRows: import("@clanmind/domain").Decision[] = [];
  let decisionSeq = 0;
  const decisionsRepo: import("@clanmind/domain").DecisionRepository = {
    async insert(input) {
      decisionSeq += 1;
      const d: import("@clanmind/domain").Decision = {
        ...input,
        id: crypto.randomUUID(),
        status: "PROPOSED",
        version: 1,
        options: null,
        selected_option: null,
        rationale: null,
        approved_by: null,
        approved_at: null,
        created_at: new Date(Date.now() + decisionSeq).toISOString(),
        updated_at: new Date(Date.now() + decisionSeq).toISOString(),
      };
      decisionRows.push(d);
      return d;
    },
    async findById(id) {
      return decisionRows.find((d) => d.id === id) ?? null;
    },
    async listByProject(projectId) {
      return decisionRows.filter((d) => d.project_id === projectId);
    },
    async compareAndSetStatus(input) {
      const d = decisionRows.find(
        (x) =>
          x.id === input.id &&
          x.version === input.expectedVersion &&
          x.status === input.from,
      );
      if (!d) return null;
      d.status = input.to;
      d.version = input.expectedVersion + 1;
      d.updated_at = new Date().toISOString();
      if (input.approved_by) {
        d.approved_by = input.approved_by;
        d.approved_at = d.updated_at;
      }
      return d;
    },
    async supersedeOthers(projectId, excludingId) {
      for (const d of decisionRows) {
        if (d.project_id === projectId && d.status === "APPROVED" && d.id !== excludingId) {
          d.status = "SUPERSEDED";
        }
      }
    },
  };
  const taskRows: import("@clanmind/domain").Task[] = [];
  const taskDeps: { task_id: string; depends_on_task_id: string }[] = [];
  const tasksRepo: import("@clanmind/domain").TaskRepository = {
    async insert(input) {
      const t: import("@clanmind/domain").Task = {
        ...input,
        id: crypto.randomUUID(),
        status: "TODO",
        priority: "MEDIUM",
        version: 1,
        created_by_ai_id: null,
        due_at: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      taskRows.push(t);
      return t;
    },
    async findById(id) {
      return taskRows.find((t) => t.id === id) ?? null;
    },
    async listByProject(projectId) {
      return taskRows.filter((t) => t.project_id === projectId);
    },
    async compareAndUpdate(input) {
      const t = taskRows.find(
        (x) => x.id === input.id && x.version === input.expectedVersion && x.status !== "CANCELLED",
      );
      if (!t) return null;
      Object.assign(t, input.patch, {
        version: input.expectedVersion + 1,
        updated_at: new Date().toISOString(),
      });
      if (input.patch.status === "DONE") t.completed_at = t.updated_at;
      return t;
    },
    async addDependency(taskId, dependsOnTaskId) {
      taskDeps.push({ task_id: taskId, depends_on_task_id: dependsOnTaskId });
    },
    async dependenciesOf(taskId) {
      return taskDeps.filter((d) => d.task_id === taskId).map((d) => d.depends_on_task_id);
    },
  };
  const meetingSessionRows: import("@clanmind/domain").MeetingSession[] = [];
  const meetingCandidateRows: import("@clanmind/domain").MeetingCandidate[] = [];
  const meetingSummaryRows = new Map<string, string>();
  const meetingsRepo: import("@clanmind/domain").MeetingRepository = {
    async insertSession(input) {
      const s: import("@clanmind/domain").MeetingSession = {
        ...input,
        id: crypto.randomUUID(),
        started_at: new Date().toISOString(),
        ended_at: null,
        status: "ACTIVE",
        summary_artifact_id: null,
      };
      meetingSessionRows.push(s);
      return s;
    },
    async findSession(id) {
      return meetingSessionRows.find((s) => s.id === id) ?? null;
    },
    async endSession(id, summaryArtifactId) {
      const s = meetingSessionRows.find((x) => x.id === id);
      if (s) {
        s.status = "ENDED";
        s.ended_at = new Date().toISOString();
        s.summary_artifact_id = summaryArtifactId;
      }
    },
    async insertCandidate(input) {
      const cRow: import("@clanmind/domain").MeetingCandidate = {
        ...input,
        id: crypto.randomUUID(),
        status: "PENDING",
        promoted_to_type: null,
        promoted_to_id: null,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };
      meetingCandidateRows.push(cRow);
      return cRow;
    },
    async findCandidate(id) {
      return meetingCandidateRows.find((c) => c.id === id) ?? null;
    },
    async resolveCandidate(id, status, promoted) {
      const cRow = meetingCandidateRows.find((x) => x.id === id);
      if (cRow) {
        cRow.status = status;
        cRow.promoted_to_type = promoted?.promoted_to_type ?? null;
        cRow.promoted_to_id = promoted?.promoted_to_id ?? null;
        cRow.resolved_at = new Date().toISOString();
      }
    },
    async listCandidates(sessionId) {
      return meetingCandidateRows.filter((c) => c.meeting_session_id === sessionId);
    },
    async upsertSummary(input) {
      meetingSummaryRows.set(input.meeting_session_id, input.summary_text);
    },
  };

  // §78 github_actions store (approval state joins through ai_action_id).
  const githubActionRows: Record<string, unknown>[] = [];
  const githubActions = {
    async insert(input: Record<string, unknown>) {
      const row = { id: crypto.randomUUID(), pr_number: null, completed_at: null, ...input };
      githubActionRows.push(row);
      return row;
    },
    async findById(id: string) {
      return githubActionRows.find((r) => r.id === id) ?? null;
    },
    async listByProjectWithStatus(projectId: string) {
      return githubActionRows
        .filter((r) => r.project_id === projectId)
        .map((r) => ({ ...(r as Record<string, unknown>), status: "WAITING_APPROVAL", risk_level: "HIGH" }));
    },
  };

  // §78A in-memory ai_actions store + approval engine for REST GitHub flows.
  const actionRows: import("@clanmind/domain").AiAction[] = [];
  const approvalRows: import("@clanmind/domain").AiActionApproval[] = [];
  const actionsRepo: import("@clanmind/domain").ActionRepository = {
    async insert(input) {
      const now = new Date().toISOString();
      const action: import("@clanmind/domain").AiAction = {
        ...input,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
        status: input.status ?? "PROPOSED",
      };
      actionRows.push(action);
      return action;
    },
    async findById(id) {
      return actionRows.find((a) => a.id === id) ?? null;
    },
    async setStatus(id, status) {
      const a = actionRows.find((x) => x.id === id);
      if (a) {
        a.status = status;
        a.updated_at = new Date().toISOString();
      }
    },
    async findApproval(actionId) {
      return approvalRows.find((ap) => ap.action_id === actionId) ?? null;
    },
    async insertApproval(input) {
      const approval: import("@clanmind/domain").AiActionApproval = {
        ...input,
        id: crypto.randomUUID(),
        approved_at: new Date().toISOString(),
      };
      approvalRows.push(approval);
      return approval;
    },
    async completeApproval(actionId, result) {
      const approval = approvalRows.find((ap) => ap.action_id === actionId);
      if (approval) {
        approval.execution_result = result;
        approval.executed_at = new Date().toISOString();
      }
    },
  };

  const services: AppServices = {
    db: null as unknown as AppServices["db"], // AI-runtime paths use their own fakes in tests
    limits: parseLimits("{}"),
    outbox,
    profiles: new ProfileService(profiles),
    membership,
    groups: new GroupService(groups, members, membership, NOOP_OUTBOX, {
      group_soft_delete_recovery_days: 30,
    }),
    invites: new InviteService(invites, groups, members, membership, NOOP_OUTBOX, {
      invite_token_lifetime_days: 7,
      group_members_initial_max: 25,
    }),
    deletion,
    nicknames: new NicknameService(nicknameRepo),
    messages: new MessageService(messageRepo, { message_body_max_chars: 8000 }, outbox),
    realtime,
    reactions: new ReactionService(reactionRepo),
    pins: new PinService(pinRepo),
    privateConversations: new PrivateConversationService(convRepo),
    ai: new AiAgentService(agentRepo),
    memory: new MemoryService(memRepo, candRepo),
    artifacts: new ArtifactService(artifactsRepo, {
      artifact_text_max_bytes: 512_000,
      artifact_binary_max_bytes: 10_485_760,
    }),
    decisions: new DecisionService(decisionsRepo, async () => undefined),
    tasks: new TaskService(tasksRepo),
    meetings: new MeetingService(meetingsRepo),
    attachments: new AttachmentService(attachmentRepo, storagePort),
    signedUrls,
    search: new SearchService(searchRepo),
    notifications: new NotificationService(notificationRepo),
    activity: new ActivityService(activityRepo),
    idempotency: new IdempotencyService(idemRepo),
    projects: new ProjectService(
      projectRepos,
      instructionRepos,
      membership,
      NOOP_OUTBOX,
      { projects_active_per_group_max: 20 },
    ),
    jobs: NOOP_JOB_QUEUE,
    githubConnections: githubConnections as unknown as AppServices["githubConnections"],
    githubActions: githubActions as unknown as AppServices["githubActions"],
    webhookEvents: webhookEvents as unknown as AppServices["webhookEvents"],
    actions: actionsRepo,
    approvals: new ApprovalEngine(actionsRepo),
  };
  return {
    services,
    realtimePublishes,
    groupRows,
    memberRows,
    profileRows,
    inviteRows,
    projectRows,
    instructionRows,
    messageRows,
    memoryRows,
    candidateRows,
    notificationRows,
    artifactRows,
    artifactVersionRows,
    decisionRows,
    taskRows,
    meetingSessionRows,
    meetingCandidateRows,
    activityRows,
    pinRows,
    reactionRows,
    githubConnRows,
    githubActionRows,
    webhookEventRows,
    outboxEvents,
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Signs a test Supabase-style HS256 token for the given user id. */
export async function tokenFor(userId: string): Promise<string> {
  const header = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  );
  const body = bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 600 }),
    ),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(TEST_JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${body}`),
  );
  return `${header}.${body}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

/** Standard test user ids. */
export const U = {
  OWNER: "00000000-0000-4000-8000-000000000001",
  ADMIN: "00000000-0000-4000-8000-000000000002",
  MEMBER: "00000000-0000-4000-8000-000000000003",
  OUTSIDER: "00000000-0000-4000-8000-000000000004",
};

export async function authHeader(userId: string): Promise<Record<string, string>> {
  return { authorization: `Bearer ${await tokenFor(userId)}` };
}
