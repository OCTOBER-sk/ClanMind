/**
 * BE §39 `messages` row → canonical FE Message adapter.
 *
 * Shared by every consumer of wire rows (cursor-paged history fetcher,
 * realtime payload reconciliation) so the mapping rules exist exactly once:
 *  - sender resolution: AI → configured Group AI name; USER → the member's
 *    Group display name (§3 nickname mapping) when known, else a neutral
 *    fallback — never a fixture value;
 *  - soft delete / edit flags derive from deleted_at / edited_at (BE §39);
 *  - visibility passes through verbatim (GROUP | PRIVATE_PAIR | PRIVATE_AI,
 *    §11.1) so downstream scope filtering can enforce FE rule 26.
 */

import type { z } from 'zod';
import type { MessageSchema } from './schemas';
import type { Message } from '@/types';

type BEMessageRow = z.infer<typeof MessageSchema>;

export function mapMessageRow(
  row: BEMessageRow,
  memberNames: ReadonlyMap<string, string>,
  aiName: string,
): Message {
  const senderUserId = typeof row.sender_user_id === 'string' ? row.sender_user_id : null;
  const senderAiId = (row as { sender_ai_id?: string | null }).sender_ai_id ?? null;
  return {
    id: row.id,
    client_message_id: row.client_message_id,
    group_id: row.group_id,
    project_id: row.project_id ?? undefined,
    sender_type: row.sender_type as Message['sender_type'],
    sender_id: senderUserId ?? senderAiId ?? '',
    sender_name:
      row.sender_type === 'AI'
        ? aiName
        : (senderUserId && memberNames.get(senderUserId)) || 'Member',
    body: row.body,
    visibility: row.visibility as Message['visibility'],
    reply_to_message_id: row.reply_to_id ?? undefined,
    pinned: false,
    edited: row.edited_at != null,
    deleted: row.deleted_at != null,
    attachments: [],
    reactions: [],
    is_pending: false,
    is_failed: false,
    created_at: row.created_at,
    updated_at: row.edited_at ?? row.created_at,
  };
}
