/**
 * §171 Notification center — the panel behind the TopBar bell. List, unread
 * states (§277 subtle badge), per-item mark-read on open, mark-all-read,
 * and §193/§247 deep links into the resolved object surfaces.
 *
 * §207 state matrix coverage: default / hover / focus / selected (unread
 * highlight) / disabled (mark-all while mutating) / loading (skeletons,
 * §180) / error (§181 what-happened + recovery) / empty (§179 what-why-next).
 */

import React from 'react';
import { Bell, CheckCheck, Loader2, RotateCw } from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Skeleton } from '@/design-system/components/Skeleton';
import {
  notificationCategoryIcon,
  notificationCategoryLabel,
} from './notificationDisplay';
import type { Notification } from '@/types';

export interface NotificationCenterPanelProps {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  isMutating: boolean;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  /** Opens the item: marks it read (§277 when actually viewed) + deep links. */
  onOpenNotification: (notification: Notification) => void;
  onViewAllActivity: () => void;
}

export function NotificationCenterPanel({
  notifications,
  unreadCount,
  isLoading,
  error,
  isMutating,
  onRefresh,
  onMarkAllRead,
  onOpenNotification,
  onViewAllActivity,
}: NotificationCenterPanelProps) {
  return (
    <div className="flex flex-col w-[340px] max-h-[420px]" data-testid="notification-center">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-1 pb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden="true"
            style={{ color: unreadCount > 0 ? 'var(--color-info)' : 'var(--color-text-secondary)' }}
          >
            <Bell className="w-4 h-4" />
          </span>
          <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}
            >
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh notifications"
            className="p-1 rounded-md cursor-pointer transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:shadow-[var(--focus-ring)] outline-none disabled:opacity-40"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
          {/* §215 button states — disabled while mutating or nothing to do */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0 || isMutating}
            aria-label="Mark all notifications as read"
          >
            {isMutating ? (
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCheck className="w-3 h-3" aria-hidden="true" />
            )}
            Mark all read
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {/* §181 error state — what happened / work is safe / recovery */}
        {error && !isLoading && (
          <div
            role="alert"
            className="px-3 py-2.5 rounded-lg border text-xs space-y-1.5"
            style={{ borderColor: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}
          >
            <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
              Couldn't load notifications.
            </p>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Your read state is safe on the server.
            </p>
            <Button size="sm" variant="outline" onClick={onRefresh}>
              Retry
            </Button>
          </div>
        )}

        {/* §180 loading — skeletons for content */}
        {isLoading && notifications.length === 0 && (
          <div className="space-y-2 p-1" data-testid="notifications-loading">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-2.5 px-2 py-2">
                <Skeleton className="w-4 h-4 rounded-full mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* §179 empty state — what / why / next */}
        {!isLoading && !error && notifications.length === 0 && (
          <div className="text-center py-10 px-4 space-y-1">
            <Bell className="w-7 h-7 mx-auto opacity-40" aria-hidden="true" />
            <p className="text-xs font-semibold mt-2" style={{ color: 'var(--color-text)' }}>
              No notifications yet.
            </p>
            <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
              Mentions, approvals and task assignments land here the moment they happen.
            </p>
          </div>
        )}

        {!error &&
          notifications.map((n) => {
            const isUnread = n.read_at == null;
            return (
              <button
                key={n.id}
                onClick={() => onOpenNotification(n)}
                aria-label={`${n.title}${isUnread ? ' (unread)' : ''}`}
                className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg border transition-colors cursor-pointer focus-visible:shadow-[var(--focus-ring)] outline-none"
                style={{
                  borderColor: isUnread ? 'var(--color-info)' : 'var(--color-border)',
                  background: isUnread ? 'var(--color-info-bg)' : 'transparent',
                  opacity: isUnread ? 1 : 0.75,
                }}
              >
                <span
                  className="mt-0.5 shrink-0"
                  style={{ color: isUnread ? 'var(--color-info)' : 'var(--color-text-tertiary)' }}
                >
                  {notificationCategoryIcon(n.category)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                    {n.title}
                  </span>
                  {n.body && (
                    <span
                      className="block text-[11px] mt-0.5 line-clamp-2"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {n.body}
                    </span>
                  )}
                  <span className="block text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                    {notificationCategoryLabel(n.category)} ·{' '}
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </span>
                {/* §277 subtle unread badge */}
                {isUnread && (
                  <span
                    className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                    style={{ background: 'var(--color-info)' }}
                    aria-label="Unread"
                  />
                )}
              </button>
            );
          })}
      </div>

      {/* Footer → full Activity surface (§172) */}
      <div className="border-t px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
        <button
          onClick={onViewAllActivity}
          className="text-xs font-semibold cursor-pointer hover:underline focus-visible:shadow-[var(--focus-ring)] outline-none rounded"
          style={{ color: 'var(--color-info)' }}
          aria-label="View all activity"
        >
          View all activity
        </button>
      </div>
    </div>
  );
}
