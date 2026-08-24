/**
 * Attachments endpoint — the ONLY REST surface for file upload (FE §9 layer
 * boundary; P4). Binds to the real Worker contract:
 *
 *   POST /api/v1/groups/:groupId/attachments   (multipart: `file`,
 *        optional `project_id`, optional `message_id`) → 201 §43 row
 *   POST /api/v1/attachments/:attachmentId/sign → short-lived signed URL (§84)
 *
 * Every response is zod-validated at the boundary (BE §152). The §178 size /
 * per-message limits are enforced pre-flight from src/config/limits.ts and
 * authoritatively re-checked by the server (VALIDATION_FAILED envelope).
 */

import { z } from 'zod';
import { api } from '@/api/client';
import { AttachmentRowSchema, type AttachmentRow } from '@/api/schemas';

export type { AttachmentRow };

export const SignedUrlSchema = z
  .object({
    attachment_id: z.string(),
    url: z.string(),
    expires_in_seconds: z.number().nonnegative(),
  })
  .passthrough();

export interface UploadAttachmentOptions {
  groupId: string;
  file: File;
  projectId?: string | null;
  /** 0..100 */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * Upload one file to the Group. The multipart field MUST be named `file`
 * (handlers/attachments.ts reads exactly that key); `project_id` scopes the
 * object key namespace (BE §83) when the chat has project context.
 */
export async function uploadAttachment(opts: UploadAttachmentOptions): Promise<AttachmentRow> {
  const form = new FormData();
  form.append('file', opts.file, opts.file.name);
  if (opts.projectId) form.append('project_id', opts.projectId);

  return api.upload<AttachmentRow>(`/groups/${opts.groupId}/attachments`, {
    form,
    signal: opts.signal,
    onProgress: opts.onProgress,
    schema: AttachmentRowSchema,
  });
}

/** §84 — mint a short-lived, authorization-checked download URL. */
export function signAttachment(attachmentId: string) {
  return api.post<z.infer<typeof SignedUrlSchema>>(
    `/attachments/${attachmentId}/sign`,
    undefined,
    { schema: SignedUrlSchema },
  );
}
