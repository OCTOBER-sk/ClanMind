/**
 * Tasks view (FE §82 project section + §119). Renders the Project-scoped
 * §48 task list with status filters, the §119 card anatomy and compact
 * interactions. Empty states follow §179: what is empty, why it matters,
 * what to do next.
 */

import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { Button } from '@/design-system/components/Button';
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

  const filteredTasks = useMemo(
    () =>
      tasks
        .filter((t) => (filterStatus === 'all' ? true : t.status === filterStatus))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [tasks, filterStatus],
  );

  const openCount = tasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS').length;

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-raised)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Tasks</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {openCount} open · actionable work linked to team decisions.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={onAddTask}
        >
          New Task
        </Button>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--color-border)]">
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
                'px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer',
                filterStatus === f.key
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'text-[var(--color-text-secondary)] hover:bg-gray-200 dark:hover:bg-gray-800',
              )}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="px-6 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900"
        >
          {error}
        </div>
      )}

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3" aria-busy={isLoading}>
        {isLoading && filteredTasks.length === 0 ? (
          <p className="text-center py-12 text-gray-400 text-xs">Loading tasks…</p>
        ) : filteredTasks.length === 0 ? (
          <EmptyTasks filterStatus={filterStatus} onAddTask={onAddTask} />
        ) : (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
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
    <div className="text-center py-12 space-y-1" data-testid="tasks-empty">
      <p className="text-sm font-semibold text-[var(--color-text)]">
        {filterStatus === 'all'
          ? 'No tasks in this project yet.'
          : `No ${filterStatus.replace('_', ' ').toLowerCase()} tasks.`}
      </p>
      <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto leading-relaxed">
        Tasks track the concrete work your decisions create — assign owners and due dates so nothing drifts.
      </p>
      {filterStatus === 'all' && (
        <Button size="sm" variant="ghost" onClick={onAddTask} className="mt-2">
          Create the first task
        </Button>
      )}
    </div>
  );
}
