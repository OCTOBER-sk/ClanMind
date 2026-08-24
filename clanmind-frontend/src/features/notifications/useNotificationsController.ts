/**
 * §171/§277 notifications controller — loads the recipient's §95A rows and
 * the §98A attention feed through the endpoint module, projects them into
 * the shared render store, and applies §277 read semantics:
 *
 *   • mark-read is OPTIMISTIC locally, authoritative on the server via
 *     POST /notifications/:id/read (read_at is server truth);
 *   • a failed POST rolls the optimistic read stamp back — an item that the
 *     server still considers unread MUST keep its badge (never silently
 *     swallowed);
 *   • mark-all-read fans out to one POST per previously-unread row so the
 *     wire contract stays per-notification exactly as the backend defines it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchGroupActivity,
  fetchNotifications,
  markNotificationRead,
} from '@/api/endpoints/notifications';
import { errorMessageOf } from '@/features/github/useGithubConnection';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import type { ActivityEvent, Notification } from '@/types';

export interface NotificationsControllerState {
  notifications: Notification[];
  unreadCount: number;
  /** §172/§98A attention feed for the active Group. */
  activityEvents: ActivityEvent[];
  isLoading: boolean;
  error: string | null;
  /** True while any mark-read POST is in flight. */
  isMutating: boolean;
  refresh: () => Promise<void>;
  markRead: (notificationId: string) => Promise<boolean>;
  /** Returns how many rows were actually flipped unread→read. */
  markAllRead: () => Promise<number>;
}

export function useNotificationsController(
  groupId: string | null | undefined,
): NotificationsControllerState {
  const notifications = useProjectDataStore((s) => s.notifications);
  const activityEvents = useProjectDataStore((s) => s.activityEvents);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const listQuery = useQuery({
    queryKey: ['notifications', groupId ?? null],
    queryFn: () => fetchNotifications({ limit: 50 }),
    enabled: Boolean(groupId),
    staleTime: 15_000,
  });

  const activityQuery = useQuery({
    queryKey: ['group-activity', groupId ?? null],
    queryFn: () => fetchGroupActivity(groupId as string),
    enabled: Boolean(groupId),
    staleTime: 30_000,
  });

  // Project validated reads into the single RENDER store (same pattern as
  // tasks/decisions controllers) so realtime fan-out rows land in one place.
  useEffect(() => {
    if (listQuery.data) {
      useProjectDataStore.getState().setNotifications(listQuery.data);
    }
  }, [listQuery.data]);

  useEffect(() => {
    if (activityQuery.data) {
      useProjectDataStore.getState().setActivityEvents(activityQuery.data);
    }
  }, [activityQuery.data]);

  const refresh = useCallback(async () => {
    await Promise.all([listQuery.refetch(), activityQuery.refetch()]);
  }, [listQuery, activityQuery]);

  const markRead = useCallback(
    async (notificationId: string): Promise<boolean> => {
      const store = useProjectDataStore.getState();
      const target = store.notifications.find((n) => n.id === notificationId);
      if (!target || target.read_at != null) return true; // idempotent no-op

      store.markNotificationAsRead(notificationId); // optimistic §277 badge drop
      setIsMutating(true);
      try {
        await markNotificationRead(notificationId);
        return true;
      } catch (err) {
        // Roll back — the server still owns read state (§95A read_at).
        useProjectDataStore.setState((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === notificationId ? { ...n, read_at: null } : n,
          ),
        }));
        setMutationError(errorMessageOf(err));
        return false;
      } finally {
        if (mountedRef.current) setIsMutating(false);
      }
    },
    [],
  );

  const markAllRead = useCallback(async (): Promise<number> => {
    const store = useProjectDataStore.getState();
    const unreadIds = store.notifications.filter((n) => n.read_at == null).map((n) => n.id);
    if (unreadIds.length === 0) return 0;

    store.clearAllNotifications(); // optimistic
    setIsMutating(true);
    try {
      const results = await Promise.allSettled(unreadIds.map((id) => markNotificationRead(id)));
      const failed = unreadIds.filter(
        (_, i) => results[i]?.status === 'rejected',
      );
      if (failed.length > 0) {
        // Only the rows the server rejected regain their unread state.
        useProjectDataStore.setState((s) => ({
          notifications: s.notifications.map((n) =>
            failed.includes(n.id) ? { ...n, read_at: null } : n,
          ),
        }));
        const firstError = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
        setMutationError(
          firstError ? errorMessageOf(firstError.reason) : 'Some notifications could not be marked read.',
        );
      }
      return unreadIds.length - failed.length;
    } finally {
      if (mountedRef.current) setIsMutating(false);
    }
  }, []);

  const loadError =
    listQuery.error instanceof Error ? listQuery.error.message : null;

  return {
    notifications,
    unreadCount: notifications.filter((n) => n.read_at == null).length,
    activityEvents,
    isLoading: Boolean(groupId) && (listQuery.isLoading || activityQuery.isLoading),
    error: loadError ?? mutationError,
    isMutating,
    refresh,
    markRead,
    markAllRead,
  };
}
