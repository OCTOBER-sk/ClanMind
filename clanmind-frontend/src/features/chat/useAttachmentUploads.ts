/**
 * Attachment upload controller (P4, FE §47–§53).
 *
 * Owns the full chip lifecycle so view components never touch the API layer
 * (FE §9/§311): pick/drop/paste → pre-flight §178 limits → multipart upload
 * with progress/cancel (§50) → Uploaded (+ §127 "Preparing for Odin…")
 * → failure keeps the chip visible with Retry/Remove (§51, never silently
 * dropped). State lives in the chat store (`composerAttachments`) because the
 * send pipeline consumes it.
 */

import { useCallback, useRef } from 'react';
import { uploadAttachment } from '@/api/endpoints/attachments';
import { AbortedError, ApiError } from '@/api/errors';
import {
  ATTACHMENTS_PER_MESSAGE_MAX,
  ATTACHMENT_MAX_BYTES,
  formatBytes,
} from '@/config/limits';
import { useToast } from '@/design-system/components/Toast';
import { useChatStore } from '@/state/useChatStore';
import { useGroupStore } from '@/state/useGroupStore';
import { useSyncStore } from '@/state/useSyncStore';
import { getDemoRuntime } from '@/mocks/runtime';
import type { Attachment } from '@/types';

function makeChipId(): string {
  return `att_${Date.now()}_${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

export function useAttachmentUploads() {
  const { toast } = useToast();
  /** Local chip id → in-flight AbortController (§50 Cancel). */
  const abortsRef = useRef<Map<string, AbortController>>(new Map());

  /** §236 — a rejected file announces itself; nothing is dropped silently. */
  const rejectFile = useCallback(
    (reason: string) => {
      toast({
        title: "Couldn't add this file.",
        description: `${reason} Try again or choose another file.`,
        variant: 'error',
        duration: 5000,
      });
    },
    [toast],
  );

  const patch = useCallback((id: string, update: Partial<Attachment>) => {
    useChatStore.getState().updateComposerAttachment(id, update);
  }, []);

  const startUpload = useCallback(
    (chip: Attachment) => {
      const { activeGroup, activeProject } = useGroupStore.getState();
      const groupId = activeGroup?.id;
      if (!groupId || !chip.file) {
        // No room context or source handle — fail visibly, never silently.
        patch(chip.id, {
          upload_state: 'failed',
          sync_state: 'LOCAL_ONLY',
          error_message: 'This file cannot be uploaded right now.',
        });
        return;
      }

      const controller = new AbortController();
      abortsRef.current.set(chip.id, controller);
      patch(chip.id, {
        upload_state: 'uploading',
        upload_progress: 0,
        sync_state: 'UPLOADING',
      });

      void uploadAttachment({
        groupId,
        projectId: activeProject?.id ?? null,
        file: chip.file,
        signal: controller.signal,
        onProgress: (percent) => {
          // Ignore late ticks after the chip moved on (retry/remove/cancel).
          if (abortsRef.current.get(chip.id) === controller) {
            patch(chip.id, { upload_progress: percent });
          }
        },
      })
        .then((row) => {
          if (abortsRef.current.get(chip.id) !== controller) return;
          abortsRef.current.delete(chip.id);
          patch(chip.id, {
            upload_state: 'uploaded',
            upload_progress: 100,
            sync_state: 'SYNCED',
            // §127 — transfer done ≠ AI-ready; indexing runs orthogonally.
            index_state: 'INDEXING',
            server_attachment_id: row.id,
          });
          // Demo-only: the demo backend has no §127 status surface yet, so
          // the hub-side pipeline is approximated deterministically. Live
          // mode keeps INDEXING until the backend exposes the axis (ledger D16).
          if (getDemoRuntime()) {
            window.setTimeout(() => {
              const current = useChatStore
                .getState()
                .composerAttachments.find((a) => a.id === chip.id);
              if (current?.server_attachment_id === row.id) {
                patch(chip.id, { index_state: 'READY' });
              }
            }, 2_400);
          }
        })
        .catch((err: unknown) => {
          if (abortsRef.current.get(chip.id) !== controller) return;
          abortsRef.current.delete(chip.id);
          // User cancel — the chip is already gone; nothing to surface (§48).
          if (err instanceof AbortedError || controller.signal.aborted) return;
          // §51 — failure stays on the chip with Retry/Remove. Server copy
          // (BE §102 envelope) wins when present; generic fallback otherwise.
          const detail =
            err instanceof ApiError && err.message && err.message !== err.code
              ? err.message
              : undefined;
          patch(chip.id, {
            upload_state: 'failed',
            sync_state: 'LOCAL_ONLY',
            upload_progress: undefined,
            error_message: detail ?? "Couldn't upload this file.",
          });
        });
    },
    [patch],
  );

  /**
   * Entry point for §47 picker / §52 drop / §53 paste. Pre-flights the BE §178
   * limits from config and REJECTS visibly (§236 toast per file) — a rejected
   * file is never silently dropped.
   */
  const addFiles = useCallback(
    (files: File[] | FileList) => {
      const incoming = Array.from(files);
      if (incoming.length === 0) return;

      const store = useChatStore.getState();
      const offline =
        useSyncStore.getState().status === 'offline' ||
        useSyncStore.getState().status === 'reconnecting';

      let slots = ATTACHMENTS_PER_MESSAGE_MAX - store.composerAttachments.length;

      for (const file of incoming) {
        if (slots <= 0) {
          rejectFile(`A message can carry up to ${ATTACHMENTS_PER_MESSAGE_MAX} files.`);
          continue;
        }
        if (file.size > ATTACHMENT_MAX_BYTES) {
          rejectFile(`"${file.name}" is larger than ${formatBytes(ATTACHMENT_MAX_BYTES)}.`);
          continue;
        }

        const chip: Attachment = {
          id: makeChipId(),
          file_name: file.name || 'unnamed',
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
          sync_state: 'QUEUED',
          upload_state: 'selected',
          file,
        };
        // §49 — small local thumbnail source for images only.
        if (chip.mime_type.startsWith('image/')) {
          chip.file_url = URL.createObjectURL(file);
        }
        store.addComposerAttachment(chip);
        slots -= 1;
        // §183/P11 — offline chips stay `selected`; they ride the queued
        // message when connectivity returns instead of failing silently.
        if (!offline) startUpload(chip);
      }
    },
    [rejectFile, startUpload],
  );

  /** §51 Retry — re-uploads the SAME file under the SAME chip identity. */
  const retryAttachment = useCallback(
    (attachmentId: string) => {
      const chip = useChatStore
        .getState()
        .composerAttachments.find((a) => a.id === attachmentId);
      if (!chip?.file) {
        // Source handle lost (e.g. reload) — Remove is the only honest option;
        // surface it rather than pretending to retry.
        useChatStore.getState().removeComposerAttachment(attachmentId);
        return;
      }
      startUpload(chip);
    },
    [startUpload],
  );

  /** §50 Cancel — aborts the transfer and removes the chip (explicit user act). */
  const cancelAttachment = useCallback((attachmentId: string) => {
    abortsRef.current.get(attachmentId)?.abort();
    abortsRef.current.delete(attachmentId);
    const url = useChatStore
      .getState()
      .composerAttachments.find((a) => a.id === attachmentId)?.file_url;
    if (url) URL.revokeObjectURL(url);
    useChatStore.getState().removeComposerAttachment(attachmentId);
  }, []);

  /** Chip removal (X button / failed-chip Remove). */
  const removeAttachment = useCallback((attachmentId: string) => {
    abortsRef.current.get(attachmentId)?.abort();
    abortsRef.current.delete(attachmentId);
    const url = useChatStore
      .getState()
      .composerAttachments.find((a) => a.id === attachmentId)?.file_url;
    if (url) URL.revokeObjectURL(url);
    useChatStore.getState().removeComposerAttachment(attachmentId);
  }, []);

  return {
    addFiles,
    retryAttachment,
    cancelAttachment,
    removeAttachment,
  };
}
