import {
  GroupDeletionService,
  GroupService,
  InviteService,
  JobRunner,
  MembershipService,
  MessageService,
  IdempotencyService,
  NicknameService,
  OutboxProcessor,
  PinService,
  PrivateConversationService,
  AiAgentService,
  AttachmentService,
  NotificationService,
  ActivityService,
  SearchService,
  NotificationWorkerConsumer,
  ActivityBuilderConsumer,
  createHmacSignedUrlCodec,
  MemoryService,
  ProfileService,
  ReactionService,
  RealtimeBroadcasterConsumer,
  ProjectService,
  ProfileRepository,
  GroupRepository,
  MembershipRepository,
  InviteRepository,
  GroupDeletionRepository,
  ProjectRepository,
  ProjectInstructionRepository,
  NicknameRepository,
  MessageRepository,
  PinRepository,
  PrivateConversationRepository,
  AiAgentRepository,
  AttachmentRepository,
  SignedUrlCodec,
  NotificationRepository,
  ActivityRepository,
  MessageSearchRepository,
  ReactionRepository,
  IdempotencyRepository,
  JobRepository,
  JobQueue,
  type JobHandler,
  type RealtimePort,
  type OutboxRepository,
  type OutboxRow,
} from "@clanmind/domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Limits } from "@clanmind/shared";
import { getServiceClient } from "@clanmind/db";
import { Logger, parseLimits } from "@clanmind/shared";
import { SupabaseProfileRepository } from "./repositories/profile.repo";
import {
  SupabaseGroupRepository,
  SupabaseMembershipRepository,
} from "./repositories/group.repo";
import { SupabaseInviteRepository } from "./repositories/invite.repo";
import { SupabaseGroupDeletionRepository } from "./repositories/deletion.repo";
import {
  SupabaseProjectInstructionRepository,
  SupabaseProjectRepository,
} from "./repositories/project.repo";
import { SupabaseNicknameRepository } from "./repositories/nickname.repo";
import { SupabaseMessageRepository } from "./repositories/message.repo";
import { CloudflareRealtime } from "./realtime/cloudflare-realtime";
import {
  SupabasePinRepository,
  SupabaseReactionRepository,
} from "./repositories/engagement.repo";
import { SupabasePrivateConversationRepository } from "./repositories/private-conversation.repo";
import { SupabaseAiAgentRepository } from "./repositories/ai-agent.repo";
import {
  R2ObjectStorage,
  SupabaseAttachmentRepository,
} from "./repositories/attachment.repo";
import {
  SupabaseActivityRepository,
  SupabaseMessageSearchRepository,
  SupabaseNotificationRepository,
} from "./repositories/search-notification-activity.repo";
import {
  SupabaseAudit,
  SupabaseJobQueue,
  SupabaseJobRepository,
  SupabaseOutbox,
} from "./repositories/jobs.repo";
import { SupabaseIdempotencyRepository } from "./repositories/idempotency.repo";
import {
  SupabaseMemoryCandidateRepository,
  SupabaseMemoryRepository,
} from "./repositories/project-intel.repo";
import {
  SupabaseGithubConnectionRepository,
  SupabaseWebhookEventStore,
} from "./repositories/github.repo";
import type { Env } from "./env";

/**
 * Service registry (§182). Route handlers depend on these services and never
 * manipulate database tables directly. Tests build the same shape with
 * in-memory repositories.
 */
export interface AppServices {
  db: SupabaseClient;
  limits: Limits;
  outbox: import("@clanmind/domain").EventOutbox;
  profiles: ProfileService;
  groups: GroupService;
  membership: MembershipService;
  invites: InviteService;
  deletion: GroupDeletionService;
  projects: ProjectService;
  nicknames: NicknameService;
  messages: MessageService;
  realtime: RealtimePort;
  reactions: ReactionService;
  pins: PinService;
  privateConversations: PrivateConversationService;
  ai: AiAgentService;
  memory: MemoryService;
  attachments: AttachmentService;
  signedUrls: SignedUrlCodec;
  search: SearchService;
  notifications: NotificationService;
  activity: ActivityService;
  idempotency: IdempotencyService;
  jobs: JobQueue;
  githubConnections: SupabaseGithubConnectionRepository;
  webhookEvents: SupabaseWebhookEventStore;
}

/** Outbox repository view over Supabase for the §124 processor. */
class SupabaseOutboxRepositoryView implements OutboxRepository {
  constructor(
    private readonly db: ReturnType<typeof getServiceClient>,
  ) {}

  async fetchPending(limit: number): Promise<OutboxRow[]> {
    const { data, error } = await this.db
      .from("outbox_events")
      .select("*")
      .eq("status", "PENDING")
      .order("created_at")
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as OutboxRow[];
  }

  async markProcessed(id: string, processedAt: string): Promise<void> {
    const { error } = await this.db
      .from("outbox_events")
      .update({ status: "PROCESSED", processed_at: processedAt })
      .eq("id", id);
    if (error) throw error;
  }

  async markFailed(id: string, retryCount: number): Promise<void> {
    const { error } = await this.db
      .from("outbox_events")
      .update({ status: "FAILED", retry_count: retryCount })
      .eq("id", id);
    if (error) throw error;
  }
}

export function buildServices(env: Env): AppServices {
  const realtime = new CloudflareRealtime(env);
  const db = getServiceClient({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const limits = parseLimits(env.LIMITS_JSON);
  const profileRepo: ProfileRepository = new SupabaseProfileRepository(db);
  const groupRepo: GroupRepository = new SupabaseGroupRepository(db);
  const memberRepo: MembershipRepository = new SupabaseMembershipRepository(db);
  const inviteRepo: InviteRepository = new SupabaseInviteRepository(db);
  const deletionRepo: GroupDeletionRepository = new SupabaseGroupDeletionRepository(db);
  const outbox = new SupabaseOutbox(db);
  const audit = new SupabaseAudit(db);
  const jobRepo = new SupabaseJobRepository(db);
  const jobQueue: JobQueue = new SupabaseJobQueue(jobRepo);
  const membership = new MembershipService(groupRepo, memberRepo, outbox, audit);
  const deletion = new GroupDeletionService(groupRepo, membership, deletionRepo, audit);
  const memory = new MemoryService(
    new SupabaseMemoryRepository(db),
    new SupabaseMemoryCandidateRepository(db),
  );
  return {
    db,
    limits,
    outbox,
    profiles: new ProfileService(profileRepo),
    membership,
    groups: new GroupService(
      groupRepo,
      memberRepo,
      membership,
      outbox,
      { group_soft_delete_recovery_days: limits.group_soft_delete_recovery_days },
    ),
    invites: new InviteService(
      inviteRepo,
      groupRepo,
      memberRepo,
      membership,
      outbox,
      {
        invite_token_lifetime_days: limits.invite_token_lifetime_days,
        group_members_initial_max: limits.group_members_initial_max,
      },
    ),
    deletion,
    projects: new ProjectService(
      new SupabaseProjectRepository(db),
      new SupabaseProjectInstructionRepository(db),
      membership,
      outbox,
      { projects_active_per_group_max: limits.projects_active_per_group_max },
    ),
    nicknames: new NicknameService(new SupabaseNicknameRepository(db)),
    messages: new MessageService(new SupabaseMessageRepository(db), {
      message_body_max_chars: limits.message_body_max_chars,
    }),
    realtime,
    reactions: new ReactionService(new SupabaseReactionRepository(db)),
    pins: new PinService(new SupabasePinRepository(db)),
    privateConversations: new PrivateConversationService(
      new SupabasePrivateConversationRepository(db),
    ),
    ai: new AiAgentService(new SupabaseAiAgentRepository(db)),
    memory,
    attachments: new AttachmentService(
      new SupabaseAttachmentRepository(db),
      new R2ObjectStorage(env),
    ),
    signedUrls: createHmacSignedUrlCodec(env.SUPABASE_JWT_SECRET),
    search: new SearchService(new SupabaseMessageSearchRepository(db)),
    notifications: new NotificationService(new SupabaseNotificationRepository(db)),
    activity: new ActivityService(new SupabaseActivityRepository(db)),
    idempotency: new IdempotencyService(new SupabaseIdempotencyRepository(db)),
    jobs: jobQueue,
    githubConnections: new SupabaseGithubConnectionRepository(db),
    webhookEvents: new SupabaseWebhookEventStore(db),
  };
}

/**
 * Background runtime (§158/§124): cron claims due jobs through the JobRunner
 * and drains the outbox through registered consumers. Handlers/consumers for
 * later phases (notifications, activity, memory, realtime broadcast) register
 * here as they are introduced.
 */
export function buildBackgroundRuntime(env: Env): {
  runDueJobs: () => Promise<{ ran: number; succeeded: number; failed: number }>;
  drainOutbox: () => Promise<{ processed: number; failed: number }>;
} {
  const services = buildServices(env);
  const log = new Logger(env.LOG_LEVEL === "debug" ? "debug" : "info");
  const db = getServiceClient({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const jobRepo: JobRepository = new SupabaseJobRepository(db);
  const runner = new JobRunner(jobRepo, log);
  const realtime = services.realtime;

  const deletionHandler: JobHandler = {
    job_type: "deletion",
    async execute(payload) {
      const groupId = payload["group_id"];
      if (typeof groupId === "string") await services.deletion.purge(groupId);
    },
  };
  runner.register(deletionHandler);

  const processor = new OutboxProcessor(new SupabaseOutboxRepositoryView(db), log);
  processor.register(
    new RealtimeBroadcasterConsumer(realtime, async (row) => {
      const conversationId = row.payload["private_conversation_id"];
      if (typeof conversationId !== "string") return undefined;
      const { data, error } = await db
        .from("private_conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId);
      if (error) throw error;
      return (data ?? []).map((r: { user_id: string }) => r.user_id);
    }),
  );

  processor.register(
    new NotificationWorkerConsumer(services.notifications, async (row) => {
      const messageId = row.aggregate_id;
      const { data, error } = await db
        .from("message_mentions")
        .select("mentioned_user_id")
        .eq("message_id", messageId);
      if (error) throw error;
      return (data ?? []).map((m: { mentioned_user_id: string }) => m.mentioned_user_id);
    }),
  );
  processor.register(new ActivityBuilderConsumer(services.activity));

  return {
    runDueJobs: () => runner.runOnce(10),
    drainOutbox: () => processor.runOnce(50),
  };
}
