/**
 * §172 Activity — the user attention view backed by BOTH feeds:
 *   • §95A notifications ("For you": mentions, approvals, assignments…)
 *   • §98A group activity events (summaries rendered verbatim)
 *
 * §277 read state: unread items carry a subtle badge; opening one marks it
 * read through the controller (server POST /notifications/:id/read).
 * Notification categories map 1:1 to backend identifiers (§171).
 *
 * §56: Full activity feed with filters by category and read state.
 */

import React, { useMemo, useState } from 'react';
import { Bell, Filter } from 'lucide-react';
import { EmptyState } from '@/design-system/components/EmptyState';
import { cn } from '@/design-system/utils';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import {
  notificationCategoryIcon,
  notificationCategoryLabel,
} from './notificationDisplay';
import type { NotificationCategory } from '@/types';

export interface ActivityViewProps {
  onNavigate: (route: string) => void;
  /** Controller-backed mark-read (optimistic + server POST). */
  onMarkRead: (notificationId: string) => void;
}

type ReadFilter = 'all' | 'unread' | 'read';

const CATEGORY_FILTERS: Array<{ key: NotificationCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'MENTION', label: 'Mentions' },
  { key: 'TASK_ASSIGNMENT', label: 'Tasks' },
  { key: 'DECISION_APPROVAL', label: 'Decisions' },
  { key: 'AI_RESPONSE', label: 'AI' },
  { key: 'ARTIFACT_READY', label: 'Artifacts' },
  { key: 'GITHUB_EVENT', label: 'GitHub' },
];

export function ActivityView({ onNavigate, onMarkRead }: ActivityViewProps) {
  const { notifications, activityEvents } = useProjectDataStore();
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');

  const unread = notifications.filter((n) => n.read_at == null).length;

  // §56 filtered notifications
  const filteredNotifications = useMemo(() => {
    let list = notifications;
    if (categoryFilter !== 'all') {
      list = list.filter((n) => n.category === categoryFilter);
    }
    if (readFilter === 'unread') {
      list = list.filter((n) => n.read_at == null);
    } else if (readFilter === 'read') {
      list = list.filter((n) => n.read_at != null);
    }
    return list;
  }, [notifications, categoryFilter, readFilter]);

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

      {/* §56 Filter bar — category + read state */}
      <div
        className="flex items-center justify-between gap-3 px-6 py-2.5 border-b overflow-x-auto"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="flex items-center gap-1" role="group" aria-label="Filter by category">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setCategoryFilter(f.key)}
              aria-pressed={categoryFilter === f.key}
              aria-label={`Filter by ${f.label}`}
              className={cn(
                'shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer',
                categoryFilter === f.key
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Filter by read state">
          {(['all', 'unread', 'read'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setReadFilter(f)}
              aria-pressed={readFilter === f}
              className={cn(
                'shrink-0 px-2 py-1 text-[10px] font-semibold rounded-md transition-colors cursor-pointer capitalize',
                readFilter === f
                  ? 'bg-[var(--color-surface-hover)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)]',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredNotifications.length === 0 && activityEvents.length === 0 ? (
          <EmptyState
            icon={<Bell className="w-8 h-8" />}
            title={categoryFilter !== 'all' ? `No ${categoryFilter.toLowerCase().replace(/_/g, ' ')} activity.` : 'No activity yet.'}
            description="Mentions, approvals, task assignments, and AI events will appear here as your team works."
          />
        ) : (
          <>
            {filteredNotifications.map((n) => {
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
                <ul className="space-y-1" role="feed" aria-label="Group activity feed">
                  {activityEvents.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)' }}
                      role="article"
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
          </>
        )}
      </div>
    </div>
  );
}
