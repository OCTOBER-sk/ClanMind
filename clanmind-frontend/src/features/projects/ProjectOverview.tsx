/**
 * Project Overview (FE §83) — the concise operating view: goal, pulse,
 * current focus, blocked, next, open decisions, active tasks, recent
 * artifacts/activity, GitHub status. Deliberately restrained — never a
 * cluttered dashboard (FE §325.20).
 */

import React from 'react';
import { ProjectPulse } from './ProjectPulse';
import { CheckSquare, Bookmark, Sparkles, GitBranch } from 'lucide-react';
import { Badge } from '@/design-system/components/Badge';
import type {
  Project,
  Task,
  Decision,
  Artifact,
  GroupMember,
  NotificationItem,
} from '@/types';

export interface ProjectOverviewProps {
  project: Project;
  tasks: Task[];
  decisions: Decision[];
  artifacts: Artifact[];
  members: GroupMember[];
  aiName: string;
  /** decisionId → "Decision #N" labels from the shared ordinal derivation. */
  decisionLabels: Map<string, string>;
  /** Compact §83 GitHub status line (null when nothing is connected). */
  githubSummary: { statusLabel: string; repoFullName: string } | null;
  /** Latest notifications feed the "recent activity" line. */
  recentActivity: NotificationItem[];
  onNavigateToSection: (section: 'chat' | 'tasks' | 'decisions' | 'garage' | 'github') => void;
}

function ownerName(task: Task, members: GroupMember[]): string {
  if (!task.owner_user_id) return 'Unassigned';
  const m = members.find((mem) => mem.user_id === task.owner_user_id);
  return m?.nickname ?? m?.user.name ?? 'Unknown';
}

export function ProjectOverview({
  project,
  tasks,
  decisions,
  artifacts,
  members,
  aiName,
  decisionLabels,
  githubSummary,
  recentActivity,
  onNavigateToSection,
}: ProjectOverviewProps) {
  const openTasks = tasks.filter(
    (t) => t.project_id === project.id && (t.status === 'TODO' || t.status === 'IN_PROGRESS'),
  );
  // §84 "Open decisions" — proposals awaiting a verdict.
  const openDecisions = decisions.filter(
    (d) => d.project_id === project.id && d.status === 'PROPOSED',
  );
  const approvedDecisions = decisions.filter(
    (d) => d.project_id === project.id && d.status === 'APPROVED',
  );

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

      {/* §84 Project Pulse widget */}
      <ProjectPulse
        project={project}
        aiName={aiName}
        unresolvedDecisionCount={openDecisions.length}
        onNavigateToDecisions={() => onNavigateToSection('decisions')}
      />

      {/* 2-Column Summary: Tasks & Decisions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Tasks Box */}
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs text-[var(--color-text)] flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-500" aria-hidden="true" />
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
                    Owner: {ownerName(task, members)}
                  </span>
                </div>
                <Badge
                  variant={task.priority === 'HIGH' || task.priority === 'URGENT' ? 'danger' : 'neutral'}
                  size="sm"
                >
                  {task.status}
                </Badge>
              </div>
            ))}
            {openTasks.length === 0 && (
              <p className="text-[11px] text-[var(--color-text-tertiary)]">
                No active tasks — everything is done or cancelled.
              </p>
            )}
          </div>
        </div>

        {/* Open Decisions Box */}
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs text-[var(--color-text)] flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-emerald-500" aria-hidden="true" />
              <span>Open Decisions ({openDecisions.length})</span>
            </h3>
            <button
              onClick={() => onNavigateToSection('decisions')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>

          <div className="space-y-2">
            {(openDecisions.length > 0 ? openDecisions : approvedDecisions).slice(0, 3).map((dec) => (
              <div
                key={dec.id}
                className="p-2.5 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[var(--color-text)] truncate pr-2">
                    {decisionLabels.get(dec.id) ?? 'Decision'}: {dec.title}
                  </span>
                  <Badge variant={dec.status === 'APPROVED' ? 'success' : 'warning'} size="sm">
                    {dec.status}
                  </Badge>
                </div>
                {dec.rationale && (
                  <p className="text-[11px] text-gray-500 line-clamp-1">{dec.rationale}</p>
                )}
              </div>
            ))}
            {openDecisions.length === 0 && approvedDecisions.length === 0 && (
              <p className="text-[11px] text-[var(--color-text-tertiary)]">
                Nothing proposed yet — ask {aiName} to draft one.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Artifacts Section (§83) */}
      {artifacts.filter((a) => a.project_id === project.id).length > 0 && (
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs text-[var(--color-text)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" aria-hidden="true" />
              <span>Recent Artifacts ({artifacts.filter((a) => a.project_id === project.id).length})</span>
            </h3>
            <button
              onClick={() => onNavigateToSection('garage')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Open Garage
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {artifacts
              .filter((a) => a.project_id === project.id)
              .slice(0, 3)
              .map((art) => (
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

      {/* GitHub status + recent activity — one compact row each (§83) */}
      {(githubSummary || recentActivity.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {githubSummary && (
            <button
              onClick={() => onNavigateToSection('github')}
              className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-sm text-xs cursor-pointer hover:border-gray-400 dark:hover:border-gray-600 transition-colors text-left"
            >
              <span className="flex items-center gap-2 font-semibold text-[var(--color-text)] min-w-0">
                <GitBranch className="w-4 h-4 shrink-0 text-purple-500" aria-hidden="true" />
                <span className="truncate">{githubSummary.repoFullName}</span>
              </span>
              <Badge variant="neutral" size="sm">{githubSummary.statusLabel}</Badge>
            </button>
          )}
          {recentActivity.length > 0 && (
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-sm text-xs space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Recent Activity
              </span>
              {recentActivity.map((n) => (
                <p key={n.id} className="truncate text-[var(--color-text-secondary)]">
                  · {n.title}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
