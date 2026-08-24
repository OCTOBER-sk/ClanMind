/**
 * Messages endpoint — the ONLY history fetch site (FE §9 layer boundary).
 *
 * BE §105/§156: `GET /groups/:id/messages?before=<cursor>&limit=50` answers
 * `Page<Message>` = `{ items, next_cursor }`, newest page first; the cursor
 * is the OLDEST id of the page just received, so "next page" always means
 * OLDER messages (FE §202/§289 cursor-load). Rows are zod-validated at the
 * boundary (BE §152) and mapped to canonical FE messages exactly once.
 */

import { z } from 'zod';
import { api } from '@/api/client';
import { MessagePageSchema } from '@/api/schemas';
import { mapMessageRow } from '@/api/messageRow';
import { useGroupStore } from '@/state/useGroupStore';

export interface MessagePage {
  /** Ascending by created_at within the page (server returns them ordered). */
  items: Awaited<ReturnType<typeof mapMessageRow>>[];
  /** Cursor for the NEXT-OLDER page; null when history is exhausted. */
  nextCursor: string | null;
}

const DEFAULT_PAGE_LIMIT = 50;

export async function fetchMessagePage(opts: {
  groupId: string;
  /** `before` cursor — omit for the newest page. */
  before?: string;
  limit?: number;
}): Promise<MessagePage> {
  const page = await api.get<z.infer<typeof MessagePageSchema>>(
    `/groups/${opts.groupId}/messages`,
    {
      method: 'GET',
      query: {
        limit: String(opts.limit ?? DEFAULT_PAGE_LIMIT),
        ...(opts.before ? { before: opts.before } : {}),
      },
      schema: MessagePageSchema,
    },
  );

  const memberNames = new Map(
    Object.entries(useGroupStore.getState().memberNicknames),
  );
  const aiName = useGroupStore.getState().activeGroup?.ai_name || 'Odin';

  // Tolerate pages delivered in either order — the client owns ordering so
  // virtualizer anchors and dedupe never depend on server sort direction.
  const items = [...page.items]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((row) => mapMessageRow(row, memberNames, aiName));

  return { items, nextCursor: page.next_cursor ?? null };
}
