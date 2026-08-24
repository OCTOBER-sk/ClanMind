import React from 'react';
import { Bell } from 'lucide-react';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import {
  notificationCategoryIcon,
  notificationCategoryLabel,
} from './notificationDisplay';

/**
 * §172 Activity — the user attention view backed by BOTH feeds:
 *   • §95A notifications ("For you": mentions, approvals, assignments…)
 *   • §98A group activity events (summaries rendered verbatim)
 *
 * §277 read state: unread items carry a subtle badge; opening one marks it
 * read through the controller (server POST /notifications/:id/read).
 * Notification categories map 1:1 to backend identifiers (§171).
 */

export interface ActivityViewProps {
  onNavigate: (route: string) => void;
  /** Controller-backed mark-read (optimistic + server POST). */
  onMarkRead: (notificationId: string) => void;
}

export function ActivityView({ onNavigate, onMarkRead }: ActivityViewProps) {
  const { notifications, activityEvents } = useProjectDataStore();

  const unread = notifications.filter((n) => n.read_at == null).length;

  return (
    <div className="h-full flex flex-col min-h-0" style={{ background: 'var(--color-background)' }}>
      <header className="px-6 pt-5 pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h1 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>
          Activity
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {unread > 0 ? `${unread} unread item${unread === 1 ? '' : 's'}` : 'You are all caught up.'}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {notifications.length === 0 && (
          <div className="text-center py-16 space-y-1">
            <Bell className="w-8 h-8 mx-auto opacity-40" aria-hidden="true" />
            {/* §179 empty state: what / why / next */}
            <p className="text-sm font-medium mt-3" style={{ color: 'var(--color-text)' }}>
              No activity yet.
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Mentions, approvals and AI events will appear here.
            </p>
          </div>
        )}

        {notifications.map((n) => {
          const isUnread = n.read_at == null;
          return (
            <button
              key={n.id}
              onClick={() => {
                if (isUnread) onMarkRead(n.id);
                onNavigate(n.target_route);
              }}
              aria-label={`${n.title}${isUnread ? ' (unread)' : ''}`}
              className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer focus-visible:shadow-[var(--focus-ring)] outline-none"
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
                  <span className="block text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                    {n.body}
                  </span>
                )}
                <span className="block text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  {notificationCategoryLabel(n.category)} · {new Date(n.created_at).toLocaleString()}
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

        {/* §172/§98A — the Group attention stream (pre-rendered summaries) */}
        {activityEvents.length > 0 && (
          <section className="pt-3">
            <h2
              className="text-[10px] font-bold uppercase tracking-wider mb-2"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Group activity
            </h2>
            <ul className="space-y-1">
              {activityEvents.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)' }}
                >
                  <span className="truncate flex-1">{e.summary}</span>
                  <span className="text-[10px] shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                    {new Date(e.occurred_at).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
