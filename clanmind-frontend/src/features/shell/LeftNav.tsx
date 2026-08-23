/**
 * LeftNav — §17 Left Navigation
 * Order: Projects → [project tools] → Team → Garage → Activity → Settings.
 * No "Workspace" terminology (§2 / §15). Semantic tokens only (§4).
 */
import React from 'react';
import {
  MessageSquare,
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Bookmark,
  Users,
  Folder,
  Settings,
  BookOpen,
  Bell,
  Plus,
  Zap,
} from 'lucide-react';
import { cn } from '@/design-system/utils';
import type { Project, MainNavSection } from '@/types';

export interface LeftNavProps {
  projects: Project[];
  activeProject: Project | null;
  activeSection: MainNavSection;
  onSelectSection: (section: MainNavSection) => void;
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
  /** Unread counts per nav section (used for badge display) */
  unreadCounts?: Partial<Record<MainNavSection, number>>;
}

interface NavItem {
  id: MainNavSection;
  label: string;
  icon: React.ReactNode;
}

// §17: flat, minimal navigation — no huge hierarchical tree.
const NAV_ITEMS: NavItem[] = [
  { id: 'chat', label: 'Main Chat', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'overview', label: 'Project Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-4 h-4" /> },
  { id: 'decisions', label: 'Decisions', icon: <Bookmark className="w-4 h-4" /> },
  { id: 'memory', label: 'Team Memory', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
  { id: 'garage', label: 'Garage', icon: <Folder className="w-4 h-4" /> },
  { id: 'activity', label: 'Activity', icon: <Bell className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

const activeNavClass =
  'bg-[var(--color-primary)] text-[var(--color-primary-fg)] shadow-[var(--shadow-sm)]';
const idleNavClass = 'hover:bg-[var(--color-surface-hover)]';

export const LeftNav = React.memo(function LeftNav({
  projects,
  activeProject,
  activeSection,
  onSelectSection,
  onSelectProject,
  onCreateProject,
  unreadCounts = {},
}: LeftNavProps) {
  return (
    <nav
      aria-label="Main navigation"
      className="w-60 h-full flex flex-col justify-between p-3 select-none text-xs shrink-0"
      style={{
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      <div className="space-y-5 overflow-y-auto flex-1 min-h-0">
        {/* ── Projects section ───────────────────────────────────── */}
        <section aria-labelledby="nav-projects-label">
          <div className="flex items-center justify-between px-2.5 mb-1.5">
            <span
              id="nav-projects-label"
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Projects
            </span>
            <button
              onClick={onCreateProject}
              aria-label="Create new project"
              className="p-0.5 rounded transition-colors cursor-pointer hover:opacity-80"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {projects.map((proj) => {
              const isActive = activeProject?.id === proj.id;
              return (
                <button
                  key={proj.id}
                  onClick={() => onSelectProject(proj)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left',
                    isActive
                      ? 'bg-[var(--color-info-bg)]'
                      : idleNavClass
                  )}
                  style={
                    isActive
                      ? { color: 'var(--color-info)' }
                      : { color: 'var(--color-text-secondary)' }
                  }
                >
                  <span className="truncate flex items-center gap-2">
                    <FolderKanban className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden="true" />
                    {proj.name}
                    {proj.status === 'archived' && (
                      <span className="text-[9px] uppercase tracking-wide opacity-70">archived</span>
                    )}
                  </span>
                  <span className="text-[10px] font-mono opacity-60">{proj.pulse_progress}%</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Navigation items (§17 order) ───────────────────────── */}
        <section aria-label="Sections">
          <div className="space-y-0.5" role="list">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              const unread = unreadCounts[item.id] ?? 0;
              return (
                <button
                  key={item.id}
                  role="listitem"
                  onClick={() => onSelectSection(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left',
                    isActive ? activeNavClass : idleNavClass
                  )}
                  style={
                    !isActive ? { color: 'var(--color-text-secondary)' } : undefined
                  }
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {/* Unread badge (§172/§277) */}
                  {unread > 0 && !isActive && (
                    <span
                      aria-label={`${unread} unread`}
                      className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                      style={{ background: 'var(--color-info)', color: '#fff' }}
                    >
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Bottom status indicator ──────────────────────────────── */}
      <div
        className="pt-2 mt-2 text-[11px] px-2 flex items-center justify-between"
        style={{
          borderTop: '1px solid var(--color-border)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        <span className="truncate flex items-center gap-1.5">
          <Zap className="w-3 h-3" aria-hidden="true" />
          Odin AI Active
        </span>
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: 'var(--color-success)' }}
        />
      </div>
    </nav>
  );
});