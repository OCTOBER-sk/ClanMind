/**
 * P8 — MemoryView (FE §116/§117/§118).
 *
 * §116 three sections (Group / Project / Your Private) with typed cards
 * showing source · scope · created · updated; §117 candidate banner wired
 * to Save/Dismiss; §118 scope chooser defaulting to Project in-project.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryView } from '@/features/memory/MemoryView';
import type { MemoryCandidate, MemoryEntry } from '@/types';

function makeMemory(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: 'mem_1',
    scope_type: 'PROJECT',
    group_id: 'g1',
    project_id: 'p1',
    user_id: null,
    memory_type: 'CONSTRAINT',
    content: 'Attitude loop is hard-coded to 1000 Hz.',
    normalized_content: null,
    confidence: 0.99,
    importance: 0.9,
    source_type: 'ai_research',
    source_id: null,
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    updated_at: new Date().toISOString(),
    last_used_at: null,
    archived_at: null,
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<MemoryCandidate> = {}): MemoryCandidate {
  return {
    id: 'cand_1',
    group_id: 'g1',
    project_id: 'p1',
    user_id: null,
    source_message_id: null,
    candidate_type: 'CONVENTION',
    content: 'We will use PostgreSQL.',
    confidence: 0.71,
    recommended_scope: 'PROJECT',
    status: 'PENDING',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function setup(
  props: Partial<Parameters<typeof MemoryView>[0]> & {
    memories?: MemoryEntry[];
    memoryCandidates?: MemoryCandidate[];
  } = {},
) {
  const { memories = [], memoryCandidates = [], ...rest } = props;
  const handlers = {
    onSaveCandidate: vi.fn(),
    onDismissCandidate: vi.fn(),
    onAddMemory: vi.fn(),
  };
  const user = userEvent.setup();
  render(
    <MemoryView
      memories={memories}
      memoryCandidates={memoryCandidates}
      inProject
      aiName="Odin"
      {...handlers}
      {...rest}
    />,
  );
  return { user, ...handlers };
}

describe('MemoryView — §116 sections', () => {
  const memories = [
    makeMemory({ id: 'm_proj', memory_type: 'CONSTRAINT', content: 'Project constraint row.' }),
    makeMemory({
      id: 'm_group',
      scope_type: 'GROUP',
      project_id: null,
      memory_type: 'FACT',
      content: 'Group fact row.',
      source_type: 'conversation',
    }),
    makeMemory({
      id: 'm_priv',
      scope_type: 'USER_PRIVATE',
      project_id: null,
      user_id: 'me',
      memory_type: 'PREFERENCE',
      content: 'Private preference row.',
      source_type: 'explicit',
    }),
  ];

  it('partitions cards by scope_type across the three tabs (default Project)', async () => {
    const { user } = setup({ memories });

    // Default section is Project inside a project context.
    let cards = screen.getAllByTestId('memory-card');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]!).getByText('Project constraint row.'));

    await user.click(screen.getByTestId('memory-section-group'));
    cards = screen.getAllByTestId('memory-card');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]!).getByText('Group fact row.')).toBeInTheDocument();

    await user.click(screen.getByTestId('memory-section-private'));
    cards = screen.getAllByTestId('memory-card');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]!).getByText('Private preference row.')).toBeInTheDocument();
  });

  it('each card shows the provenance line: source · scope · created · updated (§116)', () => {
    setup({ memories: [makeMemory()] });
    const card = screen.getByTestId('memory-card');
    expect(within(card).getByText('CONSTRAINT')).toBeInTheDocument();
    expect(within(card).getByText(/Source: Odin research/i)).toBeInTheDocument();
    expect(within(card).getByText('Scope: PROJECT')).toBeInTheDocument();
    expect(within(card).getByText(/Created /)).toBeInTheDocument();
    expect(within(card).getByText(/Updated /)).toBeInTheDocument();
  });

  it('unknown backend memory types render verbatim without crashing', () => {
    setup({ memories: [makeMemory({ memory_type: 'SOMETHING_NEW' })] });
    expect(screen.getByText('SOMETHING_NEW')).toBeInTheDocument();
  });
});

describe('MemoryView — §117 candidates', () => {
  it('renders the uncertain candidate with confidence and scope hint', () => {
    setup({ memoryCandidates: [makeCandidate()] });
    const cand = screen.getByTestId('memory-candidate');
    expect(cand).toHaveTextContent('“We will use PostgreSQL.”');
    expect(cand).toHaveTextContent('71% confident');
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('Save/Dismiss route through their handlers with the candidate id', async () => {
    const { user, onSaveCandidate, onDismissCandidate } = setup({
      memoryCandidates: [makeCandidate({ id: 'cand_x' })],
    });
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSaveCandidate).toHaveBeenCalledWith('cand_x');
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismissCandidate).toHaveBeenCalledWith('cand_x');
  });

  it('REJECTED candidates no longer render', () => {
    setup({ memoryCandidates: [makeCandidate({ status: 'REJECTED' })] });
    expect(screen.queryByTestId('memory-candidate')).not.toBeInTheDocument();
  });
});

describe('MemoryView — §118 explicit memory', () => {
  it('opens "Remember this" with Project preselected inside a project', async () => {
    const { user, onAddMemory } = setup({});
    await user.click(screen.getByRole('button', { name: /add memory/i }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Remember this');

    const projectRadio = screen.getByRole('radio', { name: 'Project' });
    expect(projectRadio).toHaveAttribute('aria-checked', 'true');

    await user.type(screen.getByLabelText('Content'), 'We will use PostgreSQL.');
    await user.click(screen.getByRole('button', { name: /save memory/i }));
    expect(onAddMemory).toHaveBeenCalledWith('PROJECT', 'CONVENTION', 'We will use PostgreSQL.');
  });

  it('outside a project the chooser offers Group/Private only, Group default', async () => {
    const { user, onAddMemory } = setup({ inProject: false });
    await user.click(screen.getByRole('button', { name: /add memory/i }));

    expect(screen.queryByRole('radio', { name: 'Project' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Group' })).toHaveAttribute('aria-checked', 'true');

    await user.selectOptions(screen.getByLabelText('Type'), 'LESSON');
    await user.type(screen.getByLabelText('Content'), 'Bench first, then integrate.');
    await user.click(screen.getByRole('button', { name: /save memory/i }));
    expect(onAddMemory).toHaveBeenCalledWith('GROUP', 'LESSON', 'Bench first, then integrate.');
  });
});

describe('MemoryView — empty state (§179)', () => {
  it('explains what/why/next per section', () => {
    setup({});
    const empty = screen.getByTestId('memory-empty');
    expect(empty).toHaveTextContent(/no project memory yet/i);
    expect(empty).toHaveTextContent(/keep decisions, constraints and conventions alive/i);
  });
});
