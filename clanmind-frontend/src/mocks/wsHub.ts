/**
 * Demo realtime hub — a deterministic in-process stand-in for the backend
 * Durable-Object room (BE §15/§114). It speaks the exact envelope protocol,
 * assigns monotonic per-group sequences, performs the hello → ready handshake
 * including version metadata (BE §165), and drives the full §134A AI-run
 * timeline as broadcast events — which flow through the same RealtimeClient
 * pipeline production uses.
 */

import type { RealtimeSocketLike } from '@/realtime/connection';
import { env } from '@/config/env';

interface HubConnection {
  id: string;
  socket: RealtimeSocketLike;
  groups: Set<string>;
  open: boolean;
}

export interface AiRunRequestMeta {
  runId: string;
  messageId: string;
  groupId: string;
  projectId?: string | null;
  prompt: string;
  aiName: string;
}

const RESPONSE_TEMPLATE = (prompt: string) =>
  `I researched **${prompt.slice(0, 80)}** across current sources and your project references.\n\n### Findings\n- SPI with DMA reduces packet latency from **160 µs to 6.5 µs** at 1 kHz.\n- I2C bus arbitration locked the attitude thread for ~150 µs per cycle.\n- DMA circular buffers in SRAM1 eliminate double-copy overhead.\n\n### Recommendation\nAdopt SPI DMA double-buffering. I generated the system blueprint in your work surface.`;

const DIAGRAM_MARKDOWN = `graph TD
  IMU[ICM-42688P IMU Sensor] -->|SPI 24MHz| DMA[STM32 DMA1 Stream 0]
  DMA -->|Circular Buffer| SRAM[SRAM1 Ring Buffer]
  SRAM -->|1 kHz IRQ| PID[Attitude PID Controller]
  PID -->|PWM Signals| ESC[Electronic Speed Controllers]`;

const SOURCES = [
  {
    id: 'src_1',
    title: 'ICM-42688P Motion Tracking Datasheet',
    domain: 'invensense.tdk.com',
    url: 'https://invensense.tdk.com',
    snippet: 'High performance 6-axis MEMS IMU with 24 MHz SPI master interface.',
    retrieved_at: new Date().toISOString(),
  },
  {
    id: 'src_2',
    title: 'STM32H7 DMA Architecture Reference',
    domain: 'st.com',
    url: 'https://st.com',
    snippet: 'Master Direct Memory Access (MDMA) and peripheral DMA streams configuration.',
    retrieved_at: new Date().toISOString(),
  },
  {
    id: 'src_3',
    title: 'I2C vs SPI Latency Benchmarks',
    domain: 'embench.io',
    url: 'https://embench.io',
    snippet: 'Measured bus acquisition latency for multi-master I2C at 400 kHz.',
    retrieved_at: new Date().toISOString(),
  },
];

interface ActiveRun {
  timers: TimerHandle[];
  cancelled: boolean;
  meta: AiRunRequestMeta;
}

type TimerHandle = ReturnType<typeof setTimeout>;

/**
 * BE §165 — numeric semver comparison. A lexicographic string compare is
 * wrong here ('0.10.0' < '0.9.0' lexically) and would let the demo hub
 * reject compatible clients (or worse, accept incompatible ones).
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

export class DemoRealtimeHub {
  private clients = new Map<string, HubConnection>();
  private clientCounter = 0;
  private sequenceByGroup = new Map<string, number>();
  /**
   * §17.1/§20.2 — per-group ring of recently delivered envelopes so
   * `sync.request` recovery replays EXACTLY what was missed (mirrors the
   * real GroupRoom's Durable-Object ring storage).
   */
  private envelopeRingByGroup = new Map<string, Array<Record<string, unknown>>>();
  private static RING_CAPACITY = 200;
  /** BE §165 version metadata served during handshake. */
  versionMeta = {
    // The oldest client build this demo "server" accepts. Must be a version
    // the shipped client satisfies — a demo hub advertising an impossible
    // floor would CLIENT_UPDATE_REQUIRED-stop every session at hello
    // (this exact bug stalled the WS on "Reconnecting…" in smoke T4).
    minimum_client_version: '0.0.0',
    recommended_client_version: env.appVersion,
    protocol_version: 1,
  };
  private activeRuns = new Map<string, ActiveRun>();
  /**
   * §139 — artifact lineage per group+prompt: a regenerated run emits the
   * NEXT VERSION of the same artifact instead of minting a new one.
   */
  private artifactLineage = new Map<string, { artifactId: string; nextVersion: number }>();

  createSocket(_url: string): RealtimeSocketLike {
    const connectionId = `hubconn_${++this.clientCounter}`;

    const conn: HubConnection = {
      id: connectionId,
      groups: new Set(),
      open: true,
      socket: {
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
        send: (data: string) => {
          // Client → server frames land here (arrow keeps `this` = hub).
          this.handleClientFrame(conn, data);
        },
        close: (code?: number) => {
          conn.open = false;
          this.clients.delete(connectionId);
          conn.socket.onclose?.({ code: code ?? 1000, reason: 'demo close' });
        },
      },
    };

    // Simulate async socket establishment so connect/backoff paths are real.
    setTimeout(() => {
      if (!conn.open) return;
      this.clients.set(connectionId, conn);
      conn.socket.onopen?.();
    }, 60 + Math.random() * 90);

    return conn.socket;
  }

  private handleClientFrame(conn: HubConnection, raw: string): void {
    let frameData: Record<string, unknown>;
    try {
      frameData = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    const type = frameData.type as string | undefined;
    if (!type) return;

    switch (type) {
      case 'connection.hello': {
        const requestedProtocol = Number(frameData.protocol_version ?? 1);
        if (!Number.isFinite(requestedProtocol)) return;
        if (
          typeof this.versionMeta.minimum_client_version === 'string' &&
          compareSemver(env.appVersion, this.versionMeta.minimum_client_version) < 0
        ) {
          this.deliver(conn, {
            event_type: 'error',
            payload: { code: 'CLIENT_UPDATE_REQUIRED', message: 'Update required' },
          });
          return;
        }
        this.deliver(conn, {
          event_type: 'connection.ready',
          payload: { ...this.versionMeta, protocol_version: Math.min(requestedProtocol, this.versionMeta.protocol_version) },
        });
        break;
      }
      case 'room.subscribe': {
        const groupId = String(frameData.group_id ?? '');
        if (groupId && conn.open) {
          conn.groups.add(groupId);
          this.broadcast('presence.updated', groupId, {
            state: 'ONLINE',
            viewers_online: 1 + (this.clients.size - 1),
          });
        }
        break;
      }
      case 'ping':
        this.deliverRaw(conn, JSON.stringify({ type: 'pong' }));
        break;
      case 'sync.request': {
        // §17.1 recovery — the real room answers with a PLAIN control frame
        // `{type:"sync.events", from_sequence, events[]}` (Q3 in
        // INTEGRATION_NOTES); envelopes are ordered ascending and only those
        // with sequence ≥ from_sequence replay.
        const groupId = String(frameData.group_id ?? '');
        const from = Number(frameData.from_sequence ?? 0);
        if (!groupId || !Number.isFinite(from)) break;
        const ring = this.envelopeRingByGroup.get(groupId) ?? [];
        const events = ring.filter((e) => typeof e.sequence === 'number' && (e.sequence as number) >= from);
        this.deliverRaw(conn, JSON.stringify({ type: 'sync.events', from_sequence: from, events }));
        break;
      }
      default:
        break;
    }
  }

  private deliver(conn: HubConnection, partial: { event_type: string; group_id?: string; payload?: unknown; sequence?: number }): void {
    const groupId = partial.group_id ?? [...conn.groups][0] ?? '';
    const sequence = partial.sequence ?? this.nextSequence(groupId);
    const envelope = {
      protocol_version: this.versionMeta.protocol_version,
      event_id: `evt_${sequence}_${Math.random().toString(36).slice(2, 8)}`,
      event_type: partial.event_type,
      sequence,
      group_id: groupId,
      actor_id: 'srv_demo',
      visibility: 'GROUP',
      occurred_at: new Date().toISOString(),
      payload: partial.payload ?? {},
    };
    if (partial.sequence === undefined) this.recordEnvelope(groupId, envelope);
    this.deliverRaw(conn, JSON.stringify(envelope));
  }

  /** Append to the §17.1 recovery ring, dropping the oldest when full. */
  private recordEnvelope(groupId: string, envelope: Record<string, unknown>): void {
    const ring = this.envelopeRingByGroup.get(groupId) ?? [];
    ring.push(envelope);
    while (ring.length > DemoRealtimeHub.RING_CAPACITY) ring.shift();
    this.envelopeRingByGroup.set(groupId, ring);
  }

  private deliverRaw(conn: HubConnection, text: string): void {
    if (!conn.open) return;
    conn.socket.onmessage?.({ data: text });
  }

  private nextSequence(groupId: string): number {
    const next = (this.sequenceByGroup.get(groupId) ?? 1420) + 1;
    this.sequenceByGroup.set(groupId, next);
    return next;
  }

  getSequenceBase(groupId: string): number {
    return this.sequenceByGroup.get(groupId) ?? 1420;
  }

  /** Broadcast an envelope event to every connected demo client. */
  broadcast(eventType: string, groupId: string, payload: unknown): void {
    for (const conn of this.clients.values()) {
      if (conn.groups.size > 0 && !conn.groups.has(groupId)) continue;
      this.deliver(conn, { event_type: eventType, group_id: groupId, payload });
    }
  }

  /**
   * Test seam — deliver an event with a FORCED §17 sequence and WITHOUT
   * recording it in the recovery ring, simulating exactly what a dropped
   * frame looks like on the wire (the gap the client must detect).
   */
  emitWithSequence(eventType: string, groupId: string, payload: unknown, sequence: number): void {
    for (const conn of this.clients.values()) {
      if (conn.groups.size > 0 && !conn.groups.has(groupId)) continue;
      this.deliver(conn, { event_type: eventType, group_id: groupId, payload, sequence });
    }
  }

  /** Echo a persisted message to all room members (BE §105: server persists first). */
  messageCreated(message: { id: string; group_id: string; [k: string]: unknown }): void {
    this.broadcast('message.created', message.group_id, { message });
  }

  reactionUpdated(groupId: string, payload: { message_id: string; emoji: string; count: number; user_ids: string[] }): void {
    this.broadcast('reaction.updated', groupId, payload);
  }

  typingUpdated(groupId: string, payload: { user_id: string; user_name: string; typing: boolean }): void {
    this.broadcast('typing.updated', groupId, payload);
  }

  approvalRequested(groupId: string, payload: { action_id: string; action_kind: string; risk_level: string }): void {
    this.broadcast('approval.requested', groupId, payload);
  }

  // ─── §134A AI run lifecycle as REAL events through the socket ─────────────

  /**
   * Deterministic seams (used by tests and the demo walkthrough):
   *   • prompt matching /fail/      → run FAILS with PROVIDER_TIMEOUT (§140)
   *   • prompt matching /fallback/  → completes via the fallback model (§142)
   * Regenerated prompts reuse the artifact lineage for the same
   * group+prompt, so a second run emits a NEW VERSION of the same artifact
   * rather than a new artifact (§139).
   */
  startAiRun(meta: AiRunRequestMeta): () => void {
    const runId = meta.runId;
    const timers: TimerHandle[] = [];
    const run: ActiveRun = { timers, cancelled: false, meta };
    this.activeRuns.set(runId, run);

    const emit = (eventType: string, eventPayload: Record<string, unknown>, delayMs: number) => {
      const t: TimerHandle = setTimeout(() => {
        if (!run.cancelled) this.broadcast(eventType, meta.groupId, { run_id: runId, message_id: meta.messageId, ...eventPayload });
      }, delayMs);
      timers.push(t);
    };

    // §142 seam — this run is "served" by the fallback model.
    const isFallbackRun = /fallback/i.test(meta.prompt);

    // QUEUED shell already exists; RUNNING first.
    emit('ai.status', { status: 'RUNNING' }, 200);

    // WAITING_TOOL — tool loop (recurring per FE §134A).
    const toolAt = (name: string, status: string, delayMs: number) =>
      emit('ai.tool', { call: { id: `tool_${runId}_${name}`, tool_name: name, status } }, delayMs);

    toolAt('web_search', 'EXECUTING', 600);
    emit('ai.status', { status: 'WAITING_TOOL' }, 610);
    toolAt('web_search', 'SUCCEEDED', 1400);
    toolAt('read_project_references', 'EXECUTING', 1410);
    emit('ai.status', { status: 'WAITING_TOOL', sources: SOURCES }, 1500);
    toolAt('read_project_references', 'SUCCEEDED', 1990);

    // §140 seam — provider failure after tools; nothing has streamed yet,
    // mirroring the real orchestrator's no-silent-fallback-after-stream rule.
    if (/fail/i.test(meta.prompt)) {
      emit(
        'ai.failed',
        {
          failure_code: 'PROVIDER_TIMEOUT',
          error_message: 'The primary model did not respond within the timeout window.',
        },
        2300,
      );
      return () => this.cancelAiRun(runId);
    }

    // STREAMING with batched deltas (FE §135 cadence).
    emit('ai.status', { status: 'STREAMING' }, 2000);
    const full = RESPONSE_TEMPLATE(meta.prompt);
    const parts = full.match(/.{1,140}/gs) ?? [full];
    parts.forEach((part, i) => {
      emit('ai.delta', { delta: part }, 2350 + i * 260);
    });

    // Live artifact construction event stream (BE §75 / FE §97). Repeated
    // runs of the same prompt extend the SAME artifact lineage — the second
    // response's diagram arrives as version N+1 (§139), never an overwrite.
    const lineageKey = `${meta.groupId}:${meta.prompt.trim().toLowerCase()}`;
    const prior = this.artifactLineage.get(lineageKey);
    const artifactId = prior?.artifactId ?? `art_live_${runId}`;
    const versionNumber = prior?.nextVersion ?? 1;
    this.artifactLineage.set(lineageKey, { artifactId, nextVersion: versionNumber + 1 });

    emit(
      'artifact.event',
      {
        kind: 'created',
        artifact: {
          id: artifactId,
          group_id: meta.groupId,
          project_id: meta.projectId ?? null,
          title: `${meta.aiName}'s blueprint — ${meta.prompt.slice(0, 28)}`,
          artifact_type: 'ARCHITECTURE',
          current_version: versionNumber,
          pinned: false,
          used_as_context: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          versions: [
            {
              id: `v_${artifactId}_${versionNumber}`,
              artifact_id: artifactId,
              version_number: versionNumber,
              content: DIAGRAM_MARKDOWN,
              created_by_name: meta.aiName,
              created_at: new Date().toISOString(),
            },
          ],
        },
      },
      2400,
    );

    const lastDelta = 2350 + (parts.length - 1) * 260;
    emit(
      'ai.completed',
      {
        final_body: full,
        sources: SOURCES,
        created_artifacts: [artifactId],
        // §142 — AI response metadata drives the subtle fallback indicator.
        ...(isFallbackRun ? { model_used: 'secondary-fallback', is_fallback: true } : {}),
      },
      lastDelta + 500,
    );

    return () => this.cancelAiRun(runId);
  }

  cancelAiRun(runId: string): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;
    run.cancelled = true;
    run.timers.forEach(clearTimeout);
    this.activeRuns.delete(runId);
    this.broadcast('ai.status', run.meta.groupId, {
      run_id: runId,
      message_id: run.meta.messageId,
      status: 'CANCELLED',
    });
  }
}

let hubInstance: DemoRealtimeHub | null = null;

export function getDemoHub(): DemoRealtimeHub {
  if (!hubInstance) hubInstance = new DemoRealtimeHub();
  return hubInstance;
}
