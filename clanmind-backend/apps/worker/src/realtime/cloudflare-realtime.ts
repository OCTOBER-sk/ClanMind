import type { RealtimePort } from "@clanmind/domain";
import type { Env } from "../env";

/** RealtimePort over the GROUP_ROOM Durable Object binding. */
export class CloudflareRealtime implements RealtimePort {
  constructor(private readonly env: Env) {}

  private stub(groupId: string) {
    return this.env.GROUP_ROOM.get(this.env.GROUP_ROOM.idFromName(groupId));
  }

  async publish(input: Parameters<RealtimePort["publish"]>[0]): Promise<void> {
    if (!input.group_id) return;
    await this.stub(input.group_id).fetch("https://room/internal/publish", {
      method: "POST",
      body: JSON.stringify({
        event_id: typeof input.payload["outbox_id"] === "string"
          ? (input.payload["outbox_id"] as string)
          : `evt_${crypto.randomUUID().replace(/-/g, "")}`,
        event_type: input.event_type,
        group_id: input.group_id,
        project_id: input.project_id ?? null,
        actor_id: input.actor_id ?? null,
        visibility: input.visibility ?? "GROUP",
        occurred_at: new Date().toISOString(),
        payload: input.payload,
        request_id: typeof input.payload["outbox_id"] === "string"
          ? (input.payload["outbox_id"] as string)
          : null,
        audience_user_ids: input.audience_user_ids,
      }),
    });
  }

  async evict(groupId: string, userId: string): Promise<void> {
    await this.stub(groupId).fetch("https://room/internal/evict", {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  }
}
