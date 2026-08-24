/**
 * P9 — §165A.2 flag gating for Meeting Mode entry points: when
 * `meeting_mode` is off, the entry points are HIDDEN ENTIRELY, never shown
 * disabled (a greyed-out button inviting "why can't I click this" is worse
 * than absence). While a meeting is active, start affordances also vanish —
 * §123's active header takes over.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopBar } from '@/features/shell/TopBar';
import { ChatHeader } from '@/features/chat/ChatHeader';
import type { Group, Project, User } from '@/types';

const user = {
  id: 'user_1',
  email: 'u@clanmind.io',
  name: 'Arun',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} satisfies User;

const group = {
  id: 'grp_1',
  name: 'Robotics',
  status: 'ACTIVE',
  ai_name: 'Odin',
  ai_proactivity: 'balanced',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} satisfies Group;

const project = {
  id: 'proj_1',
  group_id: 'grp_1',
  name: 'Flight Controller',
} as unknown as Project;

function topBarProps(meetingEnabled: boolean) {
  return {
    user,
    activeGroup: group,
    activeProject: project,
    unreadNotificationsCount: 0,
    isMeetingActive: false,
    meetingEnabled,
    theme: 'light' as const,
    onToggleTheme: vi.fn(),
    onOpenSearch: vi.fn(),
    onStartMeeting: vi.fn(),
    onOpenNotifications: vi.fn(),
    onOpenProfile: vi.fn(),
    onSignOut: vi.fn(),
    onCreateGroup: vi.fn(),
    onJoinGroup: vi.fn(),
    onSelectGroup: vi.fn(),
    onSelectProject: vi.fn(),
    groups: [group],
    projects: [project],
  };
}

describe('TopBar — §165A.2 meeting_mode hidden-not-disabled', () => {
  it('shows the Start Meeting entry when the flag is on', () => {
    render(<TopBar {...topBarProps(true)} />);
    expect(screen.getByText(/start meeting/i)).toBeInTheDocument();
  });

  it('hides the entry entirely when the flag is off — no disabled ghost', () => {
    render(<TopBar {...topBarProps(false)} />);
    expect(screen.queryByText(/start meeting/i)).not.toBeInTheDocument();
    // And nothing rendered in its place pretending to be it.
    expect(screen.queryByRole('button', { name: /meeting/i })).not.toBeInTheDocument();
  });

  it('hides the entry while a meeting is already active (§123 header owns the surface)', () => {
    const props = topBarProps(true);
    props.isMeetingActive = true;
    render(<TopBar {...props} />);
    expect(screen.queryByText(/start meeting/i)).not.toBeInTheDocument();
  });
});

describe('ChatHeader — §165A.2 meeting_mode hidden-not-disabled', () => {
  const baseProps = {
    groupName: 'Robotics',
    aiName: 'Odin',
    meetingEnabled: true,
    isMeetingActive: false,
    onStartMeeting: vi.fn(),
  };

  function chatHeader(meetingEnabled: boolean, isMeetingActive = false) {
    return render(
      <ChatHeader
        {...baseProps}
        meetingEnabled={meetingEnabled}
        isMeetingActive={isMeetingActive}
      />,
    );
  }

  it('shows the Meeting entry when the flag is on', () => {
    chatHeader(true);
    expect(screen.getByText(/meeting/i)).toBeInTheDocument();
  });

  it('hides it entirely when the flag is off (§165A.2)', () => {
    chatHeader(false);
    expect(screen.queryByRole('button', { name: /meeting/i })).not.toBeInTheDocument();
  });

  it('hides it while a meeting is active', () => {
    chatHeader(true, true);
    expect(screen.queryByRole('button', { name: /meeting/i })).not.toBeInTheDocument();
  });
});
