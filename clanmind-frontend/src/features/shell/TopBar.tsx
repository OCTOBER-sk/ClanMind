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
import clanmindMark from '@/assets/brand/clanmind-mark.png';
import { Avatar } from '@/design-system/components/Avatar';
import { Tooltip } from '@/design-system/components/Tooltip';
import { Dropdown } from '@/design-system/components/Dropdown';
import { Popover } from '@/design-system/components/Popover';
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
    <header className="h-16 border-b border-outline-variant bg-surface flex items-center justify-between px-4 z-40 select-none">
      {/* Left: Location Breadcrumbs — ClanMind · Group ▸ Project */}
      <div className="flex items-center gap-2 text-xs font-semibold min-w-0 text-on-surface">
        {onToggleNav && (
          <Tooltip content="Open navigation" side="bottom">
            <button
              onClick={onToggleNav}
              aria-label="Open navigation menu"
              className="p-2 rounded-full text-on-surface-variant transition-colors duration-micro ease-emphasized motion-reduce:transition-none cursor-pointer hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)] focus-visible:shadow-[var(--md-focus-ring)] outline-none"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
        <img src={clanmindMark} alt="ClanMind" className="h-5 w-auto shrink-0 dark:invert" />
        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-on-surface-variant" aria-hidden="true" />

        {/* Group Switcher — M3 menu */}
        <Dropdown
          align="start"
          trigger={
            <button className="font-medium truncate max-w-[140px] cursor-pointer rounded-full px-2 py-1 text-label-medium text-on-surface-variant transition-colors duration-micro ease-emphasized motion-reduce:transition-none hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)] outline-none focus-visible:shadow-[var(--md-focus-ring)]">
              {activeGroup?.name || 'Select Group'}
            </button>
          }
          items={groupMenuItems}
        />

        {activeProject && (
          <>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-on-surface-variant" aria-hidden="true" />
            <Dropdown
              align="start"
              trigger={
                <button className="font-medium truncate max-w-[140px] cursor-pointer rounded-full px-2 py-1 text-label-medium text-on-surface transition-colors duration-micro ease-emphasized motion-reduce:transition-none hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)] outline-none focus-visible:shadow-[var(--md-focus-ring)]">
                  {activeProject.name}
                </button>
              }
              items={projectMenuItems}
            />
          </>
        )}
      </div>

      {/* Center: Global Search Trigger — Search (Ctrl+K) */}
      <div className="hidden md:flex items-center justify-center flex-1 max-w-sm px-4">
        <button
          onClick={onOpenSearch}
          aria-label="Search or jump to"
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-full text-xs border border-outline-variant bg-surface-container-high text-on-surface-variant transition-colors duration-micro ease-emphasized motion-reduce:transition-none cursor-pointer outline-none focus-visible:shadow-[var(--md-focus-ring)] hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,var(--md-surface-container-high))] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,var(--md-surface-container-high))]"
        >
          <span className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            <span>Search or jump to…</span>
          </span>
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded-xs bg-surface text-on-surface-variant border border-outline-variant">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: sync · notifications · profile */}
      <div className="flex items-center gap-1 shrink-0">
        {meetingEnabled && !isMeetingActive && (
          <button
            onClick={onStartMeeting}
            aria-label="Start meeting"
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors duration-micro ease-emphasized motion-reduce:transition-none outline-none focus-visible:shadow-[var(--md-focus-ring)] border border-outline text-primary hover:bg-[color-mix(in_srgb,var(--md-primary)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-primary)_10%,transparent)]"
          >
            <Video className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Start Meeting</span>
          </button>
        )}

        {notificationCenter ? (
          <Popover
            trigger={
              <button
                className="relative p-2 rounded-full text-on-surface-variant transition-colors duration-micro ease-emphasized motion-reduce:transition-none cursor-pointer hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)] focus-visible:shadow-[var(--md-focus-ring)] outline-none"
                aria-label={`Notifications${unreadNotificationsCount > 0 ? ` (${unreadNotificationsCount} unread)` : ''}`}
              >
                <Bell className="w-[18px] h-[18px]" aria-hidden="true" />
                {unreadNotificationsCount > 0 && (
                  <span
                    data-testid="topbar-unread-dot"
                    className="absolute top-1 right-1 w-2 h-2 rounded-full bg-error"
                    aria-hidden="true"
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
              className="relative p-2 rounded-full text-on-surface-variant transition-colors duration-micro ease-emphasized motion-reduce:transition-none cursor-pointer hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)] focus-visible:shadow-[var(--md-focus-ring)] outline-none"
              aria-label={`Notifications${unreadNotificationsCount > 0 ? ` (${unreadNotificationsCount} unread)` : ''}`}
            >
              <Bell className="w-[18px] h-[18px]" aria-hidden="true" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-error" aria-hidden="true" />
              )}
            </button>
          </Tooltip>
        )}

        <Dropdown
          align="end"
          trigger={
            <button aria-label="Open profile menu" className="cursor-pointer rounded-full outline-none focus-visible:shadow-[var(--md-focus-ring)]">
              <Avatar name={user.name} size="sm" presence="ONLINE" />
            </button>
          }
          items={profileMenuItems}
        />
      </div>
    </header>
  );
}
