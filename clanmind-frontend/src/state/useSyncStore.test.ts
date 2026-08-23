import { describe, it, expect } from 'vitest';
import { useSyncStore } from '@/state/useSyncStore';
import type { SyncConflict } from '@/types';

function conflict(): SyncConflict {
  return {
    id: 'c_x',
    group_id: 'g1',
    entity_type: 'task',
    entity_id: 't1',
    conflict_type: 'version_mismatch',
    client_payload: { a: 1 },
    server_payload: { a: 2 },
  };
}

describe('useSyncStore.resolveConflict — §186A.4 write-back', () => {
  it('records resolution_strategy, resolved_by and resolved_at on the same row', () => {
    const store = useSyncStore.getState();
    useSyncStore.setState({ conflicts: [conflict()] });

    useSyncStore.getState().resolveConflict('c_x', 'merged', 'user_resolver_1');

    const updated = useSyncStore.getState().conflicts[0];
    expect(updated).toBeDefined();
    expect(updated!.resolution_strategy).toBe('merged');
    expect(updated!.resolved_by).toBe('user_resolver_1');
    expect(updated!.resolved_at).toBeDefined();
    // The row is updated, not removed — no new operation is created
    expect(useSyncStore.getState().conflicts).toHaveLength(1);
    expect(useSyncStore.getState().pendingOperationsCount).toBe(store.pendingOperationsCount);
  });
});