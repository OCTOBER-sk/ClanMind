/**
 * §119 Task card — compact anatomy:
 *
 *   title · owner · status · priority · due · related decision
 *
 * Interactions stay compact (§119): one status select, one owner select and
 * a Done affordance; priority/due/related-decision are read-only displays.
 */

import { Calendar, Check, Link2, User as UserIcon } from 'lucide-react';
import { Badge } from '@/design-system/components/Badge';
import { cn } from '@/design-system/utils';
import { dueLabel, ownerName, PRIORITY_LABEL } from './taskDisplay';
import type { GroupMember, Task } from '@/types';

export interface TaskCardProps {
  task: Task;
  members: GroupMember[];
  /** §119 "related decision" — resolved + labelled by the parent when held. */
  relatedDecisionLabel?: string | null;
  onNavigateToDecision?: (decisionId: string) => void;
  onSetStatus?: (task: Task, status: Task['status']) => void;
  onAssign?: (task: Task, ownerUserId: string | null) => void;
  onComplete?: (task: Task) => void;
  disabled?: boolean;
}

export function TaskCard({
  task,
  members,
  relatedDecisionLabel,
  onNavigateToDecision,
  onSetStatus,
  onAssign,
  onComplete,
  disabled,
}: TaskCardProps) {
  const isTerminal = task.status === 'DONE' || task.status === 'CANCELLED';
  const due = dueLabel(task);
  const overdue = Boolean(due?.startsWith('Overdue')) && !isTerminal;

  return (
    <div
      data-testid="task-card"
      className={cn(
        'p-4 rounded-xl border bg-[var(--color-surface-raised)] shadow-2xs transition-colors text-xs',
        isTerminal ? 'border-[var(--color-border)] opacity-75' : 'border-[var(--color-border)] hover:border-gray-400 dark:hover:border-gray-600',
        overdue && 'border-amber-300 dark:border-amber-700/60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'font-semibold text-[var(--color-text)]',
                isTerminal && 'line-through decoration-gray-400',
              )}
            >
              {task.title}
            </span>
            <Badge
              variant={
                task.priority === 'URGENT' || task.priority === 'HIGH'
                  ? 'danger'
                  : task.priority === 'MEDIUM'
                    ? 'warning'
                    : 'neutral'
              }
              size="sm"
            >
              {PRIORITY_LABEL[task.priority] ?? task.priority}
            </Badge>
          </div>

          {task.description && (
            <p className="text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-4 flex-wrap pt-0.5 text-[10px] text-[var(--color-text-tertiary)]">
            {/* §119 owner — assignment via the compact select beside it */}
            <span className="flex items-center gap-1" data-testid="task-owner">
              <UserIcon className="w-3 h-3" aria-hidden="true" /> {ownerName(task, members)}
            </span>
            {due && (
              <span
                className={cn('flex items-center gap-1', overdue && 'font-semibold text-amber-600 dark:text-amber-400')}
              >
                <Calendar className="w-3 h-3" aria-hidden="true" /> {due}
              </span>
            )}
            {relatedDecisionLabel && task.related_decision_id && (
              <button
                type="button"
                onClick={() => onNavigateToDecision?.(task.related_decision_id!)}
                className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                data-testid="related-decision-link"
              >
                <Link2 className="w-3 h-3" aria-hidden="true" />
                {relatedDecisionLabel}
              </button>
            )}
          </div>
        </div>

        {/* Compact interactions (§119) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isTerminal && task.status !== 'IN_PROGRESS' && (
            <button
              type="button"
              aria-label={`Start ${task.title}`}
              title="Mark in progress"
              disabled={disabled}
              onClick={() => onSetStatus?.(task, 'IN_PROGRESS')}
              className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 12 12" className="w-3 h-3" aria-hidden="true">
                <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          )}
          {!isTerminal && (
            <button
              type="button"
              aria-label={`Complete ${task.title}`}
              title="Mark done"
              disabled={disabled}
              onClick={() => onComplete?.(task)}
              className="p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
          <select
            aria-label={`Status for ${task.title}`}
            value={task.status}
            disabled={disabled}
            onChange={(e) => onSetStatus?.(task, e.target.value as Task['status'])}
            className="px-2 py-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] font-semibold text-[var(--color-text-secondary)] outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            aria-label={`Owner for ${task.title}`}
            value={task.owner_user_id ?? ''}
            disabled={disabled}
            onChange={(e) => onAssign?.(task, e.target.value === '' ? null : e.target.value)}
            className="max-w-32 px-2 py-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] font-semibold text-[var(--color-text-secondary)] outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.nickname || m.user.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
