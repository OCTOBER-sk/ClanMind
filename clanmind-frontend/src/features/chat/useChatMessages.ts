/**
 * Message history hook — TanStack Query infinite pages over the BE §156
 * cursor contract (FE §202/§289).
 *
 * "Next page" means OLDER messages: each page's `next_cursor` is the oldest
 * id of that page and feeds `?before=`. The flattened result is ascending
 * by created_at, ready to merge with the realtime tail (chatSelectors).
 * Stable query key per Group so switching Groups never cross-contaminates
 * caches (and private scopes ride the same isolation rules as §202).
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchMessagePage, type MessagePage } from '@/api/endpoints/messages';
import type { Message } from '@/types';

export interface ChatHistory {
  /** Ascending history across all loaded pages (server rows only). */
  historyMessages: Message[];
  /** True while older history remains on the server. */
  hasOlder: boolean;
  isLoadingOlder: boolean;
  /** Cursor-load one older page (FE §202). Safe to call repeatedly. */
  loadOlder: () => void;
}

function flattenPages(pages: MessagePage[] | undefined): Message[] {
  if (!pages || pages.length === 0) return [];
  // Pages arrive newest→oldest; reverse for a single ascending run.
  const out: Message[] = [];
  for (let i = pages.length - 1; i >= 0; i--) out.push(...(pages[i]?.items ?? []));
  return out;
}

const MESSAGES_QUERY_ROOT = 'messages';

export function messagesQueryKey(groupId: string | undefined): readonly unknown[] {
  return [MESSAGES_QUERY_ROOT, groupId ?? null];
}

export function useChatMessages(groupId: string | undefined): ChatHistory {
  const query = useInfiniteQuery({
    queryKey: messagesQueryKey(groupId),
    enabled: Boolean(groupId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchMessagePage({ groupId: groupId as string, before: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    maxPages: 40,
    staleTime: 15_000,
  });

  return {
    historyMessages: flattenPages(query.data?.pages),
    hasOlder: query.hasNextPage,
    isLoadingOlder: query.isFetchingNextPage,
    loadOlder: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
  };
}
