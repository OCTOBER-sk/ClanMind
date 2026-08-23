import React, { useState } from 'react';
import { Plus, Calendar, User as UserIcon } from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import { cn } from '@/design-system/utils';
import type { Task, TaskStatus } from '@/types';

export interface TasksViewProps {
  tasks: Task[];
  onAddTask: () => void;
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
}

export function TasksView({ tasks, onAddTask, onUpdateStatus }: TasksViewProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-raised)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Tasks</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Track and manage actionable engineering tasks linked to team decisions.
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
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--color-border)] bg-gray-50/50 dark:bg-gray-950">
        {['all', 'TODO', 'IN_PROGRESS', 'DONE'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={cn(
              'px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer',
              filterStatus === st
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'text-[var(--color-text-secondary)] hover:bg-gray-200 dark:hover:bg-gray-800'
            )}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-2xs hover:border-gray-400 dark:hover:border-gray-600 transition-colors flex items-center justify-between text-xs"
          >
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--color-text)]">
                  {task.title}
                </span>
                <Badge
                  variant={
                    task.priority === 'HIGH'
                      ? 'danger'
                      : task.priority === 'MEDIUM'
                      ? 'warning'
                      : 'neutral'
                  }
                  size="sm"
                >
                  {task.priority}
                </Badge>
              </div>
              {task.description && (
                <p className="text-gray-500 text-[11px] leading-relaxed line-clamp-2">
                  {task.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-[10px] text-gray-400 pt-1">
                <span className="flex items-center gap-1">
                  <UserIcon className="w-3 h-3" /> {task.assignee_name || 'Unassigned'}
                </span>
                {task.due_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Due {new Date(task.due_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* Status Select Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                value={task.status}
                onChange={(e) => onUpdateStatus(task.id, e.target.value as TaskStatus)}
                className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-[var(--color-surface-raised)] text-xs font-semibold text-[var(--color-text-secondary)] outline-none cursor-pointer"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
