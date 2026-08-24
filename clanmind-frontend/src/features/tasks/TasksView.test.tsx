/**
 * P8 — TasksView (FE §119) + TaskCard anatomy, filters and interactions.
 *
 * §119 anatomy: title · owner · status · priority · due · related decision.
 * Filters cover the full §48 status enum. Interactions are compact (one
 * status select, one owner select, a Done affordance). Empty states follow
 * §179 (what/why/next).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TasksView } from '@/features/tasks/TasksView';
import type { GroupMember, Task } from '@/types';

function makeMember(id: string, name: string, nickname?: string): GroupMember {
  return {
    user_id: id,
    group_id: 'grp_1',
    role: 'MEMBER',
    joined_at: new Date().toISOString(),
    user: { id, email: `${id}@x.io`, name, created_at: new Date().toISOString() },
    ...(nickname ? { nickname } : {}),
  };
}

const MEMBERS = [
  makeMember('user_a', 'Arun Kumar', 'Arun (Lead)'),
  makeMember('user_p', 'Priya Sharma'),
];

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task_x',
    project_id: 'proj_1',
    title: 'Wire the CAN bus sniffer',
    description: 'Log cell voltages at 100 Hz.',
    owner_user_id: null,
    status: 'TODO',
    priority: 'MEDIUM',
    due_at: null,
    version: 1,
    created_by_user_id: null,
    created_by_ai_id: null,
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

function setup(tasks: Task[], props: Partial<Parameters<typeof TasksView>[0]> = {}) {
  const handlers = {
    onAddTask: vi.fn(),
    onSetStatus: vi.fn(),
    onAssign: vi.fn(),
    onComplete: vi.fn(),
    onNavigateToDecision: vi.fn(),
  };
  const user = userEvent.setup();
  render(
    <TasksView
      tasks={tasks}
      members={MEMBERS}
      {...handlers}
      {...props}
    />,
  );
  return { user, ...handlers };
}

describe('TasksView — §119 card anatomy', () => {
  it('renders title, owner, priority, due date and related-decision link', () => {
    // Noon tomorrow — a stable calendar day regardless of the run time.
    const due = new Date();
    due.setDate(due.getDate() + 1);
    due.setHours(12, 0, 0, 0);
    const task = makeTask({
      owner_user_id: 'user_p',
      priority: 'HIGH',
      due_at: due.toISOString(),
      related_decision_id: 'dec_9',
    });
    setup([task], {
      relatedDecisionLabels: new Map([['dec_9', 'Decision #2']]),
    });

    const card = screen.getByTestId('task-card');
    expect(within(card).getByText('Wire the CAN bus sniffer')).toBeInTheDocument();
    // Owner resolves through members incl. nicknames (§119 "owner").
    expect(within(card).getByTestId('task-owner')).toHaveTextContent('Priya Sharma');
    expect(within(card).getByText(/High/i)).toBeInTheDocument(); // priority badge
    expect(within(card).getByText('Due tomorrow')).toBeInTheDocument();
    const link = within(card).getByTestId('related-decision-link');
    expect(link).toHaveTextContent('Decision #2');
  });

  it('shows Unassigned when no owner; hides decision link without label data', () => {
    setup([makeTask({ related_decision_id: 'dec_missing' })]);
    const card = screen.getByTestId('task-card');
    expect(within(card).getByTestId('task-owner')).toHaveTextContent('Unassigned');
    expect(within(card).queryByTestId('related-decision-link')).not.toBeInTheDocument();
  });

  it('flags overdue tasks with warning copy', () => {
    const yesterday = new Date(Date.now() - 48 * 3_600_000);
    setup([makeTask({ due_at: yesterday.toISOString() })]);
    expect(screen.getByText(/Overdue/)).toBeInTheDocument();
  });
});

describe('TasksView — status filters', () => {
  const tasks = [
    makeTask({ id: 't1', title: 'Todo row', status: 'TODO' }),
    makeTask({ id: 't2', title: 'WIP row', status: 'IN_PROGRESS' }),
    makeTask({ id: 't3', title: 'Done row', status: 'DONE' }),
    makeTask({ id: 't4', title: 'Cancelled row', status: 'CANCELLED' }),
  ];

  it('filters by every §48 status value', async () => {
    const { user } = setup(tasks);

    expect(screen.getAllByTestId('task-card')).toHaveLength(4);

    await user.click(screen.getByTestId('filter-IN_PROGRESS'));
    const wipOnly = screen.getAllByTestId('task-card');
    expect(wipOnly).toHaveLength(1);
    expect(within(wipOnly[0]!).getByText('WIP row')).toBeInTheDocument();

    await user.click(screen.getByTestId('filter-CANCELLED'));
    expect(screen.getAllByTestId('task-card')).toHaveLength(1);

    await user.click(screen.getByTestId('filter-all'));
    expect(screen.getAllByTestId('task-card')).toHaveLength(4);
  });

  it('empty filter result explains what is empty (§179)', async () => {
    const { user } = setup([makeTask({ id: 'only', status: 'TODO' })]);
    await user.click(screen.getByTestId('filter-DONE'));
    expect(screen.getByTestId('tasks-empty')).toHaveTextContent(/no done tasks/i);
  });
});

describe('TasksView — interactions', () => {
  it('status select, owner select and Done button each invoke their handler', async () => {
    const task = makeTask({ status: 'TODO', owner_user_id: null });
    const { user, onSetStatus, onAssign, onComplete } = setup([task]);

    await user.selectOptions(screen.getByLabelText('Status for Wire the CAN bus sniffer'), 'IN_PROGRESS');
    await user.selectOptions(screen.getByLabelText('Owner for Wire the CAN bus sniffer'), 'user_a');

    // The compact Done affordance carries an accessible label (§64).
    await user.click(screen.getByRole('button', { name: /complete wire the can bus sniffer/i }));

    expect(onSetStatus).toHaveBeenCalledWith(task, 'IN_PROGRESS');
    expect(onAssign).toHaveBeenCalledWith(task, 'user_a');
    expect(onComplete).toHaveBeenCalledWith(task);
  });

  it('terminal tasks lose mutation affordances but keep the card readable', () => {
    setup([makeTask({ status: 'DONE', completed_at: new Date().toISOString() })]);
    expect(screen.queryByRole('button', { name: /complete/i })).not.toBeInTheDocument();
    expect(screen.getByText('Wire the CAN bus sniffer')).toBeInTheDocument();
  });
});

describe('TasksView — empty state (§179)', () => {
  it('explains what / why / next', async () => {
    const { user, onAddTask } = setup([]);
    const empty = screen.getByTestId('tasks-empty');
    expect(empty).toHaveTextContent(/no tasks in this project yet/i);
    expect(empty).toHaveTextContent(/assign owners and due dates/i);

    await user.click(screen.getByRole('button', { name: /create the first task/i }));
    expect(onAddTask).toHaveBeenCalled();
  });
});
