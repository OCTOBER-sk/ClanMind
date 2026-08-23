import React from 'react';
import { Bell, MessageSquare, GitPullRequest, AlertCircle } from 'lucide-react';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import type { NotificationCategory } from '@/types';

/**
 * §172 Activity — the user attention view: mentions, replies, reactions,
 * approvals, task assignments, key AI events. §277 read state.
 *
 * Notification categories map 1:1 to backend identifiers (§171).
 */
const categoryLabel: Record<NotificationCategory, string> = {
  MENTION: 'Mention',
  PRIVATE_MESSAGE: 'Private',
  AI_RESPONSE: 'AI',
  AI_ACTION_APPROVAL: 'Approval',
  TASK_ASSIGNMENT: 'Task',
  DECISION_APPROVAL: 'Decision',
  ARTIFACT_READY: 'Artifact',
  GITHUB_EVENT: 'GitHub',
  MEETING_SUMMARY: 'Meeting',
  PROACTIVE_AI: 'Odin suggestion',
  SYSTEM: 'System',
};

function categoryIcon(category: NotificationCategory) {
  if (category === 'GITHUB_EVENT') return <GitPullRequest className="w-3.5 h-3.5" aria-hidden="true" />;
  if (category === 'SYSTEM' || category === 'PROACTIVE_AI')
    return <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />;
  if (category === 'MENTION' || category === 'PRIVATE_MESSAGE')
    return <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />;
  return <Bell className="w-3.5 h-3.5" aria-hidden="true" />;
}

export interface ActivityViewProps {
  onNavigate: (route: string) => void;
}

export function ActivityView({ onNavigate }: ActivityViewProps) {
  const { notifications, markNotificationAsRead } = useProjectDataStore();

  const unread = notifications.filter((n) => !n.is_read).length;

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

        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              if (!n.is_read) markNotificationAsRead(n.id);
              onNavigate(n.target_route);
            }}
            className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer"
            style={{
              borderColor: 'var(--color-border)',
              background: n.is_read ? 'transparent' : 'var(--color-info-bg)',
            }}
          >
            <span
              className="mt-0.5 shrink-0"
              style={{ color: n.is_read ? 'var(--color-text-tertiary)' : 'var(--color-info)' }}
            >
              {categoryIcon(n.category)}
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
                {categoryLabel[n.category]} · {new Date(n.created_at).toLocaleString()}
              </span>
            </span>
            {!n.is_read && (
              <span
                className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                style={{ background: 'var(--color-info)' }}
                aria-label="Unread"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}