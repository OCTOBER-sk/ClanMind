/**
 * LeftNav — FE §17 structure, §20 role-aware affordances, §303 guest UX,
 * §13/§195 collapsible rail.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeftNav } from './LeftNav';
import type { GroupRole, MainNavSection, Project } from '@/types';

function makeProject(id: string, name: string, status: 'active' | 'archived' = 'active'): Project {
  const now = new Date().toISOString();
  return {
    id,
    group_id: 'grp_1',
    name,
    goal: '',
    description: '',
    project_type: 'software',
    status,
    pulse_progress: 42,
    created_at: now,
    updated_at: now,
  };
}

function baseProps(overrides: Partial<Parameters<typeof LeftNav>[0]> = {}) {
  return {
    projects: [makeProject('p1', 'Ground Station'), makeProject('p2', 'Flight Controller')],
    activeProject: null as Project | null,
    activeSection: 'chat' as MainNavSection,
    onSelectSection: vi.fn(),
    onSelectProject: vi.fn(),
    onCreateProject: vi.fn(),
    ...overrides,
  };
}

describe('LeftNav (FE §17/§20/§303)', () => {
  it('renders the §17 clusters: chat, projects, team spaces and settings', () => {
    render(<LeftNav {...baseProps()} />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
    for (const label of ['Chat', 'Ground Station', 'Flight Controller', 'Team', 'Garage', 'Activity', 'Settings']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('lists the active project first and marks it current (§16/§17)', () => {
    render(
      <LeftNav
        {...baseProps({ activeProject: makeProject('p2', 'Flight Controller') })}
      />,
    );
    const section = screen.getByRole('region', { name: 'Projects' });
    const buttons = within(section).getAllByRole('button');
    // First project button is the active one; create button is a sibling header control.
    const projectButtons = buttons.filter((b) => b.getAttribute('aria-current') !== null || b.textContent?.includes('%'));
    expect(projectButtons[0]).toHaveAttribute('aria-current', 'page');
    expect(projectButtons[0]).toHaveTextContent('Flight Controller');
  });

  it('hides the create-project affordance from Members — never disabled (§20)', () => {
    render(<LeftNav {...baseProps({ myRole: 'MEMBER' })} />);
    expect(screen.queryByRole('button', { name: 'Create new project' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('[disabled]')).toHaveLength(0);
  });

  it.each(['ADMIN', 'OWNER'] as GroupRole[])('shows create-project to %s (§20)', (role) => {
    render(<LeftNav {...baseProps({ myRole: role })} />);
    expect(screen.getByRole('button', { name: 'Create new project' })).toBeInTheDocument();
  });

  it('gives Guests a clean restricted nav: no Settings, no admin controls (§303)', () => {
    render(<LeftNav {...baseProps({ myRole: 'GUEST' })} />);
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create new project' })).not.toBeInTheDocument();
    expect(screen.getByText('Guest')).toBeInTheDocument();
    // Their own projects and shared surfaces remain reachable.
    expect(screen.getByText('Flight Controller')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(document.querySelectorAll('[disabled]')).toHaveLength(0);
  });

  it('shows the workbench cluster only with an active Project (§17 minimal tree)', () => {
    const { rerender } = render(<LeftNav {...baseProps()} />);
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();

    rerender(<LeftNav {...baseProps({ activeProject: makeProject('p1', 'Ground Station') })} />);
    for (const label of ['Overview', 'Tasks', 'Decisions', 'Team Memory']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('navigates sections and projects through callbacks', async () => {
    const user = userEvent.setup();
    const onSelectSection = vi.fn();
    const onSelectProject = vi.fn();
    render(
      <LeftNav
        {...baseProps({
          onSelectSection,
          onSelectProject,
          activeProject: makeProject('p1', 'Ground Station'),
        })}
      />,
    );
    await user.click(screen.getByText('Team'));
    expect(onSelectSection).toHaveBeenCalledWith('team');
    await user.click(screen.getByText('Flight Controller'));
    expect(onSelectProject).toHaveBeenCalledOnce();
  });

  it('surfaces unread counts per section', () => {
    render(<LeftNav {...baseProps({ unreadCounts: { activity: 3 } })} />);
    expect(screen.getByRole('button', { name: 'Activity, 3 unread' })).toBeInTheDocument();
  });

  describe('collapsed rail (FE §13/§195)', () => {
    it('swaps labels for icon-only entries with accessible names + expand toggle', async () => {
      const user = userEvent.setup();
      const onToggleCollapsed = vi.fn();
      render(
        <LeftNav
          {...baseProps({
            collapsed: true,
            onToggleCollapsed,
            unreadCounts: { activity: 12 },
          })}
        />,
      );
      // Labels are gone…
      expect(screen.queryByText('Activity')).not.toBeInTheDocument();
      // …but every destination stays reachable by name.
      expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Team' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
      // Unread survives as a compact badge on the icon.
      expect(screen.getByRole('button', { name: 'Activity, 12 unread' })).toBeInTheDocument();

      const expand = screen.getByRole('button', { name: 'Expand navigation' });
      await user.click(expand);
      expect(onToggleCollapsed).toHaveBeenCalledOnce();
    });

    it('offers collapse from the expanded footer', async () => {
      const user = userEvent.setup();
      const onToggleCollapsed = vi.fn();
      render(<LeftNav {...baseProps({ onToggleCollapsed })} />);
      await user.click(screen.getByRole('button', { name: 'Collapse navigation' }));
      expect(onToggleCollapsed).toHaveBeenCalledOnce();
    });

    it('applies the persisted sidebar width (§195)', () => {
      const { container } = render(<LeftNav {...baseProps({ width: 264 })} />);
      const nav = container.querySelector('nav');
      expect(nav).toHaveStyle({ width: '264px' });
    });
  });
});
