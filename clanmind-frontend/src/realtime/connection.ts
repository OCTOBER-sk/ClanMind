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

  send(frameData: ClientEventFrame): boolean {
    if (!this.ws || this.statusValue !== 'connected') return false;
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
      this.send(clientEvents.hello());
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

    // Control-plane replies (pong / acks) are plain objects, not envelopes.
    if (
      parsedJson &&
      typeof parsedJson === 'object' &&
      'type' in (parsedJson as Record<string, unknown>)
    ) {
      const ctrl = parsedJson as { type: string; payload?: unknown };
      if (ctrl.type === 'pong') return;
      if (ctrl.type === 'connection.ready') {
        const ready = ConnectionReadyPayloadSchema.catch({}).parse(ctrl.payload ?? {});
        this.setStatus('connected');
        for (const g of this.desiredGroups) {
          this.send(clientEvents.roomSubscribe(g));
          this.subscribedGroups.add(g);
        }
        this.opts.onReady(ready);
        return;
      }
      return;
    }

    const env = RealtimeEnvelopeSchema.safeParse(parsedJson);
    if (!env.success) return;
    const event = env.data as RealtimeEvent;

    if (event.event_type === 'error') {
      const errPayload = ServerErrorPayloadSchema.catch({}).parse(event.payload ?? {});
      if (errPayload.code === 'CLIENT_UPDATE_REQUIRED') {
        // FE §309A.2 — blocking state; stop retrying against an incompatible protocol.
        this.userClosed = true;
        this.clearTimers();
        this.ws?.close(1000, 'protocol mismatch');
        this.ws = null;
        this.opts.onProtocolRequired({
          code: errPayload.code ?? 'CLIENT_UPDATE_REQUIRED',
          message: errPayload.message,
        });
        return;
      }
    }

    this.trackSequence(event);
    this.opts.onEvent(event);
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
      this.send({ type: 'ping', request_id: `req_${crypto.randomUUID()}` });
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
