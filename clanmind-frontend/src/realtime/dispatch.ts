/**
 * Shared realtime dispatch — projects validated §17 envelope events into the
 * client stores. Used by BOTH demo and live mode (D2): demo feeds it from the
 * wsHub, production from the real GroupRoom socket. Event handlers accept
 * both vocabularies the two servers actually speak:
 *
 *  • BE §114 protocol names (demo hub, room control paths):
 *      message.created, reaction.updated, typing.updated, ai.status,
 *      ai.tool, ai.delta, ai.completed, ai.failed, artifact.event
 *  • BE §18 taxonomy names (real outbox→room fan-out):
 *      presence.updated / presence.online / presence.offline,
 *      presence.typing.started|stopped, ai.run.started,
 *      ai.response.delta, ai.response.completed, ai.response.failed
 *
 * Unknown event types are ignored until their phase lands (FE §200 pattern).
 *
 * P5 streaming contract (FE §134/§135/§203): ai.delta frames are coalesced
 * into a dedicated stream store at a render-friendly cadence — the chat store
 * receives each AI response body exactly once per terminal event, and only
 * the active AI bubble re-renders during a stream.
 */

import { useChatStore } from '@/state/useChatStore';
import { useArtifactStore } from '@/state/useArtifactStore';
import { useAuthStore } from '@/state/useAuthStore';
import { useGroupStore } from '@/state/useGroupStore';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import { useSyncStore } from '@/state/useSyncStore';
import { SyncConflictSchema } from '@/api/endpoints/sync';
import { useAiStreamStore } from '@/features/ai/aiStreamStore';
import {
  useConstructionStore,
} from '@/features/artifacts/constructionStore';
import { MessageSchema, TaskSchema, DecisionSchema, MemoryEntrySchema, NotificationSchema } from '@/api/schemas';
import { mapMessageRow } from '@/api/messageRow';
import { mapTaskRow } from '@/api/endpoints/tasks';
import { mapDecisionRow } from '@/api/endpoints/decisions';
import { mapMemoryRow } from '@/api/endpoints/memory';
import { mapNotificationRow } from '@/api/endpoints/notifications';
import { fetchMeeting } from '@/api/endpoints/meetings';
import { useMeetingStore } from '@/state/useMeetingStore';
import { deliverOsNotification } from '@/features/notifications/osNotify';
import type { AiRun, Artifact, DiagramContent, Message } from '@/types';
import type { RealtimeEvent } from '@/realtime/events';

const runsByMessage = new Map<string, { run: AiRun; streamedBody: string; artifactOpened: boolean }>();
/**
 * Live runs are started via REST (§106); streaming events key on `run_id`.
 * The start call registers runId → shell messageId here so deltas route to
 * the right bubble even when they arrive before the HTTP response resolves.
 */
const messageByRun = new Map<string, string>();

function baseRun(): AiRun {
  return {
    id: 'run_pending',
    group_id: '',
    status: 'QUEUED',
    mode: 'ASSIST',
    prompt: '',
    tool_calls: [],
    sources: [],
    created_artifacts: [],
    created_at: new Date().toISOString(),
  };
}

/** Create this message's run entry if no event has established it yet. */
interface RunEntry {
  run: AiRun;
  streamedBody: string;
  artifactOpened: boolean;
}
function ensureRunEntry(messageId: string): RunEntry {
  let entry = runsByMessage.get(messageId);
  if (!entry) {
    entry = { run: baseRun(), streamedBody: '', artifactOpened: false };
    runsByMessage.set(messageId, entry);
  }
  return entry;
}

export function bindRunToMessage(runId: string, messageId: string): void {
  messageByRun.set(runId, messageId);
  // Replay any deltas that arrived before the REST start response bound this
  // run — the buffered prefix must render, not wait for completion.
  const orphan = orphanStreams.get(runId);
  if (orphan) {
    orphanStreams.delete(runId);
    for (const delta of orphan.deltas) streamDelta(runId, messageId, delta);
  }
}

function resolveMessageId(payload: Record<string, unknown>): string {
  const direct = payload.message_id ?? payload.messageId;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  const runId = typeof payload.run_id === 'string' ? payload.run_id : undefined;
  return (runId && messageByRun.get(runId)) || '';
}

function upsertRun(messageId: string, patch: Partial<AiRun>): void {
  const store = useArtifactStore.getState();
  ensureRunEntry(messageId);
  const current = runsByMessage.get(messageId)!;
  const next = { ...current.run, ...patch };
  runsByMessage.set(messageId, {
    run: next,
    streamedBody: current.streamedBody,
    artifactOpened: current.artifactOpened,
  });
  store.setAiRunByMessage(messageId, next);
}

// ─── §135/§203 batched delta pipeline ────────────────────────────────────────
// Deltas NEVER touch the chat store or artifact store per token. They
// accumulate in `pendingStreamText` and are committed to the dedicated stream
// store at STREAM_FLUSH_MS cadence; only the active AI bubble subscribes to
// that store. The chat store receives the body exactly once per terminal
// event (§135 "batch deltas at a render-friendly cadence").
const STREAM_FLUSH_MS = 90;
const pendingStreamText = new Map<string, string>();
let streamFlushTimer: ReturnType<typeof setTimeout> | null = null;

function flushStreamDeltas(): void {
  streamFlushTimer = null;
  if (pendingStreamText.size === 0) return;
  const stream = useAiStreamStore.getState();
  for (const messageId of [...pendingStreamText.keys()]) {
    pendingStreamText.delete(messageId);
    const entry = runsByMessage.get(messageId);
    if (!entry) continue;
    if (entry.run.status !== 'STREAMING') {
      // One status transition per flush at most — never one per delta.
      upsertRun(messageId, { status: 'STREAMING' });
    }
    stream.setBody(messageId, entry.streamedBody);
  }
}

function scheduleStreamFlush(): void {
  if (streamFlushTimer == null) {
    streamFlushTimer = setTimeout(flushStreamDeltas, STREAM_FLUSH_MS);
  }
}

/** Buffer for deltas that arrive before their run is bound to a bubble. */
interface OrphanStream {
  deltas: string[];
}
const orphanStreams = new Map<string, OrphanStream>();

/**
 * Route a streaming delta (ai.delta / ai.response.delta) by run_id.
 * Unbound runs buffer their stream; bindRunToMessage replays it.
 */
function streamDelta(runId: string, fallbackMessageId: string, delta: string): void {
  if (!delta || (!runId && !fallbackMessageId)) return;
  let messageId = runId ? messageByRun.get(runId) : undefined;
  if (!messageId) {
    if (fallbackMessageId) {
      messageId = fallbackMessageId;
    } else {
      const orphan = orphanStreams.get(runId) ?? { deltas: [] };
      orphan.deltas.push(delta);
      orphanStreams.set(runId, orphan);
      return;
    }
  }
  const entry = ensureRunEntry(messageId);
  entry.streamedBody += delta;
  if (runId && entry.run.id === 'run_pending') entry.run.id = runId;
  pendingStreamText.set(messageId, entry.streamedBody);
  scheduleStreamFlush();
}

/**
 * Terminal transition — commit the streamed body into the chat store ONCE
 * (§135), clear the live-stream entries. `finalBody` (server truth) wins
 * over the buffered partial when present. The shared flush timer is left
 * alone: it simply finds nothing queued for this message and keeps serving
 * any other concurrent run.
 */
function finalizeStreamedMessage(messageId: string, finalBody: string | null): void {
  pendingStreamText.delete(messageId);
  // Last run out releases the shared timer — keeps the pipeline clean when
  // streams end between flush ticks (and across test timer installs).
  if (pendingStreamText.size === 0 && streamFlushTimer != null) {
    clearTimeout(streamFlushTimer);
    streamFlushTimer = null;
  }
  const entry = runsByMessage.get(messageId);
  const body = finalBody ?? entry?.streamedBody ?? '';
  useAiStreamStore.getState().clearBody(messageId);
  if (body) useChatStore.getState().updateMessage(messageId, { body });
}

/** Drop this message's buffered-but-unbound deltas (terminal cleanup). */
function dropOrphansFor(runId: string): void {
  orphanStreams.delete(runId);
}

/**
 * §137 — optimistic local cancel. Applies the terminal state immediately so
 * Stop never waits on the network: partial content is preserved in the chat
 * store, the run is marked CANCELLED (§134A), buffers are cleared. The
 * server's own ai.status CANCELLED frame re-enters through dispatch and is
 * idempotent with this.
 */
export function cancelRunLocally(messageId: string): void {
  const entry = runsByMessage.get(messageId);
  finalizeStreamedMessage(messageId, null);
  // Reflect CANCELLED on the STORE run — the authoritative rendered copy —
  // even when no socket event ever established a dispatch-side entry.
  const storeRun = useArtifactStore.getState().aiRunsByMessage[messageId];
  if (storeRun) {
    useArtifactStore.getState().setAiRunByMessage(messageId, {
      ...storeRun,
      status: 'CANCELLED',
      completed_at: new Date().toISOString(),
    });
  } else {
    upsertRun(messageId, { status: 'CANCELLED', completed_at: new Date().toISOString() });
  }
  if (entry) {
    runsByMessage.delete(messageId);
    if (entry.run.id) messageByRun.delete(entry.run.id);
  }
}

/**
 * FE rule 26 / BE §55A — PRIVATE_* events may only enter this device's
 * cache when the local user demonstrably participates. The backend ACL is
 * the real authority (§11.2: never rely on the flag alone) — this gate is
 * client defense-in-depth: when participation CANNOT be established from
 * the payload, the message is dropped rather than risk a leak.
 */
function privateEventIncludesMe(payload: Record<string, unknown>): boolean {
  const me = useAuthStore.getState().user?.id;
  if (!me) return false;
  const message = (payload.message ?? {}) as Record<string, unknown>;
  const senderId =
    firstString(message.sender_id, message.sender_user_id, payload.sender_user_id) ?? '';
  const recipientId = firstString(
    message.recipient_id,
    payload.recipient_user_id,
    payload.private_to,
  );
  // A private row only enters this device's cache when the local user
  // demonstrably participates: they authored it, or the server explicitly
  // addressed it to them. PRIVATE_AI threads belong to exactly one requester
  // + the AI identity — the literal `'ai'` recipient is NEVER sufficient on
  // its own, because the demo hub fans private rows out room-wide and any
  // member's thread would otherwise hydrate every device's shared cache
  // (audit 0.12/7.16/25.8). A foreign PRIVATE_AI row carrying
  // `recipient_id: 'ai'` is therefore dropped, not admitted.
  return senderId === me || recipientId === me;
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

function payloadOf(event: RealtimeEvent): unknown {
  return event.payload ?? {};
}

/**
 * Normalize an inbound message payload into the canonical FE Message.
 * Accepts BOTH shapes that arrive on the wire: a full §39 row (real backend
 * fan-out, D13) — validated + mapped through the shared row adapter — and
 * FE-shaped objects (demo hub echoes). Returns null when the payload is too
 * sparse to render (never invents content).
 */
function normalizeIncomingMessage(
  event: RealtimeEvent,
  messageId: string,
  incoming: Record<string, unknown>,
  visibility: string | null,
): Message | null {
  const asRow = MessageSchema.safeParse({ ...incoming, id: messageId });
  if (asRow.success) {
    const { memberNicknames, activeGroup } = useGroupStore.getState();
    const names = new Map(Object.entries(memberNicknames));
    return mapMessageRow(asRow.data, names, activeGroup?.ai_name || 'Odin');
  }

  // FE-shaped / demo echo path — requires the fields a bubble needs to exist.
  const body = firstString(incoming.body);
  if (body == null) return null;
  const senderType = firstString(incoming.sender_type) ?? 'USER';
  const senderId =
    firstString(incoming.sender_id, incoming.sender_user_id, incoming.sender_ai_id) ??
    firstString(event.actor_id) ??
    '';
  return {
    id: messageId,
    client_message_id: firstString(incoming.client_message_id) ?? undefined,
    group_id: firstString(incoming.group_id, event.group_id) ?? '',
    project_id: firstString(incoming.project_id) ?? undefined,
    sender_type: senderType as Message['sender_type'],
    sender_id: senderId,
    sender_name:
      senderType === 'AI'
        ? firstString(incoming.sender_name) ?? (useGroupStore.getState().activeGroup?.ai_name || 'Odin')
        : firstString(incoming.sender_name) ?? 'Member',
    body,
    visibility: (visibility ?? 'GROUP') as Message['visibility'],
    recipient_id: firstString(incoming.recipient_id) ?? undefined,
    reply_to_message_id: firstString(incoming.reply_to_message_id, incoming.reply_to_id) ?? undefined,
    reply_to_preview: firstString(incoming.reply_to_preview) ?? undefined,
    pinned: incoming.pinned === true,
    edited: false,
    deleted: false,
    attachments: Array.isArray(incoming.attachments)
      ? (incoming.attachments as Message['attachments'])
      : [],
    reactions: Array.isArray(incoming.reactions) ? (incoming.reactions as Message['reactions']) : [],
    is_pending: false,
    is_failed: false,
    created_at: firstString(incoming.created_at, event.occurred_at) ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function dispatchRealtimeEvent(event: RealtimeEvent): void {
  const payload = (payloadOf(event)) as Record<string, unknown>;
  const chat = useChatStore.getState();

  switch (event.event_type) {
    case 'message.created':
    case 'message.updated':
    case 'message.edited': {
      const incoming = (payload.message ?? {}) as Record<string, unknown> & { id?: string };
      const messageId = typeof incoming.id === 'string' && incoming.id
        ? incoming.id
        : firstString(payload.message_id, payload.id);
      if (!messageId) return;

      const visibility = firstString(incoming.visibility, payload.visibility);
      // Cache gate — see privateEventIncludesMe. GROUP events always pass.
      if (visibility && visibility !== 'GROUP' && !privateEventIncludesMe({ ...payload, message: incoming })) {
        return;
      }

      if (event.event_type === 'message.created') {
        // Dedupe against optimistic inserts by id or client_message_id.
        const exists = chat.messages.some(
          (m) => m.id === messageId || (!!incoming.client_message_id && m.client_message_id === incoming.client_message_id),
        );
        if (!exists) {
          const normalized = normalizeIncomingMessage(event, messageId, incoming, visibility);
          if (normalized) chat.addMessage(normalized);
        } else {
          // Server echo reconciles the optimistic copy (pending → confirmed).
          chat.updateMessage(messageId, { is_pending: false });
        }
        break;
      }

      // §31/§32 fan-out: message.updated (§114 name) / message.edited (§18).
      // Payload carries either a full row or {message_id, body, edited_at}.
      const body = firstString(incoming.body, payload.body);
      const updates: Partial<Message> = {};
      if (body != null && !incoming.deleted_at && payload.deleted !== true) updates.body = body;
      if (firstString(incoming.edited_at, payload.edited_at) != null || event.event_type === 'message.edited') {
        updates.edited = true;
      }
      chat.updateMessage(messageId, updates);
      break;
    }

    case 'message.deleted': {
      const messageId =
        firstString(payload.message_id, (payload.message as Record<string, unknown> | undefined)?.id) ?? '';
      if (!messageId) return;
      chat.deleteMessage(messageId);
      break;
    }

    case 'ai.status': {
      const messageId = resolveMessageId(payload) || String(payload.message_id ?? '');
      if (!messageId) return;
      const status = String(payload.status ?? '') as AiRun['status'];
      // §137/§134A — CANCELLED is terminal: keep whatever partial content the
      // backend already streamed, mark the run, release the stream buffers.
      if (status === 'CANCELLED') {
        finalizeStreamedMessage(messageId, null);
        upsertRun(messageId, {
          id: String(payload.run_id ?? 'run_pending'),
          status,
          completed_at: new Date().toISOString(),
        });
        const bound = runsByMessage.get(messageId);
        if (bound) {
          if (bound.run.id) dropOrphansFor(bound.run.id);
          runsByMessage.delete(messageId);
        }
        return;
      }
      upsertRun(messageId, {
        id: String(payload.run_id ?? 'run_pending'),
        status,
        sources: (payload.sources as AiRun['sources']) ?? undefined,
      });
      break;
    }

    case 'ai.run.started': {
      // §18 fan-out of run creation — flip the bound shell to RUNNING.
      const runId = String(payload.run_id ?? '');
      const messageId = runId ? messageByRun.get(runId) : undefined;
      if (!messageId) return;
      upsertRun(messageId, { id: runId, status: 'RUNNING' });
      break;
    }

    case 'ai.tool': {
      const messageId = String(payload.message_id ?? '') || resolveMessageId(payload);
      const call = payload.call as { id?: string; tool_name?: string; status?: string } | undefined;
      if (!messageId || !call) return;
      const entry = runsByMessage.get(messageId);
      const tools = [...(entry?.run.tool_calls ?? [])];
      const idx = tools.findIndex((t) => t.tool_name === call.tool_name);
      const toolCall = {
        id: call.id ?? `tool_${idx}`,
        run_id: entry?.run.id ?? 'run_pending',
        tool_name: call.tool_name ?? 'tool',
        status: (call.status ?? 'EXECUTING') as never,
        input: {},
        started_at: new Date().toISOString(),
      };
      if (idx >= 0) tools[idx] = { ...tools[idx], ...toolCall };
      else tools.push(toolCall);
      upsertRun(messageId, { tool_calls: tools });
      break;
    }

    case 'ai.delta': {
      const messageId = String(payload.message_id ?? '') || resolveMessageId(payload);
      streamDelta(String(payload.run_id ?? ''), messageId, typeof payload.delta === 'string' ? payload.delta : '');
      break;
    }

    case 'ai.response.delta': {
      // §18 name over the real fan-out; identical semantics to ai.delta.
      streamDelta(
        String(payload.run_id ?? ''),
        String(payload.message_id ?? ''),
        typeof payload.delta === 'string' ? payload.delta : '',
      );
      break;
    }

    case 'artifact.event': {
      const kind = String(payload.kind ?? '');
      if (kind === 'created' || kind === 'updated' || kind === 'version') {
        // §139 — regenerated runs produce NEW VERSIONS of an existing
        // artifact, never overwrites: mergeArtifactVersion appends unknown
        // versions and bumps current_version when the id already exists.
        const artifact = payload.artifact as Artifact | undefined;
        if (!artifact) return;
        const isNew = !useArtifactStore.getState().artifacts.some((a) => a.id === artifact.id);
        useArtifactStore.getState().mergeArtifactVersion(artifact);
        const messageId = resolveArtifactMessageId(event.group_id, artifact.id, payload);
        if (messageId) upsertRun(messageId, { created_artifacts: [artifact.id] });
        // §252 — a creation born of a live run is a user-requested
        // substantial output; open its construction trace and surface the
        // newest artifact (§251). Opening NEVER steals keyboard focus (§253).
        if (kind === 'created') {
          useConstructionStore.getState().beginConstruction(artifact.id);
          if (isNew && messageId) useArtifactStore.getState().autoOpenArtifact(artifact.id);
        }
      }
      break;
    }

    // ─── BE §75 granular construction vocabulary (live artifact streaming) ──
    //
    // `artifact.created` may carry either a FULL inline artifact row (demo
    // parity; D17) or the real backend's metadata stub `{artifact_id,
    // version}` (D15). Both are consumed: full rows merge into the store;
    // every shape opens a construction trace so an opened panel shows honest
    // build status instead of half-invented content.

    case 'artifact.created': {
      const inline = payload.artifact as Artifact | undefined;
      const artifactId =
        typeof payload.artifact_id === 'string'
          ? payload.artifact_id
          : (typeof inline?.id === 'string' ? inline.id : undefined);
      if (!artifactId) return;
      const isNew = !useArtifactStore.getState().artifacts.some((a) => a.id === artifactId);
      if (inline && Array.isArray(inline.versions)) {
        useArtifactStore.getState().mergeArtifactVersion(inline);
        const messageId = resolveArtifactMessageId(event.group_id, artifactId, payload);
        if (messageId) upsertRun(messageId, { created_artifacts: [artifactId] });
      }
      useConstructionStore.getState().beginConstruction(
        artifactId,
        typeof payload.render_state === 'string' ? payload.render_state : undefined,
      );
      // §252 auto-open only for run-bound, fully-described creations —
      // metadata stubs (D15) have nothing renderable yet.
      if (inline && isNew && resolveArtifactMessageId(event.group_id, artifactId, payload)) {
        useArtifactStore.getState().autoOpenArtifact(artifactId);
      }
      break;
    }

    case 'artifact.node.created': {
      const artifactId =
        firstString(payload.artifact_id, payload.artifactId) ??
        String((payload.node as { artifact_id?: string } | undefined)?.artifact_id ?? '');
      const node = payload.node as DiagramContent['nodes'][number] | undefined;
      if (!artifactId || !node || typeof node.id !== 'string' || !node.id) return;
      useConstructionStore.getState().nodeCreated(artifactId, node);
      break;
    }

    case 'artifact.node.updated': {
      const artifactId = firstString(payload.artifact_id, payload.artifactId);
      const node = payload.node as DiagramContent['nodes'][number] | undefined;
      if (!artifactId || !node || typeof node.id !== 'string' || !node.id) return;
      useConstructionStore.getState().nodeUpdated(artifactId, node);
      break;
    }

    case 'artifact.edge.created': {
      const artifactId = firstString(payload.artifact_id, payload.artifactId);
      const edge = payload.edge as DiagramContent['edges'][number] | undefined;
      if (!artifactId || !edge || typeof edge.source !== 'string' || typeof edge.target !== 'string') return;
      useConstructionStore.getState().edgeCreated(artifactId, edge);
      break;
    }

    case 'artifact.render_state.updated': {
      const artifactId = firstString(payload.artifact_id, payload.artifactId);
      const stateText = firstString(payload.state, payload.status, payload.render_state);
      if (!artifactId || !stateText) return;
      useConstructionStore.getState().renderStateChanged(artifactId, stateText);
      break;
    }

    case 'artifact.completed': {
      const artifactId =
        firstString(payload.artifact_id, payload.artifactId) ??
        firstString((payload.artifact as Artifact | undefined)?.id);
      if (!artifactId) return;
      // Final inline row (demo parity / future backend surface) merges the
      // complete version content; completion then settles the animation.
      const inline = payload.artifact as Artifact | undefined;
      if (inline && Array.isArray(inline.versions)) {
        useArtifactStore.getState().mergeArtifactVersion(inline);
      }
      useConstructionStore.getState().completeConstruction(artifactId);
      break;
    }

    // NOTE on 'artifact.created' in LIVE mode: payloads are still metadata
    // stubs {artifact_id, version} and GET /artifacts/:id returns METADATA
    // ONLY (content_ref → object storage; no inline content on §109). The
    // handler above therefore opens only an honest construction trace for
    // stubs — full rendering waits on the backend gap recorded in
    // INTEGRATION_NOTES.md (D15/D17). Demo mode emits full rows (D17.3).

    case 'ai.completed':
    case 'ai.response.completed': {
      const runId = String(payload.run_id ?? '');
      const messageId =
        (typeof payload.message_id === 'string' && payload.message_id) ||
        messageByRun.get(runId) ||
        '';
      const finalBody = typeof payload.final_body === 'string' ? payload.final_body : undefined;
      if (!messageId) return;
      // §135 — exactly ONE chat-store write for the whole stream. Server
      // final_body wins; otherwise the coalesced partial becomes the body.
      finalizeStreamedMessage(
        messageId,
        finalBody ?? (runId ? orphanStreams.get(runId)?.deltas.join('') || null : null),
      );
      if (runId) dropOrphansFor(runId);
      // §142 — AI response metadata: a non-primary model renders as the
      // subtle fallback indicator, never an alarm.
      upsertRun(messageId, {
        id: runId || 'run_pending',
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        sources: (payload.sources as AiRun['sources']) ?? undefined,
        created_artifacts: (payload.created_artifacts as string[]) ?? undefined,
        ...(firstString(payload.model_used, payload.model)
          ? { model_used: firstString(payload.model_used, payload.model)! }
          : {}),
        ...(payload.is_fallback === true || payload.fallback === true ? { is_fallback: true } : {}),
        ...(payload.is_byok === true || payload.byok === true ? { is_byok: true } : {}),
      });
      const artifactId = (payload.created_artifacts as string[] | undefined)?.[0];
      if (artifactId) {
        useArtifactStore.getState().setArtifactRunStatus({
          artifactId,
          runId: runId || 'run_pending',
          status: 'COMPLETED',
          approvalPending: false,
        });
      }
      runsByMessage.delete(messageId);
      messageByRun.delete(runId);
      break;
    }

    case 'ai.failed':
    case 'ai.response.failed': {
      const runId = String(payload.run_id ?? '');
      const messageId = messageByRun.get(runId) ?? String(payload.message_id ?? '');
      if (!messageId) return;
      // §140 — keep whatever streamed before the failure; never discard it.
      finalizeStreamedMessage(messageId, null);
      if (runId) dropOrphansFor(runId);
      upsertRun(messageId, {
        id: runId || 'run_pending',
        status: 'FAILED',
        error_code:
          typeof payload.failure_code === 'string'
            ? payload.failure_code
            : typeof payload.code === 'string'
              ? payload.code
              : undefined,
        error_message:
          typeof payload.error_message === 'string' ? payload.error_message : undefined,
        completed_at: new Date().toISOString(),
      });
      runsByMessage.delete(messageId);
      messageByRun.delete(runId);
      break;
    }

    case 'reaction.updated': {
      // Server-confirmed reaction state replaces local optimism.
      const messageId = String(payload.message_id ?? '');
      const emoji = String(payload.emoji ?? '');
      const count = Number(payload.count ?? 0);
      const userIds = (payload.user_ids as string[] | undefined) ?? [];
      if (!messageId || !emoji) return;
      useChatStore.setState((state) => ({
        messages: state.messages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                reactions: [
                  ...m.reactions.filter((r) => r.emoji !== emoji),
                  ...(count > 0 ? [{ emoji, count, user_ids: userIds }] : []),
                ],
              }
            : m,
        ),
      }));
      break;
    }

    case 'typing.updated': {
      applyTyping(
        String(payload.user_id ?? ''),
        String(payload.user_name ?? ''),
        Boolean(payload.typing),
      );
      break;
    }

    case 'presence.typing.started':
    case 'presence.typing.stopped': {
      // §18 fan-out naming for the same signal.
      applyTyping(String(payload.user_id ?? ''), '', event.event_type === 'presence.typing.started');
      break;
    }

    case 'presence.updated': {
      // §19/§38 — project live viewer counts into the header when the room
      // provides them (demo hub + real presence snapshot both do).
      const viewers = payload.viewers_online;
      if (typeof viewers === 'number' && Number.isFinite(viewers)) {
        useChatStore.setState({ presenceOnlineCount: Math.max(0, Math.round(viewers)) });
      }
      void payload.state;
      break;
    }

    // ─── §164A approval engine fan-out (P7) ─────────────────────────────────
    //
    // `github.action.proposed` (BE handlers/github.ts outbox payload) carries
    // the FULL envelope: action_id, action_kind, payload_hash, payload_version
    // and the §140 diff preview — exactly what an approval card must display
    // and bind to (§164A.2). Projected as a WAITING_APPROVAL action.
    case 'github.action.proposed': {
      const actionId = typeof payload.action_id === 'string' ? payload.action_id : '';
      const hash = typeof payload.payload_hash === 'string' ? payload.payload_hash : '';
      const version = Number(payload.payload_version ?? 0);
      if (!actionId || !hash || !Number.isInteger(version) || version < 1) return; // sparse stubs are ignored, never half-rendered
      const store = useProjectDataStore.getState();
      if (store.aiActions.some((a) => a.id === actionId)) return; // already held
      store.upsertAiAction({
        id: actionId,
        group_id: event.group_id ?? '',
        project_id: typeof payload.project_id === 'string' ? payload.project_id : undefined,
        action_kind: String(payload.action_kind ?? 'github.action'),
        risk_level: 'HIGH',
        status: 'WAITING_APPROVAL',
        payload:
          (payload.preview as Record<string, unknown> | undefined) ?? {},
        payload_hash: hash,
        payload_version: version,
        created_at: new Date().toISOString(),
      });
      break;
    }

    /**
     * §114 protocol name. The §114 frame is sparse (id/kind/risk only), so it
     * can only FLIP an already-held envelope back to active review — it never
     * fabricates a card. Full envelopes arrive via github.action.proposed.
     */
    case 'approval.requested': {
      const actionId = typeof payload.action_id === 'string' ? payload.action_id : '';
      if (!actionId) return;
      const store = useProjectDataStore.getState();
      const existing = store.aiActions.find((a) => a.id === actionId);
      if (existing) store.updateAiAction(actionId, { status: 'WAITING_APPROVAL' });
      break;
    }

    // ─── P8 project-intelligence fan-out (BE §18 taxonomy) ──────────────────
    //
    // The real outbox publishes `task.created/updated/assigned/completed/
    // cancelled`, `decision.proposed/approved/rejected/updated` and
    // `memory.*` as notify-stubs (D15 related items) — often just ids. The
    // projection therefore applies ONLY full rows it can validate; sparse
    // stubs fall through unknown-type tolerance rather than half-rendering.
    // Demo broadcasts carry complete rows so both modes share one pathway.

    case 'task.created':
    case 'task.updated': {
      const row = (payload.task ?? payload) as Record<string, unknown>;
      const parsed = TaskSchema.safeParse(row);
      if (parsed.success && typeof parsed.data.id === 'string') {
        useProjectDataStore.getState().upsertTask(mapTaskRow(parsed.data));
      }
      break;
    }

    case 'task.assigned':
    case 'task.completed':
    case 'task.cancelled': {
      const row = payload.task as Record<string, unknown> | undefined;
      if (row) {
        const parsed = TaskSchema.safeParse(row);
        if (parsed.success) {
          useProjectDataStore.getState().upsertTask(mapTaskRow(parsed.data));
          break;
        }
      }
      // Stub {task_id} — flip an already-held row's status only when this
      // client actually holds it; never fabricates a card from nothing.
      const taskId = firstString(payload.task_id);
      if (!taskId) break;
      const store = useProjectDataStore.getState();
      const held = store.tasks.find((t) => t.id === taskId);
      if (!held) break;
      if (event.event_type === 'task.completed') {
        store.upsertTask({ ...held, status: 'DONE', completed_at: new Date().toISOString() });
      } else if (event.event_type === 'task.cancelled') {
        store.upsertTask({ ...held, status: 'CANCELLED' });
      } else if (typeof payload.owner_user_id === 'string') {
        store.upsertTask({ ...held, owner_user_id: payload.owner_user_id });
      }
      break;
    }

    case 'decision.proposed':
    case 'decision.updated':
    case 'decision.approved':
    case 'decision.rejected': {
      const row = (payload.decision ?? payload) as Record<string, unknown>;
      const parsed = DecisionSchema.safeParse(row);
      if (parsed.success && typeof parsed.data.id === 'string') {
        useProjectDataStore.getState().upsertDecision(mapDecisionRow(parsed.data));
      }
      break;
    }

    case 'memory.candidate.created': {
      const row = (payload.candidate ?? payload) as Record<string, unknown>;
      const content = typeof row.content === 'string' ? row.content : '';
      const id = typeof row.id === 'string' ? row.id : '';
      if (!id || !content) break;
      useProjectDataStore.getState().upsertMemoryCandidate({
        id,
        group_id: typeof row.group_id === 'string' ? row.group_id : event.group_id ?? '',
        project_id: typeof row.project_id === 'string' ? row.project_id : null,
        user_id: typeof row.user_id === 'string' ? row.user_id : null,
        source_message_id: typeof row.source_message_id === 'string' ? row.source_message_id : null,
        candidate_type: typeof row.candidate_type === 'string' ? row.candidate_type : 'FACT',
        content,
        confidence: typeof row.confidence === 'number' ? row.confidence : 0.5,
        recommended_scope:
          row.recommended_scope === 'GROUP' || row.recommended_scope === 'USER_PRIVATE'
            ? row.recommended_scope
            : 'PROJECT',
        status: 'PENDING',
        created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
      });
      break;
    }

    case 'memory.approved': {
      // Acceptance fan-out: full memory row merges; the originating candidate
      // leaves the pending list.
      const row = (payload.memory ?? payload) as Record<string, unknown>;
      const parsed = MemoryEntrySchema.safeParse(row);
      if (parsed.success && typeof parsed.data.id === 'string') {
        useProjectDataStore.getState().upsertMemory(mapMemoryRow(parsed.data));
      }
      const candidateId = firstString(payload.candidate_id);
      if (candidateId) useProjectDataStore.getState().removeMemoryCandidate(candidateId);
      break;
    }

    case 'memory.updated': {
      const row = (payload.memory ?? payload) as Record<string, unknown>;
      const parsed = MemoryEntrySchema.safeParse(row);
      if (parsed.success && typeof parsed.data.id === 'string') {
        useProjectDataStore.getState().upsertMemory(mapMemoryRow(parsed.data));
      }
      break;
    }

    case 'memory.archived':
    case 'memory.deleted': {
      const memoryId =
        firstString(payload.memory_id, (payload.memory as Record<string, unknown> | undefined)?.id) ?? '';
      if (memoryId) useProjectDataStore.getState().deleteMemory(memoryId);
      break;
    }

    // ─── P10 notification fan-out (BE §95A row over §143 delivery) ──────────
    //
    // The demo hub broadcasts `notification.created` with the FULL §95A row
    // whenever a semantic event creates one (mention / approval / assignment).
    // The real Worker has no WS frame for notifications yet (rows are read
    // back via GET /notifications) — recorded in INTEGRATION_NOTES D24; when
    // it gains one, this validated projection consumes it unchanged.
    // Honesty properties: only complete schema-valid rows project; sparse
    // stubs fall through unknown-type tolerance, never half-render; and
    // §95A per-recipient targeting is enforced CLIENT-SIDE too (defense in
    // depth behind the server's audience resolution) — a row addressed to
    // another member never enters this cache.
    case 'notification.created': {
      const me = useAuthStore.getState().user?.id;
      const row = (payload.notification ?? payload) as Record<string, unknown>;
      const parsed = NotificationSchema.safeParse(row);
      if (!parsed.success || typeof parsed.data.id !== 'string' || !parsed.data.id) break;
      if (!me || parsed.data.recipient_user_id !== me) break; // §55A-analog gate
      const mapped = mapNotificationRow(parsed.data);
      const dataStore = useProjectDataStore.getState();
      if (dataStore.notifications.some((n) => n.id === mapped.id)) break; // dedupe
      dataStore.upsertNotification(mapped);
      // §174/§173/§278 — OS interruption pipeline (gates inside).
      void deliverOsNotification(mapped);
      break;
    }

    case 'meeting.event':
    case 'meeting.started': {
      // §114 server→client vocabulary + the room's broadcastSystem names
      // (group-room.ts sends `meeting.started` with {meeting_session_id,
      // project_id, started_by}). Hydrate the FULL session from §112 GET —
      // never project a half-filled session from the notify payload.
      const sessionId = firstString(payload.meeting_session_id, payload.meeting_id, payload.id);
      if (!sessionId) break;
      const alreadyActive = useMeetingStore.getState().currentSession?.id === sessionId;
      if (alreadyActive) break;
      void fetchMeeting(sessionId)
        .then(({ session, candidates }) => {
          const store = useMeetingStore.getState();
          // A locally-started session (REST response won the race) is kept.
          if (useMeetingStore.getState().isMeetingActive) return;
          store.setSession(session);
          store.setCandidates(candidates);
        })
        .catch(() => undefined); // unknown/unauthorized id: honest absence
      break;
    }

    case 'meeting.ended': {
      const sessionId = firstString(payload.meeting_session_id, payload.meeting_id, payload.id);
      if (!sessionId) break;
      const state = useMeetingStore.getState();
      if (state.currentSession?.id !== sessionId) break;
      // Re-read the server truth: leftovers were expired at end (§50A).
      void fetchMeeting(sessionId)
        .then(({ candidates }) => {
          useMeetingStore.getState().setCandidates(candidates);
        })
        .catch(() => undefined)
        .finally(() => {
          useMeetingStore.getState().finishEnding();
        });
      break;
    }

    // ─── BE §18 Sync taxonomy (P11) ────────────────────────────────────────
    // Server-side sync lifecycle events. `connected`/`reconciled` are
    // telemetry: they stamp the §186A.1 checkpoint's last_synced_at.
    case 'sync.client.connected':
    case 'sync.client.reconciled': {
      const { checkpoint, setCheckpoint } = useSyncStore.getState();
      if (checkpoint) {
        setCheckpoint({ ...checkpoint, last_synced_at: new Date().toISOString() });
      }
      break;
    }

    // A conflict was recorded against a queued write. Only surface it when
    // it blocks an operation THIS client actually holds (the §20A row's
    // payload carries the originating client_operation_id) or when this
    // device's engine already created the row locally — another member's
    // conflict never opens our §186 card.
    case 'sync.conflict.detected': {
      const parsed = SyncConflictSchema.safeParse(payload.conflict ?? payload);
      if (!parsed.success) break;
      const row = parsed.data;
      const opClientId =
        typeof row.local_payload.client_operation_id === 'string'
          ? row.local_payload.client_operation_id
          : null;
      const sync = useSyncStore.getState();
      const ours =
        (opClientId !== null &&
          sync.pendingOperations.some((o) => o.client_operation_id === opClientId)) ||
        sync.conflicts.some((c) => c.id === row.id);
      if (!ours) break;
      sync.upsertConflict({
        id: row.id,
        group_id: row.group_id,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        conflict_type: row.conflict_type,
        local_payload: row.local_payload,
        server_payload: row.server_payload,
        ...(row.resolution_strategy ? { resolution_strategy: row.resolution_strategy } : {}),
        ...(row.resolved_by ? { resolved_by: row.resolved_by } : {}),
        ...(row.resolved_at ? { resolved_at: row.resolved_at } : {}),
        ...(row.created_at ? { created_at: row.created_at } : {}),
        ...(opClientId ? { sync_operation_id: opClientId } : {}),
      });
      break;
    }

    // Someone (usually this device, via resolveConflictThroughSync) resolved
    // a conflict — mirror the resolution onto the local row we hold.
    case 'sync.conflict.resolved': {
      const parsed = SyncConflictSchema.safeParse(payload.conflict ?? payload);
      if (!parsed.success) break;
      const row = parsed.data;
      const held = useSyncStore.getState().conflicts.find((c) => c.id === row.id);
      if (!held || !row.resolution_strategy) break;
      useSyncStore.getState().resolveConflict(
        row.id,
        row.resolution_strategy,
        row.resolved_by ?? 'server',
      );
      break;
    }

    default:
      // Unknown/unhandled event types are ignored until their phase lands.
      break;
  }
}

function applyTyping(userId: string, userName: string, typing: boolean): void {
  if (!userId) return;
  useChatStore.setState((state) => {
    const others = state.typingUsers.filter((u) => u.user_id !== userId);
    return {
      typingUsers: typing
        ? [...others, { user_id: userId, user_name: userName, started_at: new Date().toISOString() }]
        : others,
    };
  });
}

function findMessageForArtifact(groupId: string, artifactId: string): string | null {
  void groupId;
  for (const [messageId, entry] of runsByMessage.entries()) {
    if (entry.run.created_artifacts.includes(artifactId)) return messageId;
  }
  return null;
}

/**
 * Resolve the chat bubble an artifact event belongs to: explicit
 * `message_id` wins, then the run→bubble binding (REST start / §18 frames),
 * then the legacy created_artifacts scan. Null = unbound (§252 gate).
 */
function resolveArtifactMessageId(
  groupId: string,
  artifactId: string,
  payload: Record<string, unknown>,
): string | null {
  const direct = firstString(payload.message_id);
  if (direct) return direct;
  const runId = firstString(payload.run_id);
  const viaRun = runId ? messageByRun.get(runId) : undefined;
  if (viaRun) return viaRun;
  return findMessageForArtifact(groupId, artifactId);
}
