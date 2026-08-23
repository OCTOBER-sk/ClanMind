import type { Message } from "./message.service";

/** §13 search filters — private results only within authorized scope. */
export interface SearchMessagesInput {
  group_id: string;
  requester_user_id: string;
  query: string;
  project_id?: string;
  sender_user_id?: string;
  from?: string;
  to?: string;
  mention_of?: string;
  has_attachments?: boolean;
  ai_messages_only?: boolean;
  include_private?: boolean;
  limit: number;
  before?: string;
}

export interface MessageSearchRepository {
  search(input: SearchMessagesInput): Promise<Message[]>;
}

/** §13 message search. Never a global search without permission filters. */
export class SearchService {
  constructor(private readonly searchRepo: MessageSearchRepository) {}

  search(input: SearchMessagesInput): Promise<Message[]> {
    const query = input.query.trim();
    if (query.length === 0) return Promise.resolve([]);
    return this.searchRepo.search({ ...input, query });
  }
}

/**
 * §95A notification rows + §143 recipient resolution rules.
 * One row per recipient per semantic event — never per raw domain event.
 */
export interface NotificationRow {
  id: string;
  recipient_user_id: string;
  group_id: string;
  project_id: string | null;
  category:
    | "MENTION"
    | "PRIVATE_MESSAGE"
    | "AI_RESPONSE"
    | "AI_ACTION_APPROVAL"
    | "TASK_ASSIGNMENT"
    | "DECISION_APPROVAL"
    | "ARTIFACT_READY"
    | "GITHUB_EVENT"
    | "MEETING_SUMMARY"
    | "PROACTIVE_AI"
    | "SYSTEM";
  subject_type: string;
  subject_id: string;
  title: string;
  body: string | null;
  delivery_state:
    | "PENDING"
    | "DELIVERED_REALTIME"
    | "DELIVERED_EMAIL"
    | "SUPPRESSED_BY_PREFERENCE"
    | "FAILED";
  read_at: string | null;
  created_at: string;
}

export interface NotificationRepository {
  insert(input: Omit<NotificationRow, "id" | "created_at" | "read_at">): Promise<NotificationRow>;
  listForUser(userId: string, limit: number, unreadOnly: boolean): Promise<NotificationRow[]>;
  markRead(userId: string, notificationId: string): Promise<void>;
  preference(
    userId: string,
    groupId: string,
    category: NotificationRow["category"],
  ): Promise<{ in_app_enabled: boolean; email_enabled: boolean } | null>;
}

export class NotificationService {
  constructor(private readonly notifications: NotificationRepository) {}

  /**
   * §143 pipeline: determine recipients → check preference → record with the
   * right delivery state. §95A: PRIVATE_MESSAGE / AI_RESPONSE for a
   * PRIVATE_AI conversation targets only the owning member — callers pass
   * exactly that audience.
   */
  async notify(input: {
    recipients: string[];
    group_id: string;
    project_id?: string | null;
    category: NotificationRow["category"];
    subject_type: string;
    subject_id: string;
    title: string;
    body?: string | null;
    delivered_realtime?: boolean;
  }): Promise<NotificationRow[]> {
    const created: NotificationRow[] = [];
    for (const recipient of new Set(input.recipients)) {
      const pref = await this.notifications.preference(
        recipient,
        input.group_id,
        input.category,
      );
      const inApp = pref?.in_app_enabled ?? true;
      const row = await this.notifications.insert({
        recipient_user_id: recipient,
        group_id: input.group_id,
        project_id: input.project_id ?? null,
        category: input.category,
        subject_type: input.subject_type,
        subject_id: input.subject_id,
        title: input.title,
        body: input.body ?? null,
        delivery_state: !inApp
          ? "SUPPRESSED_BY_PREFERENCE"
          : input.delivered_realtime
            ? "DELIVERED_REALTIME"
            : "PENDING",
      });
      created.push(row);
    }
    return created;
  }

  listForUser(userId: string, limit = 50, unreadOnly = false): Promise<NotificationRow[]> {
    return this.notifications.listForUser(userId, limit, unreadOnly);
  }

  markRead(userId: string, notificationId: string): Promise<void> {
    return this.notifications.markRead(userId, notificationId);
  }
}

/** §98A activity rows, written once with the summary pre-rendered. */
export interface ActivityRow {
  id: string;
  group_id: string;
  project_id: string | null;
  actor_type: "USER" | "AI" | "SYSTEM";
  actor_user_id: string | null;
  actor_ai_id: string | null;
  activity_type: string;
  summary: string;
  subject_type: string;
  subject_id: string;
  visibility: "GROUP" | "PROJECT";
  occurred_at: string;
}

export interface ActivityRepository {
  insert(input: Omit<ActivityRow, "id" | "occurred_at">): Promise<ActivityRow>;
  listByGroup(groupId: string, limit: number, before?: string): Promise<ActivityRow[]>;
  listByProject(projectId: string, limit: number): Promise<ActivityRow[]>;
}

export class ActivityService {
  constructor(private readonly activity: ActivityRepository) {}

  /** §98A: private events never populate this table. */
  async record(input: Omit<ActivityRow, "id" | "occurred_at" | "visibility">): Promise<void> {
    await this.activity.insert({
      ...input,
      visibility: input.project_id ? "PROJECT" : "GROUP",
    });
  }

  listByGroup(groupId: string, limit = 50): Promise<ActivityRow[]> {
    return this.activity.listByGroup(groupId, limit);
  }

  listByProject(projectId: string, limit = 50): Promise<ActivityRow[]> {
    return this.activity.listByProject(projectId, limit);
  }
}
