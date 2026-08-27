/**
 * §119 Task card — compact anatomy:
 *
 *   title · owner · status · priority · due · related decision
 *
 * §53: Compact card showing: title, status badge, assignee avatar, priority indicator, due date.
 *      Click to expand full details.
 *
 * Interactions stay compact (§119): one status select, one owner select and
 * a Done affordance; priority/due/related-decision are read-only displays.
 */

import { useState } from 'react';
import { Calendar, Check, ChevronDown, ChevronUp, Link2, User as UserIcon } from 'lucide-react';
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

/** §53 status badge variant mapping. */
function statusVariant(status: Task['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'DONE':
      return 'success';
    case 'IN_PROGRESS':
      return 'warning';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
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
  const [isExpanded, setIsExpanded] = useState(false);
  const isTerminal = task.status === 'DONE' || task.status === 'CANCELLED';
  const due = dueLabel(task);
  const overdue = Boolean(due?.startsWith('Overdue')) && !isTerminal;

  return (
    <div
      data-testid="task-card"
      className={cn(
        'rounded-lg border transition-colors text-xs',
        isTerminal
          ? 'opacity-60'
          : 'hover:border-[var(--color-border-strong)]',
        overdue && 'border-[var(--color-warning)]',
      )}
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface-raised)',
      }}
      role="article"
      aria-label={`Task: ${task.title}, Status: ${task.status}`}
    >
      {/* §53 compact card — click to expand */}
      <div
        className="p-3 cursor-pointer"
        onClick={() => setIsExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} task details: ${task.title}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* §53 status badge */}
              <Badge variant={statusVariant(task.status)} size="sm">
                {task.status.replace('_', ' ')}
              </Badge>
              <span
                className={cn(
                  'font-semibold',
                  isTerminal && 'line-through decoration-[var(--color-text-tertiary)]',
                )}
                style={{ color: 'var(--color-text)' }}
              >
                {task.title}
              </span>
              {/* §53 priority indicator */}
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

            {/* §53 assignee + due date row */}
            <div className="flex items-center gap-3 flex-wrap pt-0.5 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {/* §119 owner — assignment via the compact select beside it */}
              <span className="flex items-center gap-1" data-testid="task-owner">
                <UserIcon className="w-3 h-3" aria-hidden="true" /> {ownerName(task, members)}
              </span>
              {due && (
                <span
                  className={cn('flex items-center gap-1', overdue && 'font-semibold')}
                  style={{ color: overdue ? 'var(--color-warning)' : undefined }}
                >
                  <Calendar className="w-3 h-3" aria-hidden="true" /> {due}
                </span>
              )}
              {relatedDecisionLabel && task.related_decision_id && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToDecision?.(task.related_decision_id!);
                  }}
                  className="flex items-center gap-1 font-medium hover:underline cursor-pointer"
                  style={{ color: 'var(--color-text)' }}
                  data-testid="related-decision-link"
                  aria-label={`Related decision: ${relatedDecisionLabel}`}
                >
                  <Link2 className="w-3 h-3" aria-hidden="true" />
                  {relatedDecisionLabel}
                </button>
              )}
            </div>
          </div>

          {/* §53 expand/collapse indicator */}
          <span className="shrink-0 mt-1" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true">
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>
      </div>

      {/* §53 expanded details — description + compact interactions */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {task.description && (
            <p className="pt-2 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {task.description}
            </p>
          )}

          {/* Compact interactions (§119) */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {!isTerminal && task.status !== 'IN_PROGRESS' && (
              <button
                type="button"
                aria-label={`Start ${task.title}`}
                title="Mark in progress"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetStatus?.(task, 'IN_PROGRESS');
                }}
                className="p-1.5 rounded-md border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete?.(task);
                }}
                className="p-1.5 rounded-md border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-success)' }}
              >
                <Check className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
            <select
              aria-label={`Status for ${task.title}`}
              value={task.status}
              disabled={disabled}
              onChange={(e) => {
                e.stopPropagation();
                onSetStatus?.(task, e.target.value as Task['status']);
              }}
              onClick={(e) => e.stopPropagation()}
              className="px-2 py-1 rounded-md border text-[11px] font-semibold outline-none cursor-pointer disabled:opacity-50"
              style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)' }}
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
              onChange={(e) => {
                e.stopPropagation();
                onAssign?.(task, e.target.value === '' ? null : e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-28 px-2 py-1 rounded-md border text-[11px] font-semibold outline-none cursor-pointer disabled:opacity-50"
              style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)' }}
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
      )}
    </div>
  );
}
