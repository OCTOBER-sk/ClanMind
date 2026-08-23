/**
 * Demo event dispatch — the in-demo equivalent of the production
 * `realtime/dispatch` (built fully in P3/P5): it consumes validated envelope
 * events from the same RealtimeClient pipeline and projects them into the
 * client stores. In live mode this file never loads.
 *
 * Handlers here replicate the documented §134A run lifecycle, BE §75 artifact
 * streaming, and message echo semantics so demo behavior equals the contract.
 */

import { useChatStore } from '@/state/useChatStore';
import { useArtifactStore } from '@/state/useArtifactStore';
import type { AiRun, Artifact } from '@/types';
import type { RealtimeEvent } from '@/realtime/events';

const runsByMessage = new Map<string, { run: AiRun; streamedBody: string; artifactOpened: boolean }>();

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

export function handleDemoEvent(event: RealtimeEvent): void {
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
      }
      break;
    }

    case 'ai.status': {
      const messageId = String(payload.message_id ?? '');
      if (!messageId) return;
      const status = String(payload.status ?? '');
      upsertRun(messageId, {
        id: String(payload.run_id ?? 'run_pending'),
        status: status as AiRun['status'],
        sources: (payload.sources as AiRun['sources']) ?? undefined,
      });
      break;
    }

    case 'ai.tool': {
      const messageId = String(payload.message_id ?? '');
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
      const messageId = String(payload.message_id ?? '');
      const delta = typeof payload.delta === 'string' ? payload.delta : '';
      if (!messageId || !delta) return;
      const entry = runsByMessage.get(messageId);
      const body = (entry?.streamedBody ?? '') + delta;
      if (entry) entry.streamedBody = body;
      chat.updateMessage(messageId, { body });
      upsertRun(messageId, { status: 'STREAMING' });
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

    case 'ai.completed': {
      const messageId = String(payload.message_id ?? '');
      if (!messageId) return;
      const finalBody = typeof payload.final_body === 'string' ? payload.final_body : undefined;
      if (finalBody) chat.updateMessage(messageId, { body: finalBody });
      upsertRun(messageId, {
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        sources: (payload.sources as AiRun['sources']) ?? undefined,
        created_artifacts: (payload.created_artifacts as string[]) ?? undefined,
      });
      const artifactId = (payload.created_artifacts as string[] | undefined)?.[0];
      if (artifactId) {
        useArtifactStore.getState().setArtifactRunStatus({
          artifactId,
          runId: String(payload.run_id ?? 'run_pending'),
          status: 'COMPLETED',
          approvalPending: false,
        });
      }
      runsByMessage.delete(messageId);
      break;
    }

    case 'ai.failed': {
      const messageId = String(payload.message_id ?? '');
      if (!messageId) return;
      upsertRun(messageId, {
        status: 'FAILED',
        error_code: typeof payload.code === 'string' ? payload.code : undefined,
        completed_at: new Date().toISOString(),
      });
      runsByMessage.delete(messageId);
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
      const typing = Boolean(payload.typing);
      const userId = String(payload.user_id ?? '');
      const userName = String(payload.user_name ?? '');
      useChatStore.setState((state) => {
        const others = state.typingUsers.filter((u) => u.user_id !== userId);
        return {
          typingUsers: typing ? [...others, { user_id: userId, user_name: userName, started_at: new Date().toISOString() }] : others,
        };
      });
      break;
    }

    default:
      // Unknown/unhandled event types are ignored until their phase lands.
      break;
  }
}

function findMessageForArtifact(groupId: string, artifactId: string): string | null {
  for (const [messageId, entry] of runsByMessage.entries()) {
    if (entry.run.created_artifacts.includes(artifactId)) return messageId;
  }
  void groupId;
  return null;
}
