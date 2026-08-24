import React from 'react';
import {
  ChevronRight,
  Search,
  Video,
  Bell,
  Sun,
  Moon,
  UserRound,
  Settings,
  LogOut,
  Plus,
  Link2,
  Archive,
  Menu,
} from 'lucide-react';
import { Avatar } from '@/design-system/components/Avatar';
import { Tooltip } from '@/design-system/components/Tooltip';
import { Dropdown } from '@/design-system/components/Dropdown';
import { Popover } from '@/design-system/components/Popover';
import { ClanMindLogo } from '@/design-system/components/ClanMindLogo';
import type { Group, Project, User } from '@/types';

export interface TopBarProps {
  user: User;
  activeGroup: Group | null;
  activeProject: Project | null;
  unreadNotificationsCount: number;
  isMeetingActive: boolean;
  /** §165A.2 — Meeting Mode entry point hidden entirely when flag is off */
  meetingEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  onToggleTheme: () => void;
  onOpenSearch: () => void;
  onStartMeeting: () => void;
  onOpenNotifications: () => void;
  /**
   * §171 notification center content — rendered inside the bell Popover when
   * provided; without it the bell falls back to plain navigation.
   */
  notificationCenter?: React.ReactNode;
  onOpenProfile: () => void;
  onSignOut: () => void;
  onCreateGroup: () => void;
  onJoinGroup: () => void;
  onSelectGroup: (group: Group) => void;
  onSelectProject: (project: Project) => void;
  groups: Group[];
  projects: Project[];
  /**
   * §13 — when the viewport is below the rail band (<900px) the shell passes
   * this trigger; the top bar then renders the off-canvas navigation button.
   * Undefined in docked bands, so no control is ever dead.
   */
  onToggleNav?: () => void;
}

export function TopBar({
  user,
  activeGroup,
  activeProject,
  unreadNotificationsCount,
  isMeetingActive,
  meetingEnabled,
  theme,
  onToggleTheme,
  onOpenSearch,
  onStartMeeting,
  onOpenNotifications,
  notificationCenter,
  onOpenProfile,
  onSignOut,
  onCreateGroup,
  onJoinGroup,
  onSelectGroup,
  onSelectProject,
  groups,
  projects,
  onToggleNav,
}: TopBarProps) {
  // §15 Group switcher: current + recent groups, unread state, Create Group, Join Group
  const groupMenuItems = [
    ...groups.map((g) => ({
      id: g.id,
      label: g.name,
      icon: <Avatar name={g.name} size="xs" />,
      onClick: () => onSelectGroup(g),
    })),
    { divider: true as const, id: 'div-group-1' },
    {
      id: 'create-group',
      label: 'Create Group',
      icon: <Plus className="w-3.5 h-3.5" />,
      onClick: onCreateGroup,
    },
    {
      id: 'join-group',
      label: 'Join Group',
      icon: <Link2 className="w-3.5 h-3.5" />,
      onClick: onJoinGroup,
    },
  ];

  // §16 Project switcher: name, active status, archive state only when relevant
  const projectMenuItems = projects.map((p) => ({
    id: p.id,
    label: (
      <span className="flex items-center gap-1.5">
        {p.name}
        {p.status === 'archived' && (
          <Archive className="w-3 h-3 opacity-60" aria-label="Archived" />
        )}
      </span>
    ),
    onClick: () => onSelectProject(p),
  }));

  // §272 Profile dropdown — theme + demo replay live here, not the top bar (§325 #12)
  // 'system' resolves through the OS preference so the label names the theme
  // a toggle click would switch AWAY from.
  const effectiveDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const profileMenuItems = [
    {
      id: 'profile',
      label: 'Profile',
      icon: <UserRound className="w-3.5 h-3.5" />,
      onClick: onOpenProfile,
    },
    {
      id: 'preferences',
      label: 'Preferences',
      icon: <Settings className="w-3.5 h-3.5" />,
      onClick: onOpenProfile,
    },
    {
      id: 'theme',
      label: effectiveDark ? 'Light theme' : 'Dark theme',
      icon: effectiveDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />,
      onClick: onToggleTheme,
    },
    { divider: true as const, id: 'div-profile-1' },
    {
      id: 'signout',
      label: 'Sign out',
      destructive: true,
      icon: <LogOut className="w-3.5 h-3.5" />,
      onClick: onSignOut,
    },
  ];

  return (
    <header
      className="h-12 border-b flex items-center justify-between px-4 z-40 select-none"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface-raised)',
      }}
    >
      {/* Left: Location Breadcrumbs (§14) */}
      <div className="flex items-center gap-2 text-xs font-semibold min-w-0" style={{ color: 'var(--color-text)' }}>
        {/* §13 — off-canvas navigation trigger, only rendered below 900px */}
        {onToggleNav && (
          <Tooltip content="Open navigation" side="bottom">
            <button
              onClick={onToggleNav}
              aria-label="Open navigation menu"
              className="p-2 rounded-lg transition-colors cursor-pointer hover:bg-[var(--color-surface-hover)] focus-visible:shadow-[var(--focus-ring)] outline-none"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
        <ClanMindLogo size="sm" showWordmark={true} variant={isMeetingActive ? 'spectral' : 'calm'} />
        <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />

        {/* Group Switcher (§15) */}
        <Dropdown
          align="start"
          trigger={
            <button
              className="font-semibold truncate max-w-[140px] cursor-pointer hover:opacity-80 rounded-md outline-none focus-visible:shadow-[var(--focus-ring)]"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {activeGroup?.name || 'Select Group'}
            </button>
          }
          items={groupMenuItems}
        />

        {activeProject && (
          <>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
            {/* Project Switcher (§16) */}
            <Dropdown
              align="start"
              trigger={
                <button
                  className="font-semibold truncate max-w-[140px] cursor-pointer hover:underline rounded-md outline-none focus-visible:shadow-[var(--focus-ring)]"
                  style={{ color: 'var(--color-info)' }}
                >
                  {activeProject.name}
                </button>
              }
              items={projectMenuItems}
            />
          </>
        )}
      </div>

      {/* Center: Global Search Trigger (§61, §175) */}
      <div className="hidden md:flex items-center justify-center flex-1 max-w-sm px-4">
        <button
          onClick={onOpenSearch}
          aria-label="Search or jump to"
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer outline-none focus-visible:shadow-[var(--focus-ring)]"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          <span className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            <span>Search or jump to…</span>
          </span>
          <kbd
            className="font-mono text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}
          >
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* §165A.2: hidden entirely when meeting_mode flag is off */}
        {meetingEnabled && !isMeetingActive && (
          <button
            onClick={onStartMeeting}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors outline-none focus-visible:shadow-[var(--focus-ring)]"
            style={{
              color: 'var(--color-danger)',
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-border)',
            }}
          >
            <Video className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Start Meeting</span>
          </button>
        )}

        {/* Notifications (§14 top bar) — the §171 center opens in place */}
        {notificationCenter ? (
          <Popover
            trigger={
              <button
                className="relative p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-[var(--color-surface-hover)] focus-visible:shadow-[var(--focus-ring)] outline-none"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label={`Notifications${unreadNotificationsCount > 0 ? ` (${unreadNotificationsCount} unread)` : ''}`}
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                {/* §277 subtle unread badge on the nav surface */}
                {unreadNotificationsCount > 0 && (
                  <span
                    data-testid="topbar-unread-dot"
                    className="absolute top-1 right-1 w-2 h-2 rounded-full"
                    style={{ background: 'var(--color-info)' }}
                  />
                )}
              </button>
            }
            align="end"
            side="bottom"
            className="p-0"
          >
            {notificationCenter}
          </Popover>
        ) : (
          <Tooltip content="Activity">
            <button
              onClick={onOpenNotifications}
              className="relative p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: 'var(--color-text-secondary)' }}
              aria-label={`Notifications${unreadNotificationsCount > 0 ? ` (${unreadNotificationsCount} unread)` : ''}`}
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              {unreadNotificationsCount > 0 && (
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full"
                  style={{ background: 'var(--color-info)' }}
                />
              )}
            </button>
          </Tooltip>
        )}

        {/* §272 Profile */}
        <Dropdown
          align="end"
          trigger={
            <button aria-label="Open profile menu" className="cursor-pointer rounded-full focus-visible:shadow-[var(--focus-ring)]">
              <Avatar name={user.name} size="sm" presence="ONLINE" />
            </button>
          }
          items={profileMenuItems}
        />
      </div>
    </header>
  );
}