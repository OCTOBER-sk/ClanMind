/**
 * LeftNav — §17 Left Navigation, §20 Group Roles in UI, §303 Guest UX.
 * M3 restyle §14.0: navigation drawer (≥1200) icon+label active=secondary-container pill corner-full,
 * rail (900-1199) icon-only, <900 sheet via TopBar trigger. State layers via color-mix.
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
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/design-system/utils';
import { Badge } from '@/design-system/components/Badge';
import { Tooltip } from '@/design-system/components/Tooltip';
import type { GroupRole, MainNavSection, Project } from '@/types';

export interface LeftNavProps {
  projects: Project[];
  activeProject: Project | null;
  activeSection: MainNavSection;
  myRole?: GroupRole;
  aiName?: string;
  onSelectSection: (section: MainNavSection) => void;
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
  unreadCounts?: Partial<Record<MainNavSection, number>>;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  width?: number | 'fill';
}

interface NavItem {
  id: MainNavSection;
  label: string;
  icon: React.ReactNode;
}

const WORKBENCH_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-4 h-4" /> },
  { id: 'decisions', label: 'Decisions', icon: <Bookmark className="w-4 h-4" /> },
  { id: 'memory', label: 'Team Memory', icon: <BookOpen className="w-4 h-4" /> },
];

const TEAM_ITEMS: NavItem[] = [
  { id: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
  { id: 'garage', label: 'Garage', icon: <Folder className="w-4 h-4" /> },
  { id: 'activity', label: 'Activity', icon: <Bell className="w-4 h-4" /> },
];

const CHAT_ITEM: NavItem = { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> };
const SETTINGS_ITEM: NavItem = { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> };

/* M3 §14.0: active = secondary-container pill corner-full; idle = state-layer overlay only */
const activeNavClass =
  'bg-secondary-container text-on-secondary-container font-medium rounded-full';
const idleNavClass =
  'text-on-surface-variant hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)] rounded-full';
const RAIL_WIDTH_COLLAPSED_PX = 56;

export const LeftNav = React.memo(function LeftNav({
  projects,
  activeProject,
  myRole = 'MEMBER',
  aiName,
  activeSection,
  onSelectSection,
  onSelectProject,
  onCreateProject,
  unreadCounts = {},
  collapsed = false,
  onToggleCollapsed,
  width,
}: LeftNavProps) {
  const canManageProjects = myRole === 'OWNER' || myRole === 'ADMIN';
  const isGuest = myRole === 'GUEST';

  const sortedProjects =
    activeProject == null
      ? projects
      : [...projects].sort((a, b) =>
          a.id === activeProject.id ? -1 : b.id === activeProject.id ? 1 : 0,
        );

  const workbenchItems = activeProject ? WORKBENCH_ITEMS : [];
  const footerItems = isGuest ? [] : [SETTINGS_ITEM];

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        'h-full flex flex-col select-none text-xs shrink-0 overflow-hidden bg-surface-container-low border-r border-outline-variant',
        collapsed ? '' : 'p-3',
        width === 'fill' ? 'w-full' : '',
      )}
      style={
        width === 'fill'
          ? undefined
          : { width: collapsed ? RAIL_WIDTH_COLLAPSED_PX : (width ?? 240) }
      }
    >
      {collapsed ? (
        <div className="flex-1 min-h-0 flex flex-col items-center gap-1 py-2">
          {[CHAT_ITEM, ...workbenchItems, ...TEAM_ITEMS, ...footerItems].map((item) => (
            <RailIconButton
              key={item.id}
              item={item}
              active={activeSection === item.id}
              unread={unreadCounts[item.id] ?? 0}
              onSelect={() => onSelectSection(item.id)}
            />
          ))}
          <div className="mt-auto pt-2">
            {onToggleCollapsed && (
              <Tooltip content="Expand navigation" side="right">
                <button
                  onClick={onToggleCollapsed}
                  aria-label="Expand navigation"
                  aria-expanded={false}
                  className="p-2 rounded-full text-on-surface-variant transition-colors duration-micro ease-emphasized motion-reduce:transition-none cursor-pointer hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)] focus-visible:shadow-[var(--md-focus-ring)] outline-none"
                >
                  <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-5 overflow-y-auto flex-1 min-h-0">
            <section aria-label="Chat">
              <NavButtonRow
                item={CHAT_ITEM}
                active={activeSection === CHAT_ITEM.id}
                unread={unreadCounts[CHAT_ITEM.id] ?? 0}
                onSelect={() => onSelectSection(CHAT_ITEM.id)}
              />
            </section>

            <section aria-labelledby="nav-projects-label">
              <div className="flex items-center justify-between px-2.5 mb-1.5">
                <span
                  id="nav-projects-label"
                  className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant"
                >
                  Projects
                </span>
                {canManageProjects && (
                  <Tooltip content="Create new project" side="top">
                    <button
                      onClick={onCreateProject}
                      aria-label="Create new project"
                      className="p-1 rounded-full text-on-surface-variant transition-colors duration-micro ease-emphasized motion-reduce:transition-none cursor-pointer hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)] focus-visible:shadow-[var(--md-focus-ring)] outline-none"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </Tooltip>
                )}
              </div>

              <div className="space-y-0.5">
                {sortedProjects.map((proj) => {
                  const isActive = activeProject?.id === proj.id;
                  return (
                    <Tooltip key={proj.id} content={proj.name} side="right">
                      <button
                        onClick={() => onSelectProject(proj)}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors duration-micro ease-emphasized motion-reduce:transition-none cursor-pointer text-left outline-none focus-visible:shadow-[var(--md-focus-ring)]',
                          isActive ? activeNavClass : idleNavClass,
                        )}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <FolderKanban className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden="true" />
                          <span className="truncate">{proj.name}</span>
                          {proj.status === 'archived' && (
                            <span className="text-[9px] uppercase tracking-wide opacity-70">archived</span>
                          )}
                        </span>
                        <span className="text-[10px] font-mono opacity-60">{proj.pulse_progress}%</span>
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            </section>

            {workbenchItems.length > 0 && (
              <section aria-label="Project workbench">
                <div className="space-y-0.5" role="list">
                  {workbenchItems.map((item) => (
                    <NavButtonRow
                      key={item.id}
                      item={item}
                      active={activeSection === item.id}
                      unread={unreadCounts[item.id] ?? 0}
                      onSelect={() => onSelectSection(item.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section aria-label="Team spaces">
              <div className="space-y-0.5" role="list">
                {TEAM_ITEMS.map((item) => (
                  <NavButtonRow
                    key={item.id}
                    item={item}
                    active={activeSection === item.id}
                    unread={unreadCounts[item.id] ?? 0}
                    onSelect={() => onSelectSection(item.id)}
                  />
                ))}
              </div>
            </section>

            {footerItems.map((item) => (
              <section key={item.id} aria-label={item.label} className="pt-2 mt-2 border-t border-outline-variant">
                <NavButtonRow
                  item={item}
                  active={activeSection === item.id}
                  unread={unreadCounts[item.id] ?? 0}
                  onSelect={() => onSelectSection(item.id)}
                />
              </section>
            ))}
          </div>

          <div className="pt-2 mt-2 text-[11px] px-2 flex items-center justify-between gap-2 border-t border-outline-variant text-on-surface-variant">
            <span className="truncate flex items-center gap-1.5">
              <Zap className="w-3 h-3 shrink-0" aria-hidden="true" />
              {aiName ? `${aiName} AI Active` : 'AI Active'}
              {isGuest && (
                <Badge size="sm" variant="neutral" className="ml-1">
                  Guest
                </Badge>
              )}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              {onToggleCollapsed && (
                <Tooltip content="Collapse navigation" side="top">
                  <button
                    onClick={onToggleCollapsed}
                    aria-label="Collapse navigation"
                    aria-expanded={true}
                    className="p-1.5 rounded-full text-on-surface-variant transition-colors duration-micro ease-emphasized motion-reduce:transition-none cursor-pointer hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)] focus-visible:shadow-[var(--md-focus-ring)] outline-none"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </Tooltip>
              )}
              <span className="w-2 h-2 rounded-full shrink-0 bg-success" aria-hidden="true" />
            </span>
          </div>
        </>
      )}
    </nav>
  );
});

function NavButtonRow({
  item,
  active,
  unread,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  unread: number;
  onSelect: () => void;
}) {
  const showUnread = unread > 0 && !active;
  return (
    <button
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      aria-label={showUnread ? `${item.label}, ${unread} unread` : undefined}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors duration-micro ease-emphasized motion-reduce:transition-none cursor-pointer text-left outline-none focus-visible:shadow-[var(--md-focus-ring)]',
        active ? activeNavClass : idleNavClass,
      )}
    >
      <span aria-hidden="true">{item.icon}</span>
      <span className="flex-1 truncate">{item.label}</span>
      {showUnread && (
        <span
          aria-hidden="true"
          className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-error text-on-error"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

function RailIconButton({
  item,
  active,
  unread,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  unread: number;
  onSelect: () => void;
}) {
  const showUnread = unread > 0 && !active;
  return (
    <Tooltip content={item.label} side="right">
      <button
        onClick={onSelect}
        aria-current={active ? 'page' : undefined}
        aria-label={showUnread ? `${item.label}, ${unread} unread` : item.label}
        className={cn(
          'relative w-10 h-10 flex items-center justify-center rounded-full transition-colors duration-micro ease-emphasized motion-reduce:transition-none cursor-pointer outline-none focus-visible:shadow-[var(--md-focus-ring)]',
          active ? activeNavClass : idleNavClass,
        )}
      >
        {item.icon}
        {showUnread && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center bg-error text-on-error"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </Tooltip>
  );
}
