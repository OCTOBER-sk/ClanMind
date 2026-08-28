/**
 * Chat controller — owns the send/retry pipeline so view components never do
 * domain orchestration (FE §9/§311, refactor R1).
 *
 * Send path per FE §241: client_message_id → optimistic insert → queue when
 * offline (§183/§186A.2 reusing the identical operation id on retry) →
 * POST/WS delivery → reconcile. AI triggers create the §134A shell instantly
 * and hand the run to the realtime pipeline (demo runtime in demo mode).
 */

import { useCallback } from 'react';
import { api } from '@/api/client';
import { ApiError, quotaExhaustionOf } from '@/api/errors';
import { useAuthStore } from '@/state/useAuthStore';
import { useGroupStore } from '@/state/useGroupStore';
import { useChatStore } from '@/state/useChatStore';
import { useArtifactStore } from '@/state/useArtifactStore';
import { useSyncStore } from '@/state/useSyncStore';
import { enqueueSyncOperation } from '@/sync/outbox';
import { getDemoRuntime } from '@/mocks/runtime';
import { cancelRunLocally } from '@/realtime/dispatch';
import type { AiRun, Message, MessageAttachment, MessageVisibility } from '@/types';

function targetsAi(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('@odin') ||
    t.startsWith('/research') ||
    t.startsWith('/ask') ||
    t.startsWith('/deepresearch')
  );
}

/** Strip the trigger token — the run prompt is the request itself (BE §115). */
function aiPromptOf(text: string): string {
  const t = text.trim();
  const slash = /^(\/research|\/deepresearch|\/ask)\s+/i.exec(t);
  if (slash) return t.slice(slash[0].length).trim() || t;
  const at = /@odin\s*/i.exec(t);
  if (at) return t.replace(at[0], '').trim() || t;
  return t;
}

export interface SendMessageInput {
  /** Present when retrying a failed message — reuses ids verbatim. */
  existingMessageId?: string;
  /** §186A.2 — never mint a new operation id for a retry. */
  existingClientOperationId?: string;
}

/**
 * §39 row subset of the triggering user message, resolved by the live
 * `POST /messages` response. The server-assigned uuid id (not the locally
 * minted one) is what the backend accepts as `input_message_id`, and
 * `private_conversation_id` names the §2.4 conversation the message landed in.
 */
interface AiRunSourceRef {
  id?: string;
  private_conversation_id?: string | null;
}

function serverRefOf(row: AiRunSourceRef | null | undefined): {
  inputMessageId: string | null;
  privateConversationId: string | null;
} {
  return {
    inputMessageId: typeof row?.id === 'string' && row.id.length > 0 ? row.id : null,
    privateConversationId:
      typeof row?.private_conversation_id === 'string' && row.private_conversation_id.length > 0
        ? row.private_conversation_id
        : null,
  };
}

/**
 * §134/§138/§139 — start ONE AI run for `prompt` as a brand-new shell message.
 * Every entry point (fresh @odin send, Retry, Regenerate) comes through here,
 * which is what guarantees each attempt is a NEW run and the previous
 * response bubble is never overwritten.
 *
 * The run row is registered QUEUED before any socket event arrives: it pins
 * the prompt (Retry/Regenerate read it back), and gives the first early
 * delta an anchor bubble in the stream store.
 */
function spawnAiRun(input: {
  groupId: string;
  projectId?: string;
  visibility: MessageVisibility;
  prompt: string;
  /**
   * Resolves with the server §39 row of the triggering message (live POST
   * response). The run start waits for it so the REST call can carry the
   * composer's privacy scope + input linkage with SERVER-authoritative ids.
   * On failure the run still starts — scoped by visibility alone, never
   * degraded to GROUP (audit FINAL_PREKEY A2/B1).
   */
  source?: Promise<AiRunSourceRef | null>;
}): void {
  const { activeGroup } = useGroupStore.getState();
  const aiName = activeGroup?.ai_name || 'Odin';
  const aiShellId = `msg_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const runId = `run_${aiShellId}`;

  const shell: Message = {
    id: aiShellId,
    group_id: input.groupId,
    project_id: input.projectId,
    sender_type: 'AI',
    sender_id: 'odin_ai',
    sender_name: aiName,
    body: '',
    visibility: input.visibility,
    pinned: false,
    edited: false,
    deleted: false,
    attachments: [],
    reactions: [],
    ai_run_id: runId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  useChatStore.getState().addMessage(shell);

  useArtifactStore.getState().setAiRunByMessage(aiShellId, {
    id: runId,
    group_id: input.groupId,
    ...(input.projectId ? { project_id: input.projectId } : {}),
    status: 'QUEUED',
    mode: 'ASSIST',
    prompt: input.prompt,
    tool_calls: [],
    sources: [],
    created_artifacts: [],
    created_at: new Date().toISOString(),
  });

  const runtime = getDemoRuntime();
  if (runtime) {
    // Demo hub — deterministic §134A timeline over the real socket pipeline.
    runtime.simulateAiRun({
      messageId: aiShellId,
      runId,
      groupId: input.groupId,
      projectId: input.projectId ?? null,
      prompt: input.prompt,
      aiName,
    });
    return;
  }

  // LIVE — REST is the canonical start path (BE §106; WS ai.run answers
  // NOT_AVAILABLE_ON_WS). Streaming deltas reach the room via the realtime
  // port and are projected (batched, §135) by dispatchRealtimeEvent.
  const startLiveRun = (ref: {
    inputMessageId: string | null;
    privateConversationId: string | null;
  }): void => {
    void api
      .post<{ run_id?: string }>(`/groups/${input.groupId}/ai/runs`, {
        message: input.prompt,
        project_id: input.projectId ?? null,
        mode: 'ASSIST',
        // §2.4/§55A — the run carries the composer's privacy scope. Omitting
        // it defaults the run (and Odin's persisted answer, orchestrator
        // persistAiMessage + completion broadcast) to Group-visible: a
        // private question must never produce a Group-visible answer.
        visibility: input.visibility,
        // §40 — PRIVATE_AI conversations are re-resolved/authorized
        // server-side; a claimed id must be the requester's own conversation.
        ...(ref.privateConversationId
          ? { private_conversation_id: ref.privateConversationId }
          : {}),
        ...(ref.inputMessageId ? { input_message_id: ref.inputMessageId } : {}),
      })
      .then((res) => {
        if (typeof res?.run_id !== 'string') return;
        // Lazy — keeps the live runtime out of non-live chunks.
        void import('@/live/liveRuntime').then((m) => m.bindRunId(res.run_id!, aiShellId));
      })
      .catch((err: unknown) => {
        // §94 quota contract → AiQuotaCard BYOK branch on the failed shell.
        const exhaustion = quotaExhaustionOf(err);
        const failedRun: Partial<AiRun> = {
          id: runId,
          group_id: input.groupId,
          status: 'FAILED',
          mode: 'ASSIST',
          prompt: input.prompt,
          error_code:
            err instanceof ApiError && err.code === 'APPLICATION_AI_QUOTA_EXHAUSTED'
              ? 'APPLICATION_AI_QUOTA_EXHAUSTED'
              : 'RUN_START_FAILED',
          ...(exhaustion ? { can_continue_with_byok: exhaustion.canContinueWithByok } : {}),
          completed_at: new Date().toISOString(),
        };
        useArtifactStore.getState().setAiRunByMessage(aiShellId, failedRun as AiRun);
        if (!exhaustion) {
          useChatStore.getState().updateMessage(aiShellId, {
            body: "I couldn't start that run. The request failed before reaching the model.",
          });
        }
      });
  };

  void (input.source ?? Promise.resolve(null)).then(
    (row) => startLiveRun(serverRefOf(row)),
    () => startLiveRun({ inputMessageId: null, privateConversationId: null }),
  );
}

export function useChatController() {
  const user = useAuthStore((s) => s.user);

  const sendMessage = useCallback(
    (input: SendMessageInput = {}): void => {
      const chat = useChatStore.getState();
      const { activeGroup, activeProject } = useGroupStore.getState();
      const syncStatus = useSyncStore.getState().status;

      if (!user || !activeGroup) return;
      if (!chat.composerText.trim() && chat.composerAttachments.length === 0) return;

      // §48/§50/§51 — never let a message silently lose an in-flight or failed
      // upload. The composer UI gates Send; this is the controller-side twin.
      // §183 exception: offline `selected` chips ride the queued message (P11).
      const offlineNow = syncStatus === 'offline' || syncStatus === 'reconnecting';
      const unsettled = chat.composerAttachments.some((a) =>
        offlineNow
          ? a.upload_state === 'uploading'
          : a.upload_state === 'uploading' || a.upload_state === 'selected',
      );
      const failedUpload = chat.composerAttachments.some((a) => a.upload_state === 'failed');
      if (unsettled || failedUpload) return;

      // §58 — a private send requires an intact recipient selection. A
      // stale/cleared selection must NEVER degrade into a public send.
      const { members } = useGroupStore.getState();
      const privateRecipientValid =
        chat.visibility === 'PRIVATE_PAIR'
          ? Boolean(chat.privateRecipientId) &&
            members.some((m) => m.user_id === chat.privateRecipientId)
          : chat.visibility === 'PRIVATE_AI';
      if (chat.visibility !== 'GROUP' && !privateRecipientValid) return;

      // §186A.2: reuse the identical client_operation_id on retry.
      const clientOperationId =
        input.existingClientOperationId ??
        `client_op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const messageId =
        input.existingMessageId ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const offline = syncStatus === 'offline' || syncStatus === 'reconnecting';

      // Chips → message attachments. Uploaded chips carry their BE §43 server
      // id so the backend can insert §122 `message_attachments` links.
      const sentAttachments: MessageAttachment[] = chat.composerAttachments.map((a) => ({
        id: a.id,
        file_name: a.file_name,
        file_size: a.file_size,
        mime_type: a.mime_type,
        ...(a.file_url ? { file_url: a.file_url } : {}),
        sync_state: a.sync_state === 'SYNCED' ? 'SYNCED' : 'QUEUED',
        ...(a.index_state ? { index_state: a.index_state } : {}),
        upload_state: a.upload_state,
        ...(a.server_attachment_id ? { server_attachment_id: a.server_attachment_id } : {}),
      }));
      const uploadedIds = chat.composerAttachments
        .map((a) => a.server_attachment_id)
        .filter((id): id is string => Boolean(id));

      const newMsg: Message = {
        id: messageId,
        client_message_id: clientOperationId,
        group_id: activeGroup.id,
        project_id: activeProject?.id,
        sender_type: 'USER',
        sender_id: user.id,
        sender_name: user.name,
        body: chat.composerText.trim(),
        visibility: chat.visibility,
        recipient_id: chat.privateRecipientId,
        reply_to_preview: chat.replyTarget?.preview,
        reply_to_message_id: chat.replyTarget?.messageId,
        pinned: false,
        edited: false,
        deleted: false,
        attachments: sentAttachments,
        reactions: [],
        is_pending: offline,
        is_failed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      chat.addMessage(newMsg);
      chat.setComposerText('');
      chat.setReplyTarget(null);
      chat.clearComposerAttachments();

      if (offline) {
        // §183 — queue with a local pending bubble; the P11 outbox replays it
        // in order on reconnect, reusing this EXACT client_operation_id.
        chat.addPendingMessage({
          clientMessageId: clientOperationId,
          body: newMsg.body,
          attachmentIds: newMsg.attachments.map((a) => a.id),
          createdAt: newMsg.created_at,
        });
        // Payload mirrors the delivered-path POST body field-for-field so
        // replay is byte-identical to a live send (D9 contract).
        void enqueueSyncOperation({
          id: `op_${clientOperationId}`,
          client_operation_id: clientOperationId,
          group_id: newMsg.group_id,
          operation_type: 'message.create',
          entity_type: 'message',
          entity_id: newMsg.id,
          action: 'CREATE',
          payload: {
            project_id: newMsg.project_id ?? null,
            body: newMsg.body,
            reply_to_id: newMsg.reply_to_message_id ?? null,
            visibility: newMsg.visibility,
            recipient_id: newMsg.recipient_id ?? null,
            attachment_ids: uploadedIds,
          },
          status: 'PENDING',
          created_at: newMsg.created_at,
        });
        return;
      }
      // Delivered path — server persists first, echo arrives via socket
      // (deduped by id); the REST result reconciles the local copy.
      // Body mirrors handlers/messages.ts sendMessageBody exactly:
      // private scope rides `private_to` ("ai" | teammate id, §2.4), replies
      // use `reply_to_id`; mention tokens are resolved server-side.
      // `attachment_ids` carries BE §43 row ids for the §122 transactional
      // `message_attachments` insert — see INTEGRATION_NOTES D16 for the
      // live-backend gap (accepted by demo; stripped by today's Worker zod).
      const isPrivateAi = newMsg.visibility === 'PRIVATE_AI';
      const isPrivatePair = newMsg.visibility === 'PRIVATE_PAIR';
      // The §39 response row carries the SERVER-assigned id + the resolved
      // private conversation — exactly what a following AI run start needs
      // for `input_message_id` / `private_conversation_id` (audit A2). The
      // promise settles null on failure; the run must still start scoped.
      const deliveredRow: Promise<AiRunSourceRef | null> = api
        .post<AiRunSourceRef>(`/groups/${newMsg.group_id}/messages`, {
          project_id: newMsg.project_id ?? null,
          client_message_id: clientOperationId,
          body: newMsg.body,
          reply_to_id: newMsg.reply_to_message_id ?? null,
          ...(uploadedIds.length > 0 ? { attachment_ids: uploadedIds } : {}),
          ...(isPrivateAi ? { private_to: 'ai' as const } : {}),
          ...(isPrivatePair && newMsg.recipient_id ? { private_to: newMsg.recipient_id } : {}),
        })
        .then((row) => {
          const serverId = (row as unknown as { id?: string } | null)?.id;
          // §39 reconcile: swap the optimistic local id for the SERVER id in
          // place (keeps client_message_id) so later edits/pins/deletes and
          // socket echoes address the same row.
          useChatStore.getState().updateMessage(newMsg.id, {
            is_pending: false,
            ...(typeof serverId === 'string' && serverId ? { id: serverId } : {}),
          });
          return row ?? null;
        })
        .catch(() => {
          // §245 — never discard a failed message.
          useChatStore.getState().updateMessage(newMsg.id, {
            is_failed: true,
            is_pending: false,
          });
          return null;
        });

      // §134A — AI trigger creates the shell immediately; run events arrive
      // through the same socket pipeline in BOTH modes (D2).
      if (targetsAi(newMsg.body)) {
        const runtime = getDemoRuntime();
        // §141 — DEMO-ONLY seam: typing "quota" exercises the exact quota
        // error contract. Live sends go to the real run start unmodified.
        if (runtime && /quota/i.test(newMsg.body)) {
          const aiShellId = `msg_ai_${Date.now()}`;
          const aiName = activeGroup.ai_name || 'Odin';
          const quotaShell: Message = {
            id: aiShellId,
            group_id: activeGroup.id,
            project_id: activeProject?.id,
            sender_type: 'AI',
            sender_id: 'odin_ai',
            sender_name: aiName,
            body: '',
            visibility: newMsg.visibility,
            pinned: false,
            edited: false,
            deleted: false,
            attachments: [],
            reactions: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          useChatStore.getState().addMessage(quotaShell);
          setTimeout(() => {
            useChatStore.getState().updateMessage(aiShellId, {
              body: 'Application AI quota reached for this Group.',
            });
            runtime.applyQuotaState(aiShellId, /byok/i.test(newMsg.body));
          }, 900);
          return;
        }
        // The run prompt is the request itself — trigger token stripped (BE §115).
        spawnAiRun({
          groupId: activeGroup.id,
          projectId: activeProject?.id,
          visibility: newMsg.visibility,
          prompt: aiPromptOf(newMsg.body),
          source: deliveredRow,
        });
      }
    },
    [user],
  );

  /** §245 — retry keeps text + identity, flips back to queued/pending. */
  const retryMessage = useCallback((messageId: string): void => {
    const target = useChatStore
      .getState()
      .messages.find((m) => m.id === messageId);
    if (!target?.client_message_id) return;
    useChatStore.getState().updateMessage(messageId, { is_failed: false, is_pending: true });
    useChatStore.getState().addPendingMessage({
      clientMessageId: target.client_message_id,
      body: target.body,
      attachmentIds: target.attachments.map((a) => a.id),
      createdAt: new Date().toISOString(),
    });
  }, []);

  /**
   * §30 — thread reply composer (right work surface). Mirrors the main send
   * pipeline: optimistic insert with a fresh §241 client id → POST with
   * `reply_to_id` → reconcile via echo; offline queues like any message.
   */
  const sendThreadReply = useCallback(
    (rootMessageId: string, body: string): void => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const { activeGroup, activeProject } = useGroupStore.getState();
      const syncStatus = useSyncStore.getState().status;
      if (!user || !activeGroup) return;

      const clientOperationId = `client_op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const rootPreview =
        useChatStore
          .getState()
          .messages.find((m) => m.id === rootMessageId)
          ?.body.slice(0, 80) ?? '';

      const offline = syncStatus === 'offline' || syncStatus === 'reconnecting';
      const replyMsg: Message = {
        id: messageId,
        client_message_id: clientOperationId,
        group_id: activeGroup.id,
        project_id: activeProject?.id,
        sender_type: 'USER',
        sender_id: user.id,
        sender_name: user.name,
        body: trimmed,
        visibility: 'GROUP',
        reply_to_message_id: rootMessageId,
        reply_to_preview: rootPreview,
        pinned: false,
        edited: false,
        deleted: false,
        attachments: [],
        reactions: [],
        is_pending: offline,
        is_failed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      useChatStore.getState().addMessage(replyMsg);

      if (offline) {
        useChatStore.getState().addPendingMessage({
          clientMessageId: clientOperationId,
          body: trimmed,
          attachmentIds: [],
          createdAt: replyMsg.created_at,
        });
        return;
      }

      void api
        .post(`/groups/${activeGroup.id}/messages`, {
          project_id: activeProject?.id ?? null,
          client_message_id: clientOperationId,
          body: trimmed,
          reply_to_id: rootMessageId,
        })
        .then(() => {
          useChatStore.getState().updateMessage(messageId, { is_pending: false });
        })
        .catch(() => {
          // §245 — never discard a failed reply.
          useChatStore.getState().updateMessage(messageId, {
            is_failed: true,
            is_pending: false,
          });
        });
    },
    [user],
  );

  /**
   * §137 — Stop an active AI run. Cancel is a REST concern (BE §106
   * POST /ai/runs/:runId/cancel; the WS ai.cancel frame answers
   * NOT_AVAILABLE_ON_WS on the real room). The demo transport mirrors the
   * same route, so ONE code path serves both modes. Local terminal state is
   * applied optimistically so Stop never waits on the network: partial
   * content is preserved (§134A CANCELLED), and the server's own status
   * frame re-enters through dispatch idempotently.
   */
  const stopAiRun = useCallback((messageId: string): void => {
    const run = useArtifactStore.getState().aiRunsByMessage[messageId];
    if (!run) return;
    const runId = run.id;
    if (runId && runId !== 'run_pending') {
      void api.post(`/ai/runs/${encodeURIComponent(runId)}/cancel`, {}).catch(() => {
        // Optimistic state already applied; server truth lands via socket or not at all.
      });
    }
    cancelRunLocally(messageId);
  }, []);

  /**
   * §138/§139/§140 — Retry / Regenerate / Try fallback all start a NEW run
   * for the same prompt. The previous response bubble stays exactly as it is
   * (never overwritten); any artifact output becomes a new version through
   * the §139 merge path in dispatch. Model routing authority stays with the
   * server's §61 fallback chain — the client never dictates providers.
   */
  const retryAiResponse = useCallback((sourceMessageId: string): void => {
    const source = useChatStore.getState().messages.find((m) => m.id === sourceMessageId);
    if (!source) return;
    const sourceRun = useArtifactStore.getState().aiRunsByMessage[sourceMessageId];
    const prompt = sourceRun?.prompt?.trim() || aiPromptOf(source.body);
    if (!prompt) return;
    spawnAiRun({
      groupId: source.group_id,
      projectId: source.project_id,
      visibility: source.visibility,
      prompt,
    });
  }, []);

  /** §141 quota-failure injection surface (demo mode only). */
  const simulateQuotaError = useCallback(
    (messageId: string, canContinueWithByok: boolean): void => {
      getDemoRuntime()?.applyQuotaState(messageId, canContinueWithByok);
    },
    [],
  );

  return { sendMessage, retryMessage, sendThreadReply, simulateQuotaError, stopAiRun, retryAiResponse };
}
