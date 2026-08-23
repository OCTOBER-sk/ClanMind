import type { OutboxConsumer, OutboxRow } from "../jobs/outbox-processor";
import type { ActivityService } from "./search.service";
import type { NotificationService } from "./search.service";

/**
 * §124 "notification worker" outbox consumer. Semantic rules (§143): never
 * one notification per raw event — map domain events to the §95 categories
 * and resolve recipients. Private events notify only their audience
 * (§95A PRIVATE_MESSAGE / PRIVATE_AI rule).
 */
export class NotificationWorkerConsumer implements OutboxConsumer {
  readonly name = "notification-worker";

  constructor(
    private readonly notifications: NotificationService,
    private readonly mentionedUserIds: (row: OutboxRow) => string[] | Promise<string[]>,
  ) {}

  handles(eventType: string): boolean {
    return [
      "message.created",
      "ai.response.completed",
      "ai.action.proposed",
      "task.assigned",
      "decision.proposed",
      "artifact.created",
      "github.webhook.received",
      "meeting.ended",
      "member.invited",
    ].includes(eventType);
  }

  async process(row: OutboxRow): Promise<void> {
    const isPrivate =
      row.payload["visibility"] === "PRIVATE_PAIR" ||
      row.payload["visibility"] === "PRIVATE_AI";

    if (row.event_type === "message.created") {
      if (isPrivate) {
        // §2.4: private messages notify only the conversation audience.
        const audience = this.audienceOf(row);
        await this.notifications.notify({
          recipients: audience.filter((u) => u !== row.actor_id),
          group_id: row.group_id ?? "",
          category: "PRIVATE_MESSAGE",
          subject_type: "message",
          subject_id: row.aggregate_id,
          title: "Private message",
          delivered_realtime: true,
        });
        return;
      }
      const mentioned = await this.mentionedUserIds(row);
      if (mentioned.length > 0) {
        await this.notifications.notify({
          recipients: mentioned,
          group_id: row.group_id ?? "",
          project_id: (row.payload["project_id"] as string | undefined) ?? null,
          category: "MENTION",
          subject_type: "message",
          subject_id: row.aggregate_id,
          title: "You were mentioned",
          delivered_realtime: true,
        });
      }
      return;
    }

    // §95A: a PRIVATE_AI AI_RESPONSE must still notify its single owner —
    // the requester is the only authorized recipient, so the blanket private
    // suppression below never applies to this event type.
    if (row.event_type === "ai.response.completed") {
      const visibility = row.payload["visibility"];
      await this.notifications.notify({
        // §95A: PRIVATE_* responses notify ONLY the owning requester.
        recipients: row.actor_id ? [row.actor_id] : [],
        group_id: row.group_id ?? "",
        project_id: (row.payload["project_id"] as string | undefined) ?? null,
        category: "AI_RESPONSE",
        subject_type: "ai_run",
        subject_id: row.aggregate_id,
        title:
          visibility === "PRIVATE_PAIR" || visibility === "PRIVATE_AI"
            ? "Your private Odin response is ready"
            : "Odin completed a response",
        delivered_realtime: true,
      });
      return;
    }

    if (isPrivate) return; // §98A-analog: no private rows in shared surfaces

    switch (row.event_type) {
      case "ai.action.proposed":
      case "decision.proposed":
        // Approval requests go to admins/owner; recipient resolution is
        // provided by the wiring (repo-backed member lookup).
        break;
      case "member.invited":
        await this.notifications.notify({
          recipients: [],
          group_id: row.group_id ?? "",
          category: "SYSTEM",
          subject_type: "group_invite",
          subject_id: row.aggregate_id,
          title: "Invite sent",
        });
        break;
      default:
        break;
    }
  }

  private audienceOf(row: OutboxRow): string[] {
    const audience = row.payload["audience_user_ids"];
    if (Array.isArray(audience)) return audience.filter((u): u is string => typeof u === "string");
    return row.actor_id ? [row.actor_id] : [];
  }
}

/**
 * §124 "activity builder" (§98A). Summaries are rendered once at write time;
 * historical lines never re-render with a later viewer's nicknames.
 */
export class ActivityBuilderConsumer implements OutboxConsumer {
  readonly name = "activity-builder";

  constructor(private readonly activity: ActivityService) {}

  handles(): boolean {
    return true;
  }

  async process(row: OutboxRow): Promise<void> {
    // §98A: private events never populate activity_events.
    const visibility = row.payload["visibility"];
    if (visibility === "PRIVATE_PAIR" || visibility === "PRIVATE_AI") return;

    const summary = this.render(row);
    if (!summary) return;
    // §98A/§2.6: AI-initiated runs are attributed to the agent (actor_ai_id),
    // never to the requester as a human actor.
    const isAiActor =
      row.aggregate_type === "ai_run" || row.payload["sender_type"] === "AI";
    await this.activity.record({
      group_id: row.group_id ?? "",
      project_id: (row.payload["project_id"] as string | undefined) ?? null,
      actor_type: isAiActor ? "AI" : row.actor_id ? "USER" : "SYSTEM",
      actor_user_id: isAiActor ? null : row.actor_id,
      actor_ai_id: isAiActor ? row.actor_id : null,
      activity_type: row.event_type,
      summary,
      subject_type: row.aggregate_type,
      subject_id: row.aggregate_id,
    });
  }

  private render(row: OutboxRow): string | null {
    switch (row.event_type) {
      case "group.created":
        return `Group created`;
      case "member.joined":
        return `A member joined the Group`;
      case "member.removed":
        return `A member was removed from the Group`;
      case "member.role.changed":
        return `A member's role changed`;
      case "group.owner.transferred":
        return `Ownership was transferred`;
      case "message.created":
        return `New message`;
      case "decision.proposed":
        return `Decision proposed`;
      case "decision.approved":
        return `Decision approved`;
      case "task.created":
        return `Task created`;
      case "task.completed":
        return `Task completed`;
      case "artifact.created":
        return `Artifact created`;
      case "ai.response.completed":
        return `Odin completed a response`;
      case "ai.action.proposed":
        return `Odin proposed an action for approval`;
      case "github.connected":
        return `GitHub repository connected`;
      case "github.disconnected":
        return `GitHub repository disconnected`;
      case "github.action.proposed":
        return `GitHub write proposed for approval`;
      case "meeting.ended":
        return `Meeting ended`;
      case "github.pr.created":
        return `Pull request opened`;
      case "github.pr.merged":
        return `Pull request merged`;
      default:
        return null; // presence/typing/sync events never hit the activity feed
    }
  }
}
