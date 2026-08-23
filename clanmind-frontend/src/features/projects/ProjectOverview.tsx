import React from 'react';
import { ProjectPulse } from './ProjectPulse';
import { CheckSquare, Bookmark, Sparkles } from 'lucide-react';
import { Badge } from '@/design-system/components/Badge';
import type { Project, Task, Decision, Artifact } from '@/types';

export interface ProjectOverviewProps {
  project: Project;
  tasks: Task[];
  decisions: Decision[];
  artifacts: Artifact[];
  onNavigateToSection: (section: 'chat' | 'tasks' | 'decisions' | 'garage') => void;
}

export function ProjectOverview({
  project,
  tasks,
  decisions,
  artifacts,
  onNavigateToSection,
}: ProjectOverviewProps) {
  const openTasks = tasks.filter((t) => t.status !== 'DONE');
  const approvedDecisions = decisions.filter((d) => d.status === 'APPROVED');

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-gray-50/40 dark:bg-gray-950 space-y-6">
      {/* Goal Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">
              {project.name}
            </h1>
            <Badge variant="neutral" size="sm">
              {project.project_type}
            </Badge>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
            {project.goal || project.description}
          </p>
        </div>
      </div>

      {/* Project Pulse Widget */}
      <ProjectPulse
        project={project}
        onNavigateToDecisions={() => onNavigateToSection('decisions')}
      />

      {/* 2-Column Summary: Tasks & Decisions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Tasks Box */}
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs text-[var(--color-text)] flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-500" />
              <span>Active Tasks ({openTasks.length})</span>
            </h3>
            <button
              onClick={() => onNavigateToSection('tasks')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>

          <div className="space-y-2">
            {openTasks.slice(0, 3).map((task) => (
              <div
                key={task.id}
                className="p-2.5 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs flex items-center justify-between"
              >
                <div className="truncate pr-2">
                  <p className="font-medium text-[var(--color-text)] truncate">
                    {task.title}
                  </p>
                  <span className="text-[10px] text-gray-400">
                    Assignee: {task.assignee_name || 'Unassigned'}
                  </span>
                </div>
                <Badge
                  variant={task.priority === 'HIGH' ? 'danger' : 'neutral'}
                  size="sm"
                >
                  {task.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Key Decisions Box */}
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs text-[var(--color-text)] flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-emerald-500" />
              <span>Approved Decisions ({approvedDecisions.length})</span>
            </h3>
            <button
              onClick={() => onNavigateToSection('decisions')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>

          <div className="space-y-2">
            {decisions.slice(0, 3).map((dec) => (
              <div
                key={dec.id}
                className="p-2.5 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[var(--color-text)]">
                    Decision #{dec.decision_number}: {dec.title}
                  </span>
                  <Badge variant="success" size="sm">
                    {dec.status}
                  </Badge>
                </div>
                <p className="text-[11px] text-gray-500 line-clamp-1">{dec.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Artifacts Section (§83) */}
      {artifacts.length > 0 && (
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs text-[var(--color-text)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Recent Artifacts ({artifacts.length})</span>
            </h3>
            <button
              onClick={() => onNavigateToSection('garage')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Open Garage
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {artifacts.slice(0, 3).map((art) => (
              <div
                key={art.id}
                onClick={() => onNavigateToSection('garage')}
                className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
              >
                <div className="font-semibold text-[var(--color-text)] truncate mb-1">
                  {art.title}
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <Badge variant="neutral" size="sm">{art.artifact_type}</Badge>
                  <span>v{art.current_version}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
