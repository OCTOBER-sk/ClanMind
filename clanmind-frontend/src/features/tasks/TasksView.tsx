/**
 * Tasks view (FE §82 project section + §119). Renders the Project-scoped
 * §48 task list with status filters, the §119 card anatomy and compact
 * interactions. Empty states follow §179: what is empty, why it matters,
 * what to do next.
 *
 * §52: Task list with status (todo, in-progress, done, blocked). Assignee, priority, due date.
 *      Filter by status, assignee, project.
 */

import React, { useMemo, useState } from 'react';
import { Plus, CheckSquare, Filter } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { Button } from '@/design-system/components/Button';
import { EmptyState } from '@/design-system/components/EmptyState';
import { Skeleton } from '@/design-system/components/Skeleton';
import { cn } from '@/design-system/utils';
import type { GroupMember, Task, TaskStatus } from '@/types';

export interface TasksViewProps {
  tasks: Task[];
  members: GroupMember[];
  isLoading?: boolean;
  error?: string | null;
  onAddTask: () => void;
  onSetStatus: (task: Task, status: TaskStatus) => void;
  onAssign: (task: Task, ownerUserId: string | null) => void;
  onComplete: (task: Task) => void;
  /** decisionId → "Decision #3" label for §119 related-decision links. */
  relatedDecisionLabels?: Map<string, string>;
  onNavigateToDecision?: (decisionId: string) => void;
}

const FILTERS: Array<{ key: 'all' | TaskStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'DONE', label: 'Done' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export function TasksView({
  tasks,
  members,
  isLoading,
  error,
  onAddTask,
  onSetStatus,
  onAssign,
  onComplete,
  relatedDecisionLabels,
  onNavigateToDecision,
}: TasksViewProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | TaskStatus>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  // §52 filter by status AND assignee
  const filteredTasks = useMemo(
    () =>
      tasks
        .filter((t) => (filterStatus === 'all' ? true : t.status === filterStatus))
        .filter((t) => {
          if (filterAssignee === 'all') return true;
          if (filterAssignee === 'unassigned') return !t.owner_user_id;
          return t.owner_user_id === filterAssignee;
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [tasks, filterStatus, filterAssignee],
  );

  const openCount = tasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS').length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 border-b px-6 py-4"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div>
          <h1 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>
            Tasks
          </h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {openCount} open · actionable work linked to team decisions.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={onAddTask}
          aria-label="Create new task"
        >
          New Task
        </Button>
      </div>

      {/* §52 Filter Chips — status + assignee */}
      <div
        className="flex items-center justify-between gap-3 overflow-x-auto px-6 py-2.5 border-b"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="flex items-center gap-1.5" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => {
            const count =
              f.key === 'all' ? tasks.length : tasks.filter((t) => t.status === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                aria-pressed={filterStatus === f.key}
                data-testid={`filter-${f.key}`}
                className={cn(
                  'shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer',
                  filterStatus === f.key
                    ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]',
                )}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>

        {/* §52 assignee filter */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Filter className="w-3 h-3" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            aria-label="Filter by assignee"
            className="px-2 py-1 rounded-md border text-[11px] font-semibold outline-none cursor-pointer"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <option value="all">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.nickname || m.user.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error — §64: what happened, what is safe, next action */}
      {error && (
        <div
          role="alert"
          className="px-6 py-2.5 text-xs border-b flex items-center justify-between gap-3"
          style={{ color: 'var(--color-danger)', background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={onAddTask} aria-label="Retry">
            Retry
          </Button>
        </div>
      )}

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2" aria-busy={isLoading} role="list" aria-label="Task list">
        {/* §64 — skeleton loading, not universal spinner */}
        {isLoading && filteredTasks.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-lg border space-y-2"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
              >
                <div className="flex items-center gap-2">
                  <Skeleton variant="text" className="h-3.5 w-40" />
                  <Skeleton variant="text" className="h-4 w-14 rounded-full" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton variant="text" className="h-2.5 w-20" />
                  <Skeleton variant="text" className="h-2.5 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <EmptyTasks filterStatus={filterStatus} onAddTask={onAddTask} />
        ) : (
          filteredTasks.map((task) => (
            <div key={task.id} role="listitem">
              <TaskCard
                task={task}
                members={members}
                onSetStatus={onSetStatus}
                onAssign={onAssign}
                onComplete={onComplete}
                relatedDecisionLabel={
                  task.related_decision_id
                    ? relatedDecisionLabels?.get(task.related_decision_id) ?? null
                    : null
                }
                onNavigateToDecision={onNavigateToDecision}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** §179 — empty state explains what / why / next. */
function EmptyTasks({
  filterStatus,
  onAddTask,
}: {
  filterStatus: string;
  onAddTask: () => void;
}) {
  return (
    <div data-testid="tasks-empty">
      <EmptyState
        icon={<CheckSquare className="w-8 h-8" />}
        title={
          filterStatus === 'all'
            ? 'No tasks in this project yet.'
            : `No ${filterStatus.replace('_', ' ').toLowerCase()} tasks.`
        }
        description="Tasks track the concrete work your decisions create — assign owners and due dates so nothing drifts."
        actions={
          filterStatus === 'all' ? (
            <Button size="sm" variant="ghost" onClick={onAddTask} aria-label="Create the first task">
              Create the first task
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
