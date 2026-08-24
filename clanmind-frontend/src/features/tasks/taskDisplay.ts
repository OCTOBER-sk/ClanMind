/**
 * §119 card display helpers — shared by the card, tests and the Overview.
 */

import type { GroupMember, Task, TaskPriority } from '@/types';

/** Due-date urgency copy — overdue reads as a warning, never an alarm. */
export function dueLabel(task: Task): string | null {
  if (!task.due_at) return null;
  const due = new Date(task.due_at);
  const now = new Date();
  // Exact calendar-day difference (no fractional-day drift).
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);
  if (diffDays < 0) return `Overdue · ${due.toLocaleDateString()}`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due ${due.toLocaleDateString()}`;
}

export function ownerName(task: Task, members: GroupMember[]): string {
  if (task.owner_user_id == null) return 'Unassigned';
  const member = members.find((m) => m.user_id === task.owner_user_id);
  return member?.nickname ?? member?.user.name ?? 'Unknown member';
}

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};
