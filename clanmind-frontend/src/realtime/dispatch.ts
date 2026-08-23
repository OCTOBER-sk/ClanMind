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
 */

import { useChatStore } from '@/state/useChatStore';
import { useArtifactStore } from '@/state/useArtifactStore';
import type { AiRun, Artifact } from '@/types';
import type { RealtimeEvent } from '@/realtime/events';

const runsByMessage = new Map<string, { run: AiRun; streamedBody: string; artifactOpened: boolean }>();
/**
 * Live runs are started via REST (§106); streaming events key on `run_id`.
 * The start call registers runId → shell messageId here so deltas route to
 * the right bubble even when they arrive before the HTTP response resolves.
 */
const messageByRun = new Map<string, string>();

export function bindRunToMessage(runId: string, messageId: string): void {
  messageByRun.set(runId, messageId);
}

function resolveMessageId(payload: Record<string, unknown>): string {
  const direct = payload.message_id ?? payload.messageId;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  const runId = typeof payload.run_id === 'string' ? payload.run_id : undefined;
  return (runId && messageByRun.get(runId)) || '';
}

function upsertRun(messageId: string, patch: Partial<AiRun>): void {
  const store = useArtifactStore.getState();
  const current = runsByMessage.get(messageId);
  const base: AiRun =
    current?.run ??
    ({
      id: 'run_pending',
      group_id: '',
      status: 'QUEUED',
      mode: 'ASSIST',
      prompt: '',
      tool_calls: [],
      sources: [],
      created_artifacts: [],
      created_at: new Date().toISOString(),
    } as unknown as AiRun);
  const next = { ...base, ...patch };
  runsByMessage.set(messageId, {
    run: next,
    streamedBody: current?.streamedBody ?? '',
    artifactOpened: current?.artifactOpened ?? false,
  });
  store.setAiRunByMessage(messageId, next);
}

/** Buffer for deltas that arrive before their run is bound to a bubble. */
interface OrphanStream {
  deltas: string[];
}
const orphanStreams = new Map<string, OrphanStream>();

function appendDelta(messageId: string, delta: string): void {
  const chat = useChatStore.getState();
  const entry = runsByMessage.get(messageId);
  if (!entry) return;
  const body = entry.streamedBody + delta;
  entry.streamedBody = body;
  chat.updateMessage(messageId, { body });
}

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
  appendDelta(messageId, delta);
  upsertRun(messageId, runId ? { id: runId, status: 'STREAMING' } : { status: 'STREAMING' });
}

export function dispatchRealtimeEvent(event: RealtimeEvent): void {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const chat = useChatStore.getState();

  switch (event.event_type) {
    case 'message.created': {
      const message = payload.message as { id: string; [k: string]: unknown } | undefined;
      if (!message?.id) return;
      // Dedupe against optimistic inserts by id or client_message_id.
      const exists = chat.messages.some(
        (m) => m.id === message.id || (!!message.client_message_id && m.client_message_id === message.client_message_id),
      );
      if (!exists) {
        chat.addMessage(message as unknown as Parameters<typeof chat.addMessage>[0]);
      } else {
        // Server echo reconciles the optimistic copy (pending → confirmed).
        chat.updateMessage(String(message.id), { is_pending: false });
      }
      break;
    }

    case 'ai.status': {
      const messageId = resolveMessageId(payload) || String(payload.message_id ?? '');
      if (!messageId) return;
      const status = String(payload.status ?? '');
      upsertRun(messageId, {
        id: String(payload.run_id ?? 'run_pending'),
        status: status as AiRun['status'],
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
      if (kind === 'created') {
        const artifact = payload.artifact as Artifact | undefined;
        if (!artifact) return;
        useArtifactStore.getState().addArtifact(artifact);
        const messageId = findMessageForArtifact(event.group_id, artifact.id);
        if (messageId) upsertRun(messageId, { created_artifacts: [artifact.id] });
      }
      break;
    }

    // NOTE on 'artifact.created' (real fan-out): its payload is a stub
    // {artifact_id, version} and GET /artifacts/:id returns METADATA ONLY
    // (content_ref → object storage; no inline content anywhere on §109).
    // The FE artifact viewer consumes inline content (FE §97), so there is
    // nothing contract-honest to project yet — recorded as an open backend
    // gap in INTEGRATION_NOTES.md (D15) rather than papered over here.

    case 'ai.completed':
    case 'ai.response.completed': {
      const runId = String(payload.run_id ?? '');
      const messageId =
        (typeof payload.message_id === 'string' && payload.message_id) ||
        messageByRun.get(runId) ||
        '';
      const finalBody = typeof payload.final_body === 'string' ? payload.final_body : undefined;
      if (finalBody && messageId) chat.updateMessage(messageId, { body: finalBody });
      if (!messageId) return;
      // Flush any buffered pre-bind stream so text is never lost.
      const orphan = runId ? orphanStreams.get(runId) : undefined;
      if (orphan && !finalBody && orphan.deltas.length > 0) {
        chat.updateMessage(messageId, { body: orphan.deltas.join('') });
      }
      if (runId) orphanStreams.delete(runId);
      upsertRun(messageId, {
        id: runId || 'run_pending',
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        sources: (payload.sources as AiRun['sources']) ?? undefined,
        created_artifacts: (payload.created_artifacts as string[]) ?? undefined,
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
      upsertRun(messageId, {
        id: runId || 'run_pending',
        status: 'FAILED',
        error_code:
          typeof payload.failure_code === 'string'
            ? payload.failure_code
            : typeof payload.code === 'string'
              ? payload.code
              : undefined,
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
      // Payload carries user_id + state (ONLINE/IDLE/AWAY/OFFLINE).
      void payload.state;
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
