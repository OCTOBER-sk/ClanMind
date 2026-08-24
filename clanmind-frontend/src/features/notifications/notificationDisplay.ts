/**
 * §171 notification display vocabulary — shared by the Activity surface and
 * the notification center so category labels/icons can never drift apart.
 * Labels are the FE §171 paraphrase of the exact backend identifiers.
 */

import { createElement, type ReactNode } from 'react';
import { Bell, MessageSquare, GitPullRequest, AlertCircle, CheckSquare } from 'lucide-react';
import type { NotificationCategory } from '@/types';

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
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

export function notificationCategoryLabel(category: NotificationCategory | string): string {
  return (
    NOTIFICATION_CATEGORY_LABELS[category as NotificationCategory] ?? 'System'
  );
}

/** Unknown categories degrade to a generic icon — never a crash (§200 pattern). */
export function notificationCategoryIcon(
  category: NotificationCategory | string,
  className = 'w-3.5 h-3.5',
): ReactNode {
  if (category === 'GITHUB_EVENT') return createElement(GitPullRequest, { className, 'aria-hidden': true });
  if (category === 'TASK_ASSIGNMENT') return createElement(CheckSquare, { className, 'aria-hidden': true });
  if (category === 'SYSTEM' || category === 'PROACTIVE_AI')
    return createElement(AlertCircle, { className, 'aria-hidden': true });
  if (category === 'MENTION' || category === 'PRIVATE_MESSAGE')
    return createElement(MessageSquare, { className, 'aria-hidden': true });
  return createElement(Bell, { className, 'aria-hidden': true });
}

/**
 * §174 — the ONLY categories allowed to interrupt via OS notification:
 * mention, private message, approval request, task assignment, critical
 * system/security item. Everything else stays in-app (FE §174: do not
 * notify every chat message).
 */
export const IMPORTANT_OS_CATEGORIES: ReadonlySet<string> = new Set([
  'MENTION',
  'PRIVATE_MESSAGE',
  'AI_ACTION_APPROVAL',
  'TASK_ASSIGNMENT',
  'SYSTEM',
]);
