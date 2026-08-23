import { verifySupabaseJwt } from "@clanmind/auth";
import {
  clientMessageSchema,
  EVENT_PROTOCOL_VERSION,
  type RealtimeEnvelope,
} from "@clanmind/contracts";
import { RoomCore, gateProtocolVersion } from "@clanmind/domain";
import { getServiceClient } from "@clanmind/db";
import type { Env } from "../env";

/**
 * Group realtime room Durable Object (§15.2, §16, §17).
 * One room per Group: shared event fan-out, presence, message ordering.
 * Postgres remains canonical (Correction 2) — the DO coordinates low-latency
 * realtime only; history beyond the ring is served from Postgres (§157).
 *
 * Connect lifecycle (§16): authenticate → validate membership → determine
 * scopes → accept WebSocket → room.subscribe → connection.ready → presence.
 */
export class GroupRoom implements DurableObject {
  private readonly core = new RoomCore();
  private readonly publishedIds = new Set<string>();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/ws") && request.headers.get("upgrade") === "websocket") {
      return this.handleConnect(request, url);
    }
    if (url.pathname.endsWith("/internal/publish") && request.method === "POST") {
      return this.handlePublish(request);
    }
    if (url.pathname.endsWith("/internal/evict") && request.method === "POST") {
      return this.handleEvict(request);
    }
    if (url.pathname.endsWith("/internal/sync") && request.method === "POST") {
      return this.handleSync(request);
    }
    return new Response("GroupRoom online", { status: 200 });
  }

  // --- §16 connection lifecycle ---

  private async handleConnect(request: Request, url: URL): Promise<Response> {
    // 1. authenticate (token via query; browsers cannot set WS headers)
    const token = url.searchParams.get("token") ?? "";
    let userId: string;
    try {
      const user = await verifySupabaseJwt(token, this.env.SUPABASE_JWT_SECRET);
      userId = user.user_id;
    } catch {
      return new Response("unauthorized", { status: 401 });
    }

    // 2. validate Group membership (removed members never enter §185 #11)
    const groupId = this.state.id.name;
    if (!groupId) return new Response("bad room", { status: 400 });
    const db = getServiceClient({
      url: this.env.SUPABASE_URL,
      serviceRoleKey: this.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    const { data: member, error } = await db
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .is("removed_at", null)
      .maybeSingle();
    if (error || !member) return new Response("forbidden", { status: 403 });

    // 3-5. scopes determined per member role; accept socket (hibernation-safe)
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1], [`user:${userId}`]);
    pair[1].serializeAttachment({ user_id: userId, hello: false });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.sendTo(ws, { type: "error", code: "VALIDATION_FAILED", message: "Malformed frame." });
      return;
    }
    const message = clientMessageSchema.safeParse(parsed);
    if (!message.success) {
      this.sendTo(ws, { type: "error", code: "VALIDATION_FAILED", message: "Unknown message." });
      return;
    }
    const attachment = (ws.deserializeAttachment() ?? {}) as {
      user_id?: string;
      hello?: boolean;
    };
    const userId = attachment.user_id ?? "";
    const kind: string = message.data.type;

    // §96 heartbeat sweep (opportunistic): entries not refreshed within
    // 90s are stale — sockets that died without a close frame. Removed
    // users are broadcast offline below; nothing is persisted.
    for (const staleUserId of this.core.sweepStalePresence(Date.now(), 90_000)) {
      this.broadcastSystem("presence.offline", { user_id: staleUserId });
    }

    switch (message.data.type) {
      case "connection.hello": {
        // §149: gate against the CONFIGURED minimum, not a hard-coded floor.
        const minProtocol = Number(this.env.MIN_PROTOCOL_VERSION ?? "1") || 1;
        const gate = gateProtocolVersion(message.data.protocol_version, minProtocol);
        if (!gate.ok) {
          // §149: reject unsupported old clients with an explicit event.
          this.sendTo(ws, {
            type: "error",
            code: "CLIENT_UPDATE_REQUIRED",
            message: gate.message,
          });
          ws.close(4000, "CLIENT_UPDATE_REQUIRED");
          return;
        }
        attachment.hello = true;
        ws.serializeAttachment(attachment);
        if (typeof message.data.last_server_sequence === "number") {
          this.core.hydrate(message.data.last_server_sequence);
        }
        this.sendTo(ws, {
          type: "connection.ready",
          protocol_version: EVENT_PROTOCOL_VERSION,
          sequence: this.core.currentSequence(),
        });
        return;
      }
      case "room.subscribe": {
        if (!attachment.hello) {
          this.sendTo(ws, { type: "error", code: "UNAUTHENTICATED", message: "hello first." });
          return;
        }
        // 7-8: acknowledgement + presence state
        this.core.setPresence(userId, "ONLINE");
        this.broadcastSystem("presence.online", { user_id: userId });
        this.sendTo(ws, {
          type: "connection.ready",
          protocol_version: EVENT_PROTOCOL_VERSION,
          sequence: this.core.currentSequence(),
          presence: this.core.snapshot(),
        });
        return;
      }
      case "typing.start":
      case "typing.stop": {
        if (message.data.type === "typing.start") this.core.typingStart(userId);
        else this.core.typingStop(userId);
        this.broadcastSystem(
          message.data.type === "typing.start"
            ? "presence.typing.started"
            : "presence.typing.stopped",
          { user_id: userId },
        );
        return;
      }
      case "presence.update": {
        this.core.setPresence(userId, message.data.state);
        this.broadcastSystem("presence.updated", {
          user_id: userId,
          state: message.data.state,
        });
        if (
          message.data.viewing_subject_type !== undefined ||
          message.data.viewing_subject_id !== undefined
        ) {
          const viewing = this.core.viewingChanged(
            userId,
            message.data.viewing_subject_type ?? null,
            message.data.viewing_subject_id ?? null,
          );
          this.broadcastSystem("presence.viewing.changed", { viewing });
        }
        return;
      }
      case "sync.request": {
        const events = this.core.eventsSince(message.data.from_sequence, message.data.limit ?? 100);
        if (events === null) {
          // §157: DO ring exhausted — client fetches history from Postgres API.
          this.sendTo(ws, {
            type: "sync.events",
            fallback: true,
            from_sequence: message.data.from_sequence,
            events: [],
          });
        } else {
          this.sendTo(ws, {
            type: "sync.events",
            from_sequence: message.data.from_sequence,
            events,
          });
        }
        return;
      }
      default: {
        // message.send and other persistence-bearing ops land with B3+.
        this.sendTo(ws, {
          type: "error",
          code: "VALIDATION_FAILED",
          message: `${kind} is not available on this room yet.`,
        });
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = (ws.deserializeAttachment() ?? {}) as { user_id?: string };
    const userId = attachment.user_id;
    if (userId) {
      // §16: grace period before treating the drop as offline. The debounce
      // is generation-checked inside the core (reconnect cancels it); when
      // it fires, drainOfflineTransitions below broadcasts presence.offline.
      this.core.scheduleOffline(userId, new Date(), (fn, ms) => setTimeout(fn, ms));
      setTimeout(() => {
        for (const offlineUserId of this.core.drainOfflineTransitions()) {
          this.broadcastSystem("presence.offline", { user_id: offlineUserId });
        }
      }, 30_000);
    }
  }

  // --- internal API used by the worker / outbox consumers ---

  private async handlePublish(request: Request): Promise<Response> {
    const body = (await request.json()) as Partial<RealtimeEnvelope> & {
      audience_user_ids?: string[];
    };
    // Deduplicate: the REST fast-path and the outbox consumer may both
    // deliver the same logical event; the room sequences it exactly once.
    const dedupeKey = body.request_id ?? body.event_id;
    if (dedupeKey && this.publishedIds.has(dedupeKey)) {
      return Response.json({ sequence: this.core.currentSequence(), duplicate: true });
    }
    if (dedupeKey) {
      this.publishedIds.add(dedupeKey);
      if (this.publishedIds.size > 1000) {
        const drop = this.publishedIds.values().next().value;
        if (drop !== undefined) this.publishedIds.delete(drop);
      }
    }
    const envelope: RealtimeEnvelope = {
      protocol_version: EVENT_PROTOCOL_VERSION,
      event_id: body.event_id ?? `evt_${crypto.randomUUID().replace(/-/g, "")}`,
      event_type: body.event_type ?? "group.updated",
      sequence: this.core.nextSequence(),
      group_id: body.group_id ?? this.state.id.name ?? "",
      project_id: body.project_id ?? null,
      actor_id: body.actor_id ?? null,
      visibility: body.visibility ?? "GROUP",
      occurred_at: body.occurred_at ?? new Date().toISOString(),
      payload: body.payload ?? {},
      request_id: body.request_id ?? null,
    };
    this.core.remember(envelope);

    const frame = JSON.stringify({ type: "event", envelope });
    const audience = new Set(body.audience_user_ids ?? []);
    for (const ws of this.state.getWebSockets()) {
      if (envelope.visibility === "GROUP") {
        ws.send(frame);
        continue;
      }
      // §11.2/§2.4: private events reach only conversation members.
      const tag = this.userTagOf(ws);
      if (tag && audience.has(tag)) ws.send(frame);
    }
    return Response.json({ sequence: envelope.sequence });
  }

  private async handleEvict(request: Request): Promise<Response> {
    const { user_id } = (await request.json()) as { user_id?: string };
    if (!user_id) return new Response("bad request", { status: 400 });
    let closed = 0;
    for (const ws of this.state.getWebSockets(`user:${user_id}`)) {
      ws.close(4003, "MEMBER_REMOVED");
      closed += 1;
    }
    this.core.setPresence(user_id, "OFFLINE");
    return Response.json({ closed });
  }

  private async handleSync(request: Request): Promise<Response> {
    const { from_sequence, limit } = (await request.json()) as {
      from_sequence: number;
      limit?: number;
    };
    const events = this.core.eventsSince(from_sequence, limit ?? 100);
    return Response.json({
      events,
      fallback: events === null,
      sequence: this.core.currentSequence(),
    });
  }

  // --- helpers ---

  private userTagOf(ws: WebSocket): string | null {
    const attachment = (ws.deserializeAttachment() ?? {}) as { user_id?: string };
    return attachment.user_id ?? null;
  }

  private sendTo(ws: WebSocket, payload: unknown): void {
    ws.send(JSON.stringify(payload));
  }

  /** Room-level presence/typing events are envelopes too (§17/§18). */
  private broadcastSystem(eventType: string, payload: Record<string, unknown>): void {
    const envelope: RealtimeEnvelope = {
      protocol_version: EVENT_PROTOCOL_VERSION,
      event_id: `evt_${crypto.randomUUID().replace(/-/g, "")}`,
      event_type: eventType,
      sequence: this.core.nextSequence(),
      group_id: this.state.id.name ?? "",
      project_id: null,
      actor_id: typeof payload["user_id"] === "string" ? (payload["user_id"] as string) : null,
      visibility: "GROUP",
      occurred_at: new Date().toISOString(),
      payload,
      request_id: null,
    };
    this.core.remember(envelope);
    const frame = JSON.stringify({ type: "event", envelope });
    for (const ws of this.state.getWebSockets()) ws.send(frame);
  }
}
