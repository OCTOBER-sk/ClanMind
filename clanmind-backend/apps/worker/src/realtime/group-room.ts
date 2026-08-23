import { verifySupabaseJwt } from "@clanmind/auth";
import {
  EVENT_PROTOCOL_VERSION,
  clientMessageSchema,
  type RealtimeEnvelope,
} from "@clanmind/contracts";
import {
  MessageService,
  MeetingService,
  RoomCore,
  gateProtocolVersion,
} from "@clanmind/domain";
import { AppError, parseLimits } from "@clanmind/shared";
import { getServiceClient } from "@clanmind/db";
import { SupabaseMessageRepository } from "../repositories/message.repo";
import { SupabaseReactionRepository } from "../repositories/engagement.repo";
import { SupabaseMeetingRepository } from "../repositories/project-intel.repo";
import { SupabaseOutbox } from "../repositories/jobs.repo";
import type { Env } from "../env";

/** §102 error frame: stable machine-readable code + message, top-level fields. */
export interface WsErrorFrame {
  type: "error";
  code: string;
  message: string;
  /** §91/§102 — carried verbatim when the server says RATE_LIMITED. */
  retry_after_seconds?: number;
}

/**
 * §102 faithful AppError → error-frame mapping. Domain codes ride through
 * unchanged (RATE_LIMITED stays RATE_LIMITED, GROUP_PERMISSION_DENIED stays
 * GROUP_PERMISSION_DENIED, …); only unknown/non-domain errors collapse to
 * VALIDATION_FAILED, and internals never leak into the message (§102).
 */
export function wsErrorFrame(error: unknown): WsErrorFrame {
  if (error instanceof AppError) {
    const details = error.details as { retry_after_seconds?: number } | undefined;
    return {
      type: "error",
      code: error.code,
      message: error.message,
      ...(error.code === "RATE_LIMITED" && typeof details?.retry_after_seconds === "number"
        ? { retry_after_seconds: details.retry_after_seconds }
        : {}),
    };
  }
  return { type: "error", code: "VALIDATION_FAILED", message: "Operation failed." };
}

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
  /** §114 persistence services, built lazily from env (Correction 2: Postgres
   * stays canonical; the DO only coordinates + persists through the same
   * repositories the REST layer uses). */
  private roomServices?: {
    messages: MessageService;
    reactions: SupabaseReactionRepository;
    meetings: MeetingService;
    db: ReturnType<typeof getServiceClient>;
  };

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  private services() {
    if (!this.roomServices) {
      const db = getServiceClient({
        url: this.env.SUPABASE_URL,
        serviceRoleKey: this.env.SUPABASE_SERVICE_ROLE_KEY,
      });
      const outbox: import("@clanmind/domain").EventOutbox = new SupabaseOutbox(db);
      const limits = parseLimits(this.env.LIMITS_JSON);
      this.roomServices = {
        db,
        messages: new MessageService(
          new SupabaseMessageRepository(db),
          { message_body_max_chars: limits.message_body_max_chars },
          outbox,
        ),
        reactions: new SupabaseReactionRepository(db),
        meetings: new MeetingService(new SupabaseMeetingRepository(db)),
      };
    }
    return this.roomServices;
  }

  /** The room id IS the Group id (one room per Group). */
  private get groupId(): string {
    return this.state.id.name ?? "";
  }

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
          // §165 version metadata on EVERY connect (FE §309A checks it
          // per-connection, not only at cold start).
          minimum_client_version: this.env.CLIENT_MINIMUM_VERSION,
          recommended_client_version: this.env.CLIENT_RECOMMENDED_VERSION,
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
      case "message.send": {
        // §105/§114: WS send persists through the same atomic RPC as REST;
        // Postgres is canonical (Correction 2), the frame below is only the
        // sender's confirmation — other clients receive the broadcast via
        // the outbox broadcaster fan-out.
        if (!attachment.hello) {
          this.sendError(ws, "UNAUTHENTICATED", "hello first.");
          return;
        }
        const { messages } = this.services();
        try {
          const created = await messages.send({
            group_id: this.groupId,
            project_id: message.data.project_id ?? null,
            client_message_id: message.data.client_operation_id,
            body: message.data.body,
            reply_to_id: message.data.reply_to_id ?? null,
            mention_user_ids: message.data.mention_user_ids ?? [],
            sender_user_id: userId,
          });
          this.sendTo(ws, {
            type: "message.created",
            source: "self",
            message: {
              id: created.id,
              server_sequence: created.server_sequence,
              body: created.body,
              project_id: created.project_id,
              reply_to_id: created.reply_to_id,
              created_at: created.created_at,
            },
          });
        } catch (error) {
          // §102: RATE_LIMITED / GROUP_PERMISSION_DENIED / … ride through
          // faithfully — never masked as VALIDATION_FAILED.
          this.sendDomainError(ws, error);
        }
        return;
      }
      case "message.edit": {
        const { messages } = this.services();
        try {
          const updated = await messages.edit(
            message.data.message_id,
            userId,
            message.data.body,
          );
          // Outbox carries message.edited for the room fan-out (§114).
          this.broadcastSystem("message.updated", {
            message_id: updated.id,
            edited_at: updated.edited_at,
            editor_user_id: userId,
          });
        } catch (error) {
          this.sendDomainError(ws, error);
        }
        return;
      }
      case "message.delete": {
        const { messages } = this.services();
        try {
          await messages.softDelete(message.data.message_id, userId);
          this.broadcastSystem("message.deleted", {
            message_id: message.data.message_id,
            deleted_by_user_id: userId,
          });
        } catch (error) {
          this.sendDomainError(ws, error);
        }
        return;
      }
      case "message.react": {
        const { reactions } = this.services();
        try {
          if (message.data.action === "add") {
            await reactions.add({
              message_id: message.data.message_id,
              user_id: userId,
              emoji: message.data.emoji,
            });
          } else {
            await reactions.remove(message.data.message_id, userId, message.data.emoji);
          }
          this.broadcastSystem("reaction.updated", {
            message_id: message.data.message_id,
            emoji: message.data.emoji,
            user_id: userId,
            action: message.data.action,
          });
        } catch (error) {
          this.sendDomainError(ws, error);
        }
        return;
      }
      case "sync.ack": {
        // §157: checkpoint acknowledgement — reply-only; no durable write
        // until offline sync persistence lands (documented in AUDIT_REPORT).
        this.sendTo(ws, {
          type: "sync.ack",
          ok: true,
          up_to_sequence: message.data.up_to_sequence,
        });
        return;
      }
      case "meeting.start": {
        const { meetings } = this.services();
        try {
          const session = await meetings.start({
            group_id: this.groupId,
            project_id: message.data.project_id ?? null,
            started_by: userId,
          });
          this.broadcastSystem("meeting.started", {
            meeting_session_id: session.id,
            project_id: session.project_id,
            started_by: userId,
          });
        } catch (error) {
          this.sendDomainError(ws, error);
        }
        return;
      }
      case "meeting.end": {
        const { meetings } = this.services();
        try {
          await meetings.end({
            meeting_session_id: message.data.meeting_session_id,
            summary_text: message.data.summary_text,
          });
          this.broadcastSystem("meeting.ended", {
            meeting_session_id: message.data.meeting_session_id,
            ended_by: userId,
          });
        } catch (error) {
          this.sendDomainError(ws, error);
        }
        return;
      }
      case "artifact.interaction": {
        // §97-style transient signal echoed to the room as artifact.event.
        this.broadcastSystem("artifact.event", {
          artifact_id: message.data.artifact_id,
          interaction: message.data.interaction,
          user_id: userId,
        });
        return;
      }
      case "ai.run":
      case "ai.cancel": {
        // REST is the spec-canonical AI path (§105/§106); streaming deltas
        // still reach this room through the realtime port. Documented choice
        // in docs/AUDIT_REPORT.md.
        this.sendTo(ws, {
          type: "error",
          code: "NOT_AVAILABLE_ON_WS",
          message:
            kind === "ai.run"
              ? "Start AI runs via POST /api/v1/groups/:groupId/ai/runs; stream deltas arrive here."
              : "Cancel AI runs via POST /api/v1/ai/runs/:runId/cancel.",
        });
        return;
      }
      default: {
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

  private sendError(ws: WebSocket, code: string, message: string): void {
    this.sendTo(ws, { type: "error", code, message });
  }

  /** Domain AppErrors keep their §102 code on the wire where one exists. */
  private sendDomainError(ws: WebSocket, error: unknown): void {
    this.sendTo(ws, wsErrorFrame(error));
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
