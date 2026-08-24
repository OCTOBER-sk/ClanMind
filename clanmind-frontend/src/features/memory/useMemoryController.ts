/**
 * §116–§118 memory controller — loads the §108 surface through TanStack
 * Query:
 *
 *   • GROUP scope via GET /groups/:g/memory
 *   • PROJECT scope via GET /projects/:p/memory
 *   • PENDING candidates via GET /groups/:g/memory/candidates
 *   • Save/Dismiss candidate → POST accept (returns the created row) / reject
 *
 * USER_PRIVATE rows are rendered ONLY from what this client legitimately
 * holds: the real backend documents private-memory enforcement but ships no
 * private list route yet (INTEGRATION_NOTES D22) — the section stays honest.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  acceptMemoryCandidate,
  createMemory,
  fetchGroupMemories,
  fetchMemoryCandidates,
  fetchProjectMemories,
  rejectMemoryCandidate,
  type CreateMemoryInput,
} from '@/api/endpoints/memory';
import { errorMessageOf } from '@/features/github/useGithubConnection';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import type { MemoryEntry } from '@/types';

export interface MemoryControllerState {
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** §117 — accept returns the created memory row; the pending list shrinks. */
  acceptCandidate: (candidateId: string) => Promise<MemoryEntry | null>;
  dismissCandidate: (candidateId: string) => Promise<boolean>;
  /** §118 explicit memory — demo-parity endpoint; live fails honestly. */
  createExplicitMemory: (
    input: Omit<CreateMemoryInput, 'group_id'> & { group_id?: string },
  ) => Promise<MemoryEntry | null>;
}

/** Scope-accurate merge: replace this group's GROUP rows and this project's
 *  PROJECT rows; every other scope's rows stay untouched. */
function mergeScopes(
  groupId: string,
  projectId: string | null,
  groupRows: MemoryEntry[],
  projectRows: MemoryEntry[],
): void {
  useProjectDataStore.setState((s) => ({
    memories: [
      ...s.memories.filter(
        (m) =>
          !(m.group_id === groupId && m.scope_type === 'GROUP') &&
          !(projectId != null && m.project_id === projectId && m.scope_type === 'PROJECT'),
      ),
      ...groupRows,
      ...projectRows,
    ],
  }));
}

export function useMemoryController(
  groupId: string | null | undefined,
  projectId: string | null | undefined,
): MemoryControllerState {
  const [mutationError, setMutationError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const query = useQuery({
    queryKey: ['memory', groupId ?? null, projectId ?? null],
    queryFn: async () => {
      const gid = groupId as string;
      const pid = projectId ?? null;
      const [groupRows, projectRows, candidates] = await Promise.all([
        fetchGroupMemories(gid),
        pid ? fetchProjectMemories(pid).catch(() => []) : Promise.resolve([]),
        fetchMemoryCandidates(gid).catch(() => []),
      ]);
      return { gid, pid, groupRows, projectRows, candidates };
    },
    enabled: Boolean(groupId),
    staleTime: 15_000,
  });

  // External-store projection on fresh pages — the store stays the single
  // render source alongside dispatch projections.
  useEffect(() => {
    if (!query.data) return;
    const { gid, pid, groupRows, projectRows, candidates } = query.data;
    mergeScopes(gid, pid, groupRows, projectRows);
    const store = useProjectDataStore.getState();
    store.setMemoryCandidates(candidates);
    void store;
  }, [query.data]);

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const acceptCandidate = useCallback(
    async (candidateId: string): Promise<MemoryEntry | null> => {
      try {
        const memory = await acceptMemoryCandidate(candidateId);
        if (mountedRef.current) {
          const store = useProjectDataStore.getState();
          store.upsertMemory(memory);
          store.removeMemoryCandidate(candidateId);
          setMutationError(null);
        }
        return memory;
      } catch (err) {
        if (mountedRef.current) setMutationError(errorMessageOf(err));
        return null;
      }
    },
    [],
  );

  const dismissCandidate = useCallback(async (candidateId: string): Promise<boolean> => {
    try {
      await rejectMemoryCandidate(candidateId);
      if (mountedRef.current) {
        useProjectDataStore.getState().removeMemoryCandidate(candidateId);
        setMutationError(null);
      }
      return true;
    } catch (err) {
      if (mountedRef.current) setMutationError(errorMessageOf(err));
      return false;
    }
  }, []);

  const createExplicitMemory = useCallback(
    async (
      input: Omit<CreateMemoryInput, 'group_id'> & { group_id?: string },
    ): Promise<MemoryEntry | null> => {
      const gid = input.group_id ?? groupId;
      if (!gid) return null;
      try {
        const memory = await createMemory({ ...input, group_id: gid });
        if (mountedRef.current) {
          useProjectDataStore.getState().upsertMemory(memory);
          setMutationError(null);
        }
        return memory;
      } catch (err) {
        if (mountedRef.current) setMutationError(errorMessageOf(err));
        return null;
      }
    },
    [groupId],
  );

  return {
    isLoading: query.isPending && Boolean(groupId),
    error: mutationError ?? (query.isError ? errorMessageOf(query.error) : null),
    refresh,
    acceptCandidate,
    dismissCandidate,
    createExplicitMemory,
  };
}
