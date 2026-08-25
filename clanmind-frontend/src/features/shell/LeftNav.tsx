/**
 * LeftNav — §17 Left Navigation, §20 Group Roles in UI, §303 Guest UX.
 *
 * Order follows FE §12/§17: Chat → Projects (active first) → project
 * workbench → Team → Garage → Activity → Settings. No huge hierarchical tree:
 * the workbench cluster only exists while a Project is active.
 *
 * Role-aware affordances (§20): admin-shaped controls are never shown to
 * Members/Guests as disabled buttons — they simply do not render (§303: a
 * clean restricted navigation, not a sea of disabled controls).
 *
 * Collapsible rail (§13): `collapsed` swaps labels for icon-only entries with
 * tooltips; `width` is the §195 persisted sidebar preference applied when
 * expanded. Inside an off-canvas Sheet (<900px) pass width="fill".
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
  /** §20 — signed-in member's Group role drives which affordances exist. */
  myRole?: GroupRole;
  aiName?: string;
  onSelectSection: (section: MainNavSection) => void;
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
  /** Unread counts per nav section (used for badge display) */
  unreadCounts?: Partial<Record<MainNavSection, number>>;
  /** §13 icon rail (compressed band or user-collapsed). */
  collapsed?: boolean;
  /** When provided, a collapse/expand control is rendered (§195 toggle). */
  onToggleCollapsed?: () => void;
  /**
   * §195 remembered sidebar width in px. Omit for the default; `"fill"`
   * stretches to the off-canvas sheet container (<900px, FE §13).
   */
  width?: number | 'fill';
}

interface NavItem {
  id: MainNavSection;
  label: string;
  icon: React.ReactNode;
}

// §17: flat, minimal clusters — no huge hierarchical tree.
const WORKBENCH_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-4 h-4" /> },
  { id: 'decisions', label: 'Decisions', icon: <Bookmark className="w-4 h-4" /> },
  { id: 'memory', label: 'Team Memory', icon: <BookOpen className="w-4 h-4" /> },
];

// §12 diagram order: Team / Garage / Activity.
const TEAM_ITEMS: NavItem[] = [
  { id: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
  { id: 'garage', label: 'Garage', icon: <Folder className="w-4 h-4" /> },
  { id: 'activity', label: 'Activity', icon: <Bell className="w-4 h-4" /> },
];

const CHAT_ITEM: NavItem = { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> };
const SETTINGS_ITEM: NavItem = { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> };

const activeNavClass =
  'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-[var(--shadow-sm)]';
const idleNavClass = 'hover:bg-[var(--color-surface-hover)]';
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
  // §20 — affordances are role-aware. Hiding beats disabling (§325 #8/#10):
  // Members and Guests never see inert admin-shaped controls.
  const canManageProjects = myRole === 'OWNER' || myRole === 'ADMIN';
  // §303 — Guests get a clean restricted nav; Settings (roles/members/danger)
  // is not part of it. The backend remains the security authority (§111).
  const isGuest = myRole === 'GUEST';

  // §17 — Active project first, then other projects.
  const sortedProjects =
    activeProject == null
      ? projects
      : [...projects].sort((a, b) =>
          a.id === activeProject.id ? -1 : b.id === activeProject.id ? 1 : 0,
        );

  // §17 — workbench tools belong to a Project context; without one the tree
  // stays short (chat covers group-level work) and Overview can't dead-end.
  const workbenchItems = activeProject ? WORKBENCH_ITEMS : [];
  const footerItems = isGuest ? [] : [SETTINGS_ITEM];

  const rootStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
  };

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        'h-full flex flex-col select-none text-xs shrink-0 overflow-hidden',
        collapsed ? '' : 'p-3',
        width === 'fill' ? 'w-full' : '',
      )}
      style={
        width === 'fill'
          ? rootStyle
          : { ...rootStyle, width: collapsed ? RAIL_WIDTH_COLLAPSED_PX : (width ?? 240) }
      }
    >
      {collapsed ? (
        /* ── Icon rail (§13 compressed band / user-collapsed) ──────────── */
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
          {/* Expand affordance pinned to the bottom of the rail */}
          <div className="mt-auto pt-2">
            {onToggleCollapsed && (
              <Tooltip content="Expand navigation" side="right">
                <button
                  onClick={onToggleCollapsed}
                  aria-label="Expand navigation"
                  aria-expanded={false}
                  className="p-2 rounded-lg transition-colors cursor-pointer hover:bg-[var(--color-surface-hover)] focus-visible:shadow-[var(--focus-ring)] outline-none"
                  style={{ color: 'var(--color-text-secondary)' }}
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
            {/* ── Chat — main team conversation (§21) ──────────────────── */}
            <section aria-label="Chat">
              <NavButtonRow
                item={CHAT_ITEM}
                active={activeSection === CHAT_ITEM.id}
                unread={unreadCounts[CHAT_ITEM.id] ?? 0}
                onSelect={() => onSelectSection(CHAT_ITEM.id)}
              />
            </section>

            {/* ── Projects section (§16/§17) ───────────────────────────── */}
            <section aria-labelledby="nav-projects-label">
              <div className="flex items-center justify-between px-2.5 mb-1.5">
                <span
                  id="nav-projects-label"
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Projects
                </span>
                {/* §20 — create affordance exists only for roles that may use it */}
                {canManageProjects && (
                  <Tooltip content="Create new project" side="top">
                    <button
                      onClick={onCreateProject}
                      aria-label="Create new project"
                      className="p-1 rounded transition-colors cursor-pointer hover:bg-[var(--color-surface-hover)] hover:opacity-100 focus-visible:shadow-[var(--focus-ring)] outline-none"
                      style={{ color: 'var(--color-text-tertiary)' }}
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
                    <button
                      key={proj.id}
                      onClick={() => onSelectProject(proj)}
                      aria-current={isActive ? 'page' : undefined}
                      title={proj.name}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left',
                        isActive
                          ? 'bg-[var(--color-info-bg)] border-l-2 border-[var(--color-info)]'
                          : cn(idleNavClass, 'border-l-2 border-transparent')
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

            {/* ── Project workbench (only with an active Project, §17) ─── */}
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

            {/* ── Team / Garage / Activity (§12) ───────────────────────── */}
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

            {/* ── Settings, separated near the bottom (§17) ────────────── */}
            {footerItems.map((item) => (
              <section key={item.id} aria-label={item.label} className="pt-2 mt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <NavButtonRow
                  item={item}
                  active={activeSection === item.id}
                  unread={unreadCounts[item.id] ?? 0}
                  onSelect={() => onSelectSection(item.id)}
                />
              </section>
            ))}
          </div>

          {/* ── Bottom status strip ────────────────────────────────────── */}
          <div
            className="pt-2 mt-2 text-[11px] px-2 flex items-center justify-between gap-2"
            style={{
              borderTop: '1px solid var(--color-border)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            <span className="truncate flex items-center gap-1.5">
              <Zap className="w-3 h-3 shrink-0" aria-hidden="true" />
              {aiName ? `${aiName} AI Active` : 'AI Active'}
              {/* §20 — compact neutral role chip where it explains restricted nav */}
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
                    className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-[var(--color-surface-hover)] focus-visible:shadow-[var(--focus-ring)] outline-none"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    <PanelLeftClose className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </Tooltip>
              )}
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: 'var(--color-success)' }}
                aria-hidden="true"
              />
            </span>
          </div>
        </>
      )}
    </nav>
  );
});

/** Full-width labelled row used by every expanded-mode section. */
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
      // Unread count rides the button's accessible name — more reliable
      // for assistive tech than a bare decorative span.
      aria-label={
        showUnread ? `${item.label}, ${unread} unread` : undefined
      }
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left',
        active ? activeNavClass : idleNavClass
      )}
      style={!active ? { color: 'var(--color-text-secondary)' } : undefined}
    >
      <span aria-hidden="true">{item.icon}</span>
      <span className="flex-1 truncate">{item.label}</span>
      {/* Unread badge (§172/§277); count exposed via the button name above */}
      {showUnread && (
        <span
          aria-hidden="true"
          className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
          style={{ background: 'var(--color-info)', color: '#fff' }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

/** Icon-only button for the collapsed rail; tooltips carry the label (§64). */
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
          'relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer',
          active ? activeNavClass : idleNavClass
        )}
        style={!active ? { color: 'var(--color-text-secondary)' } : undefined}
      >
        {item.icon}
        {showUnread && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center"
            style={{ background: 'var(--color-info)', color: '#fff' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </Tooltip>
  );
}
