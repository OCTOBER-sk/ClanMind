/**
 * WebSocket connection manager — the ONLY socket site in the app (FE §9).
 *
 * Implements the BE §16/§20.2 lifecycle: authenticate → hello → room.subscribe
 * → ready, with heartbeat + watchdog, exponential backoff + jitter reconnects,
 * per-group sequence tracking with gap detection (BE §17.1), and protocol
 * version handling (BE §165 / FE §309A) — including a hard stop (no retry
 * loop) when the server answers CLIENT_UPDATE_REQUIRED.
 */

import {
  RealtimeEnvelopeSchema,
  ConnectionReadyPayloadSchema,
  ServerErrorPayloadSchema,
  clientEvents,
  CLIENT_PROTOCOL_VERSION,
  type ClientEventFrame,
  type ConnectionReadyPayload,
  type RealtimeEvent,
} from './events';

export type RealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline';

/** Minimal socket surface so the demo hub can impersonate a WebSocket. */
export interface RealtimeSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onclose: ((ev: { code?: number; reason?: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

export interface RealtimeClientOptions {
  /** Live WS endpoint; ignored when socketFactory is provided (demo). */
  url?: string;
  getToken: () => Promise<string | null>;
  socketFactory?: (url: string) => RealtimeSocketLike;
  heartbeatIntervalMs?: number;
  maxReconnectDelayMs?: number;
  onStatus: (status: RealtimeStatus) => void;
  onEvent: (event: RealtimeEvent) => void;
  onReady: (payload: ConnectionReadyPayload) => void;
  /** Server rejected us for version/protocol reasons — do NOT retry. */
  onProtocolRequired: (info: { code: string; message?: string }) => void;
  onSequenceGap: (groupId: string, from: number, to: number) => void;
}

const DEFAULT_HEARTBEAT_MS = 25_000;
const MAX_RECONNECT_DELAY_MS = 15_000;

export class RealtimeClient {
  private opts: RealtimeClientOptions;
  private ws: RealtimeSocketLike | null = null;
  private desiredGroups = new Set<string>();
  private subscribedGroups = new Set<string>();
  private lastSequenceByGroup = new Map<string, number>();
  private attempts = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastIncomingAt = 0;
  private userClosed = false;
  private statusValue: RealtimeStatus = 'idle';
  private statusListeners = new Set<(status: RealtimeStatus) => void>();
  private onlineHandler: () => void;
  private offlineHandler: () => void;
  private boundNetwork = false;
  /** Bound on window — TS Navigator type predates the online/offline events. */
  private networkTarget: Window | null = typeof window !== 'undefined' ? window : null;

  constructor(opts: RealtimeClientOptions) {
    this.opts = opts;
    this.onlineHandler = () => {
      if (!this.userClosed && this.statusValue !== 'connected') this.connectNow();
    };
    this.offlineHandler = () => {
      this.setStatus('offline');
      this.clearTimers();
    };
  }

  get status(): RealtimeStatus {
    return this.statusValue;
  }

  onStatusChange(listener: (status: RealtimeStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(next: RealtimeStatus): void {
    if (this.statusValue === next) return;
    this.statusValue = next;
    this.opts.onStatus(next);
    for (const listener of this.statusListeners) listener(next);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.heartbeatTimer = null;
    this.watchdogTimer = null;
    this.reconnectTimer = null;
  }

  /** Begin (or restart) the connection and subscribe to the given groups. */
  connect(groupIds: string[]): void {
    groupIds.forEach((g) => this.desiredGroups.add(g));
    if (!this.boundNetwork && this.networkTarget) {
      this.networkTarget.addEventListener('online', this.onlineHandler);
      this.networkTarget.addEventListener('offline', this.offlineHandler);
      this.boundNetwork = true;
      if (navigator.onLine === false) {
        this.setStatus('offline');
        return;
      }
    }
    this.connectNow();
  }

  setGroups(groupIds: string[]): void {
    const next = new Set(groupIds);
    // Leave removed groups implicitly; server drops silent subscriptions.
    this.desiredGroups = next;
    if (this.ws && this.statusValue === 'connected') {
      for (const g of next) {
        if (!this.subscribedGroups.has(g)) {
          this.send(clientEvents.roomSubscribe(g));
          this.subscribedGroups.add(g);
        }
      }
    }
  }

  disconnect(): void {
    this.userClosed = true;
    this.clearTimers();
    this.detachNetwork();
    this.ws?.close(1000, 'client disconnect');
    this.ws = null;
    this.setStatus('idle');
  }

  private detachNetwork(): void {
    if (!this.boundNetwork || !this.networkTarget) return;
    this.networkTarget.removeEventListener('online', this.onlineHandler);
    this.networkTarget.removeEventListener('offline', this.offlineHandler);
    this.boundNetwork = false;
  }

  /**
   * App-level send — allowed only on a fully established connection.
   * Feature code (typing, presence, message.send from P3+) goes through here.
   */
  send(frameData: ClientEventFrame): boolean {
    if (!this.ws || this.statusValue !== 'connected') return false;
    return this.sendRaw(frameData);
  }

  /**
   * Protocol-level send for the handshake/control plane itself (hello,
   * ping, post-ready room.subscribe). These MUST be legal before
   * `connection.ready` flips status to connected — gating them on
   * 'connected' deadlocks the handshake (hello dropped → no ready →
   * forever 'connecting'), which is exactly the smoke-T4 WS stall.
   * `ping` is not a §114 command — hibernating rooms answer it at the
   * transport layer without waking the DO.
   */
  private sendRaw(frameData: ClientEventFrame | { type: 'ping'; request_id: string }): boolean {
    if (!this.ws) return false;
    try {
      this.ws.send(JSON.stringify(frameData));
      return true;
    } catch {
      return false;
    }
  }

  private async connectNow(): Promise<void> {
    if (this.userClosed) return;
    this.clearTimers();
    this.subscribedGroups.clear();
    this.setStatus(this.attempts === 0 ? 'connecting' : 'reconnecting');

    let url = this.opts.url ?? '';
    if (this.opts.socketFactory && !url) url = 'demo://realtime';
    if (!url) {
      this.scheduleReconnect();
      return;
    }

    let socket: RealtimeSocketLike;
    try {
      if (this.opts.socketFactory) {
        socket = this.opts.socketFactory(url);
      } else {
        const token = await this.opts.getToken();
        const target = new URL(url);
        if (token) target.searchParams.set('token', token);
        socket = new WebSocket(target.toString()) as unknown as RealtimeSocketLike;
      }
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws = socket;
    socket.onopen = () => {
      this.attempts = 0;
      this.lastIncomingAt = Date.now();
      // Reconnects announce their last applied §17 sequence so the room can
      // hydrate its ring allocator past already-seen events (§20.2 resume).
      const lastSeq = [...this.desiredGroups]
        .map((g) => this.lastSequenceByGroup.get(g))
        .filter((n): n is number => typeof n === 'number');
      this.sendRaw(
        clientEvents.hello(lastSeq.length > 0 ? { lastServerSequence: Math.max(...lastSeq) } : undefined),
      );
      this.startHeartbeat();
    };

    socket.onmessage = (ev) => this.handleFrame(ev.data);
    socket.onerror = () => {
      /* close handler drives recovery */
    };
    socket.onclose = () => {
      this.stopHeartbeat();
      this.ws = null;
      if (this.userClosed) return;
      if (this.statusValue !== 'offline') this.setStatus('reconnecting');
      this.scheduleReconnect();
    };
  }

  private handleFrame(raw: unknown): void {
    this.lastIncomingAt = Date.now();
    if (typeof raw !== 'string') return;

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return; // non-JSON frame — ignore, never crash the stream
    }

    // ── Control plane + transport framing ──────────────────────────────────
    // The real GroupRoom (apps/worker/src/realtime/group-room.ts) speaks:
    //   • broadcast events   → { type: "event", envelope: {…§17…} }
    //   • handshake replies  → { type: "connection.ready", …top-level fields }
    //   • error replies      → { type: "error", code, message }
    // The demo hub speaks bare envelopes + enveloped ready/error. A
    // conforming client must accept BOTH framings for every frame kind so
    // neither server can ever strand it pre-ready or blind to errors.
    if (
      parsedJson &&
      typeof parsedJson === 'object' &&
      'type' in (parsedJson as Record<string, unknown>)
    ) {
      const ctrl = parsedJson as Record<string, unknown>;
      const kind = ctrl.type;

      if (kind === 'pong') return;

      // Real-room fan-out wrapper — unwrap and continue as an envelope.
      if (kind === 'event' && ctrl.envelope !== undefined) {
        this.handleEnvelope(ctrl.envelope);
        return;
      }

      if (kind === 'connection.ready') {
        // Version metadata rides top-level on real control frames (plus a
        // presence snapshot after room.subscribe); the demo hub nests
        // everything under `payload`. Accept either location.
        const nested = typeof ctrl.payload === 'object' && ctrl.payload !== null ? (ctrl.payload as Record<string, unknown>) : {};
        const merged = {
          ...nested,
          protocol_version: ctrl.protocol_version ?? nested.protocol_version,
          minimum_client_version: ctrl.minimum_client_version ?? nested.minimum_client_version,
          recommended_client_version:
            ctrl.recommended_client_version ?? nested.recommended_client_version,
          sequence: ctrl.sequence ?? nested.sequence,
          ...(ctrl.presence !== undefined || nested.presence !== undefined
            ? { presence: ctrl.presence ?? nested.presence }
            : {}),
        };
        this.completeHandshake(ConnectionReadyPayloadSchema.catch({}).parse(merged));
        return;
      }

      if (kind === 'error') {
        const errPayload = ServerErrorPayloadSchema.catch({}).parse({
          code: ctrl.code,
          message: ctrl.message,
        });
        if (errPayload.code === 'CLIENT_UPDATE_REQUIRED') {
          this.protocolStop(errPayload.code ?? 'CLIENT_UPDATE_REQUIRED', errPayload.message);
          return;
        }
        // Other control-plane errors are terminal for the request that caused
        // them but not for the socket. Nothing here may fabricate envelope
        // fields, so they stay out of the event stream.
        return;
      }

      // Data-bearing control replies from the real room (§157 / §105):
      //   • sync.events   → { type, from_sequence, events: [envelope…] }
      //   • message.created (sender confirmation) → { type, source:"self", message }
      // Each carries genuine §17 envelopes / §39 rows — route them into the
      // event stream instead of dropping them on the floor.
      if (kind === 'sync.events' && Array.isArray(ctrl.events)) {
        for (const inner of ctrl.events) this.handleEnvelope(inner);
        return;
      }

      if (kind === 'message.created' && ctrl.message && typeof ctrl.message === 'object') {
        const m = ctrl.message as { id?: unknown; server_sequence?: unknown };
        if (typeof m.id === 'string' && m.id.length > 0) {
          const selfEvent = {
            protocol_version: CLIENT_PROTOCOL_VERSION,
            event_id: `evt_self_${m.id}`,
            event_type: 'message.created',
            sequence: typeof m.server_sequence === 'number' ? m.server_sequence : 0,
            group_id: [...this.desiredGroups][0] ?? '',
            actor_id: null,
            visibility: 'GROUP',
            occurred_at: new Date().toISOString(),
            payload: { source: 'self', message: ctrl.message },
            request_id: typeof ctrl.request_id === 'string' ? ctrl.request_id : null,
          };
          this.trackSequence(selfEvent as RealtimeEvent);
          this.opts.onEvent(selfEvent as RealtimeEvent);
        }
        return;
      }

      // Remaining plain frames ({ type: "sync.ack", ok, … }) are pure acks.
      return;
    }

    this.handleEnvelope(parsedJson);
  }

  /** Validate + route a §17 envelope (bare or unwrapped). */
  private handleEnvelope(candidate: unknown): void {
    const env = RealtimeEnvelopeSchema.safeParse(candidate);
    if (!env.success) return;
    const event = env.data as RealtimeEvent;

    // BE §17/§114 — servers may deliver `connection.ready` as a normal
    // enveloped event (the demo hub does). Accept either framing so a
    // conforming server can never leave us stuck pre-ready.
    if (event.event_type === 'connection.ready') {
      this.completeHandshake(ConnectionReadyPayloadSchema.catch({}).parse(event.payload ?? {}));
      return;
    }

    if (event.event_type === 'error') {
      const errPayload = ServerErrorPayloadSchema.catch({}).parse(event.payload ?? {});
      if (errPayload.code === 'CLIENT_UPDATE_REQUIRED') {
        this.protocolStop(errPayload.code ?? 'CLIENT_UPDATE_REQUIRED', errPayload.message);
        return;
      }
    }

    this.trackSequence(event);
    this.opts.onEvent(event);
  }

  /**
   * FE §309A.2 — blocking state; stop retrying against an incompatible
   * protocol. Status MUST land on a terminal value here: leaving it as
   * 'connecting' made the connectivity layer report "Reconnecting…"
   * forever while nothing was actually retrying.
   */
  private protocolStop(code: string, message?: string): void {
    this.userClosed = true;
    this.clearTimers();
    this.setStatus('idle');
    this.ws?.close(1000, 'protocol mismatch');
    this.ws = null;
    this.opts.onProtocolRequired({ code, message });
  }

  /** Shared ready transition for both ready framings (plain + enveloped). */
  private completeHandshake(ready: ConnectionReadyPayload): void {
    this.setStatus('connected');
    for (const g of this.desiredGroups) {
      if (!this.subscribedGroups.has(g)) {
        this.sendRaw(clientEvents.roomSubscribe(g));
        this.subscribedGroups.add(g);
      }
    }
    this.opts.onReady(ready);
  }

  /** BE §17.1 — detect missing sequence numbers and request a backfill. */
  private trackSequence(event: RealtimeEvent): void {
    if (typeof event.sequence !== 'number' || !event.group_id) return;
    const last = this.lastSequenceByGroup.get(event.group_id);
    if (last !== undefined && event.sequence > last + 1) {
      this.opts.onSequenceGap(event.group_id, last + 1, event.sequence - 1);
    }
    if (last === undefined || event.sequence > last) {
      this.lastSequenceByGroup.set(event.group_id, event.sequence);
    }
  }

  getLastSequence(groupId: string): number | undefined {
    return this.lastSequenceByGroup.get(groupId);
  }

  private startHeartbeat(): void {
    const interval = this.opts.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_MS;
    this.heartbeatTimer = setInterval(() => {
      this.sendRaw({ type: 'ping', request_id: `req_${crypto.randomUUID()}` });
      if (Date.now() - this.lastIncomingAt > interval * 2.5 + 5_000) {
        // Watchdog: connection is silently dead — force a reconnect cycle.
        this.ws?.close(4000, 'heartbeat timeout');
      }
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private scheduleReconnect(): void {
    if (this.userClosed || this.reconnectTimer) return;
    const delay = Math.min(
      MAX_RECONNECT_DELAY_MS,
      300 * 2 ** this.attempts,
    ) * (0.7 + Math.random() * 0.6); // jitter
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectNow();
    }, delay);
  }
}

let instance: RealtimeClient | null = null;

export function initRealtime(opts: RealtimeClientOptions): RealtimeClient {
  instance = new RealtimeClient(opts);
  return instance;
}

export function getRealtime(): RealtimeClient {
  if (!instance) throw new Error('[realtime] not initialised — call initRealtime() at boot');
  return instance;
}
