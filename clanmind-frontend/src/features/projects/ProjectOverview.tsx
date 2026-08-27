/**
 * Project Overview (FE §83) — the concise operating view: goal, pulse,
 * current focus, blocked, next, open decisions, active tasks, recent
 * artifacts/activity, GitHub status. Deliberately restrained — never a
 * cluttered dashboard (FE §325.20).
 *
 * §21: Project name, Goal, Description, Project type, Members, AI identity, recent activity
 * §23: Empty state — Project name, Goal, 'Nothing is built yet.'
 */

import React from 'react';
import { ProjectPulse } from './ProjectPulse';
import {
  CheckSquare,
  Bookmark,
  Sparkles,
  GitBranch,
  MessageSquare,
  Search,
  Brain,
  Users,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { Badge } from '@/design-system/components/Badge';
import { EmptyState } from '@/design-system/components/EmptyState';
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
  onNavigateToSection: (section: 'chat' | 'tasks' | 'decisions' | 'garage' | 'github' | 'memory') => void;
}

function ownerName(task: Task, members: GroupMember[]): string {
  if (!task.owner_user_id) return 'Unassigned';
  const m = members.find((mem) => mem.user_id === task.owner_user_id);
  return m?.nickname ?? m?.user.name ?? 'Unknown';
}

/** §21 Quick actions — primary entry points for project work. */
const QUICK_ACTIONS: Array<{
  id: 'chat' | 'tasks' | 'garage' | 'memory';
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  { id: 'chat', label: 'Chat', description: 'Discuss with team & AI', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'tasks', label: 'Tasks', description: 'Track actionable work', icon: <CheckSquare className="w-4 h-4" /> },
  { id: 'garage', label: 'Research', description: 'Browse artifacts & files', icon: <Search className="w-4 h-4" /> },
  { id: 'memory', label: 'Memory', description: 'View saved context', icon: <Brain className="w-4 h-4" /> },
];

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
  const projectArtifacts = artifacts.filter((a) => a.project_id === project.id);

  // §23 — detect truly empty project (nothing built yet)
  const isEmpty =
    openTasks.length === 0 &&
    projectArtifacts.length === 0 &&
    openDecisions.length === 0 &&
    approvedDecisions.length === 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ background: 'var(--color-background)' }}>
      {/* §21 Goal Header — project name, type, goal, members */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
              {project.name}
            </h1>
            <Badge variant="neutral" size="sm">
              {project.project_type}
            </Badge>
          </div>
          <p className="text-xs max-w-2xl leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {project.goal || project.description || 'No goal set yet.'}
          </p>
          {/* §21 Members row */}
          {members.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Users className="w-3 h-3" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
              <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                {members.length} member{members.length !== 1 ? 's' : ''} · {aiName} is active
              </span>
            </div>
          )}
        </div>
      </div>

      {/* §21 Quick Actions — primary entry points */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Quick actions">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => onNavigateToSection(action.id)}
            className="flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all hover:border-[var(--color-border-strong)] cursor-pointer group"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
            aria-label={`${action.label}: ${action.description}`}
          >
            <span
              className="p-1.5 rounded-md transition-colors group-hover:bg-[var(--color-surface-hover)]"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {action.icon}
            </span>
            <div className="min-w-0">
              <span className="block text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                {action.label}
              </span>
              <span className="block text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                {action.description}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* §84 Project Pulse widget */}
      <ProjectPulse
        project={project}
        aiName={aiName}
        unresolvedDecisionCount={openDecisions.length}
        onNavigateToDecisions={() => onNavigateToSection('decisions')}
      />

      {/* §23 Empty State — Nothing is built yet */}
      {isEmpty ? (
        <EmptyState
          icon={<Zap className="w-8 h-8" />}
          title="Nothing is built yet."
          description={`Start by discussing your goal with ${aiName}, researching the problem, adding references, creating a plan, or connecting GitHub.`}
          actions={
            <>
              <button
                onClick={() => onNavigateToSection('chat')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                aria-label="Start a discussion"
              >
                <MessageSquare className="w-3 h-3" /> Discuss
              </button>
              <button
                onClick={() => onNavigateToSection('garage')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors cursor-pointer"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                aria-label="Add references"
              >
                <Search className="w-3 h-3" /> Add references
              </button>
            </>
          }
        />
      ) : (
        <>
          {/* 2-Column Summary: Tasks & Decisions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Active Tasks Box */}
            <div
              className="p-4 rounded-lg border space-y-2.5"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                  <CheckSquare className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
                  <span>Active Tasks ({openTasks.length})</span>
                </h3>
                <button
                  onClick={() => onNavigateToSection('tasks')}
                  className="text-[11px] font-semibold hover:underline cursor-pointer"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-label="View all tasks"
                >
                  View all
                </button>
              </div>

              <div className="space-y-1.5">
                {openTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className="p-2 rounded-md text-xs flex items-center justify-between"
                    style={{ background: 'var(--color-surface-hover)' }}
                  >
                    <div className="truncate pr-2">
                      <p className="font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {task.title}
                      </p>
                      <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                        {ownerName(task, members)}
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
                  <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    No active tasks — everything is done or cancelled.
                  </p>
                )}
              </div>
            </div>

            {/* Open Decisions Box */}
            <div
              className="p-4 rounded-lg border space-y-2.5"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                  <Bookmark className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
                  <span>Decisions ({openDecisions.length})</span>
                </h3>
                <button
                  onClick={() => onNavigateToSection('decisions')}
                  className="text-[11px] font-semibold hover:underline cursor-pointer"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-label="View all decisions"
                >
                  View all
                </button>
              </div>

              <div className="space-y-1.5">
                {(openDecisions.length > 0 ? openDecisions : approvedDecisions).slice(0, 3).map((dec) => (
                  <div
                    key={dec.id}
                    className="p-2 rounded-md text-xs"
                    style={{ background: 'var(--color-surface-hover)' }}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold truncate pr-2" style={{ color: 'var(--color-text)' }}>
                        {decisionLabels.get(dec.id) ?? 'Decision'}: {dec.title}
                      </span>
                      <Badge variant={dec.status === 'APPROVED' ? 'success' : 'warning'} size="sm">
                        {dec.status}
                      </Badge>
                    </div>
                    {dec.rationale && (
                      <p className="text-[11px] line-clamp-1" style={{ color: 'var(--color-text-secondary)' }}>{dec.rationale}</p>
                    )}
                  </div>
                ))}
                {openDecisions.length === 0 && approvedDecisions.length === 0 && (
                  <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    Nothing proposed yet — ask {aiName} to draft one.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Artifacts Section (§83) */}
          {projectArtifacts.length > 0 && (
            <div
              className="p-4 rounded-lg border space-y-2.5"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                  <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
                  <span>Artifacts ({projectArtifacts.length})</span>
                </h3>
                <button
                  onClick={() => onNavigateToSection('garage')}
                  className="text-[11px] font-semibold hover:underline cursor-pointer"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-label="Open Garage"
                >
                  Open Garage
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {projectArtifacts.slice(0, 3).map((art) => (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => onNavigateToSection('garage')}
                    className="p-2.5 rounded-md text-xs cursor-pointer transition-colors text-left w-full"
                    style={{ background: 'var(--color-surface-hover)' }}
                    aria-label={`Open artifact: ${art.title}`}
                  >
                    <span className="block font-semibold truncate mb-0.5" style={{ color: 'var(--color-text)' }}>
                      {art.title}
                    </span>
                    <span className="flex items-center justify-between text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      <Badge variant="neutral" size="sm">{art.artifact_type}</Badge>
                      <span>v{art.current_version}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* GitHub status + recent activity — one compact row each (§83) */}
          {(githubSummary || recentActivity.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {githubSummary && (
                <button
                  onClick={() => onNavigateToSection('github')}
                  className="flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer transition-colors text-left"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
                  aria-label={`GitHub: ${githubSummary.repoFullName}`}
                >
                  <span className="flex items-center gap-2 font-semibold min-w-0" style={{ color: 'var(--color-text)' }}>
                    <GitBranch className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
                    <span className="truncate">{githubSummary.repoFullName}</span>
                  </span>
                  <Badge variant="neutral" size="sm">{githubSummary.statusLabel}</Badge>
                </button>
              )}
              {recentActivity.length > 0 && (
                <div
                  className="p-3 rounded-lg border text-xs space-y-1"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--color-text-tertiary)' }}>
                    Recent Activity
                  </span>
                  {recentActivity.map((n) => (
                    <p key={n.id} className="truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      · {n.title}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
