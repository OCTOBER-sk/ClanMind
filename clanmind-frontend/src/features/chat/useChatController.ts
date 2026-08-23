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
import { useAuthStore } from '@/state/useAuthStore';
import { useGroupStore } from '@/state/useGroupStore';
import { useChatStore } from '@/state/useChatStore';
import { useSyncStore } from '@/state/useSyncStore';
import { getDemoRuntime } from '@/mocks/runtime';
import type { Message } from '@/types';

function targetsAi(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('@odin') ||
    t.startsWith('/research') ||
    t.startsWith('/ask') ||
    t.startsWith('/deepresearch')
  );
}

export interface SendMessageInput {
  /** Present when retrying a failed message — reuses ids verbatim. */
  existingMessageId?: string;
  /** §186A.2 — never mint a new operation id for a retry. */
  existingClientOperationId?: string;
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

      // §186A.2: reuse the identical client_operation_id on retry.
      const clientOperationId =
        input.existingClientOperationId ??
        `client_op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const messageId =
        input.existingMessageId ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const offline = syncStatus === 'offline' || syncStatus === 'reconnecting';

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
        attachments: [...chat.composerAttachments],
        reactions: [],
        is_pending: offline,
        is_failed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      chat.addMessage(newMsg);
      chat.setComposerText('');
      chat.setReplyTarget(null);

      if (offline) {
        // §183 — queue with a local pending bubble; replay happens in P11.
        chat.addPendingMessage({
          clientMessageId: clientOperationId,
          body: newMsg.body,
          attachmentIds: newMsg.attachments.map((a) => a.id),
          createdAt: newMsg.created_at,
        });
        useSyncStore.getState().addOperation({
          id: `op_${clientOperationId}`,
          client_operation_id: clientOperationId,
          group_id: newMsg.group_id,
          entity_type: 'message',
          entity_id: newMsg.id,
          action: 'CREATE',
          payload: { body: newMsg.body, visibility: newMsg.visibility },
          status: 'PENDING',
          created_at: newMsg.created_at,
        });
        return;
      }

      // Delivered path — server persists first, echo arrives via socket
      // (deduped by id); the REST result reconciles the local copy.
      void api
        .post(`/groups/${newMsg.group_id}/messages`, {
          project_id: newMsg.project_id ?? null,
          client_message_id: clientOperationId,
          body: newMsg.body,
          visibility: newMsg.visibility,
          reply_to_message_id: newMsg.reply_to_message_id ?? null,
          recipient_id: newMsg.recipient_id ?? null,
          attachment_ids: [],
        })
        .then(() => {
          useChatStore.getState().updateMessage(newMsg.id, { is_pending: false });
        })
        .catch(() => {
          // §245 — never discard a failed message.
          useChatStore.getState().updateMessage(newMsg.id, {
            is_failed: true,
            is_pending: false,
          });
        });

      // §134A — AI trigger creates the shell immediately; run events arrive
      // through the same socket pipeline as production.
      if (targetsAi(newMsg.body)) {
        const runtime = getDemoRuntime();
        if (!runtime) return; // Live-mode AI runs arrive via WS from BE (P5).
        const aiShellId = `msg_ai_${Date.now()}`;
        const aiName = activeGroup.ai_name || 'Odin';
        const shell: Message = {
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
          ai_run_id: `run_${aiShellId}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        useChatStore.getState().addMessage(shell);

        // §141 — typing "quota" exercises the exact quota error contract.
        if (/quota/i.test(newMsg.body)) {
          setTimeout(() => {
            useChatStore.getState().updateMessage(aiShellId, {
              body: 'Application AI quota reached for this Group.',
            });
            runtime.applyQuotaState(aiShellId, /byok/i.test(newMsg.body));
          }, 900);
          return;
        }

        runtime.simulateAiRun({
          messageId: aiShellId,
          groupId: activeGroup.id,
          projectId: activeProject?.id ?? null,
          prompt: newMsg.body,
          aiName,
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

  /** §141 quota-failure injection surface (demo mode only). */
  const simulateQuotaError = useCallback(
    (messageId: string, canContinueWithByok: boolean): void => {
      getDemoRuntime()?.applyQuotaState(messageId, canContinueWithByok);
    },
    [],
  );

  return { sendMessage, retryMessage, simulateQuotaError };
}
