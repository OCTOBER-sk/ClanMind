import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncConflictCard } from '@/features/sync/SyncConflictCard';
import type { SyncConflict } from '@/types';

function makeConflict(conflict_type: SyncConflict['conflict_type']): SyncConflict {
  return {
    id: 'c1',
    group_id: 'grp_1',
    entity_type: 'task',
    entity_id: 'task_1',
    conflict_type,
    client_payload: { title: 'Local title' },
    server_payload: { title: 'Remote title' },
  };
}

describe('SyncConflictCard — §186A.3 conflict-type copy', () => {
  it('version_mismatch shows the offline-update copy', () => {
    render(<SyncConflictCard conflict={makeConflict('version_mismatch')} onResolve={vi.fn()} />);
    expect(screen.getByText('This was updated by someone else while you were offline.')).toBeInTheDocument();
  });

  it('concurrent_edit shows the both-changed copy', () => {
    render(<SyncConflictCard conflict={makeConflict('concurrent_edit')} onResolve={vi.fn()} />);
    expect(screen.getByText('You and someone else both changed this.')).toBeInTheDocument();
  });

  it('deleted_upstream shows the narrower action set (§186A.3)', () => {
    render(<SyncConflictCard conflict={makeConflict('deleted_upstream')} onResolve={vi.fn()} />);
    expect(screen.getByText('This was deleted by someone else while you were offline.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discard mine/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restore mine as new/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /use remote/i })).not.toBeInTheDocument();
  });

  it('offers the merged strategy after opening Compare (§186A.4)', async () => {
    const user = userEvent.setup();
    render(<SyncConflictCard conflict={makeConflict('concurrent_edit')} onResolve={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /merge manually/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /compare/i }));
    expect(screen.getByRole('button', { name: /merge manually/i })).toBeInTheDocument();
  });

  it('resolution strategies map to the contract (§186A.4)', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<SyncConflictCard conflict={makeConflict('version_mismatch')} onResolve={onResolve} />);
    await user.click(screen.getByRole('button', { name: /keep mine/i }));
    expect(onResolve).toHaveBeenCalledWith('c1', 'client_wins');
    await user.click(screen.getByRole('button', { name: /use remote/i }));
    expect(onResolve).toHaveBeenCalledWith('c1', 'server_wins');
  });
});