/**
 * §120 decisions controller — the decision log read through TanStack Query
 * (same pattern as message history) with §21.2 CAS-guarded approve/reject.
 * A stale `expected_version` (409 CONFLICT) reconciles from a fresh GET
 * instead of retrying; propose always lands PROPOSED (§122).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import {
  approveDecision,
  fetchProjectDecisions,
  proposeDecision,
  rejectDecision,
  type ProposeDecisionInput,
} from '@/api/endpoints/decisions';
import { errorMessageOf } from '@/features/github/useGithubConnection';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import type { Decision } from '@/types';

export interface DecisionsControllerState {
  /** Rows for the active Project (already scoped). */
  decisions: Decision[];
  isLoading: boolean;
  error: string | null;
  isMutating: boolean;
  refresh: () => Promise<void>;
  propose: (input: ProposeDecisionInput) => Promise<Decision | null>;
  approve: (decision: Decision) => Promise<boolean>;
  reject: (decision: Decision) => Promise<boolean>;
}

function applyProjectRows(projectId: string, rows: Decision[]): void {
  useProjectDataStore.setState((s) => ({
    decisions: [...s.decisions.filter((d) => d.project_id !== projectId), ...rows],
  }));
}

export function useDecisionsController(
  projectId: string | null | undefined,
): DecisionsControllerState {
  const all = useProjectDataStore((s) => s.decisions);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const query = useQuery({
    queryKey: ['project-decisions', projectId ?? null],
    queryFn: () => fetchProjectDecisions(projectId as string),
    enabled: Boolean(projectId),
    staleTime: 15_000,
  });

  // External-store projection — the store stays the single render source.
  useEffect(() => {
    if (!query.data || !projectId) return;
    applyProjectRows(projectId, query.data);
  }, [query.data, projectId]);

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const propose = useCallback(
    async (input: ProposeDecisionInput): Promise<Decision | null> => {
      if (!projectId) return null;
      setIsMutating(true);
      try {
        const decision = await proposeDecision(projectId, input);
        if (mountedRef.current) {
          useProjectDataStore.getState().upsertDecision(decision);
          setMutationError(null);
        }
        return decision;
      } catch (err) {
        if (mountedRef.current) setMutationError(errorMessageOf(err));
        return null;
      } finally {
        if (mountedRef.current) setIsMutating(false);
      }
    },
    [projectId],
  );

  /** CAS transition — on 409 reload server truth; never blind-retry. */
  const transition = useCallback(
    async (
      decision: Decision,
      run: () => Promise<unknown>,
      optimistic: Partial<Decision>,
    ): Promise<boolean> => {
      setIsMutating(true);
      useProjectDataStore.getState().upsertDecision({ ...decision, ...optimistic });
      try {
        await run();
        await query.refetch();
        if (mountedRef.current) setMutationError(null);
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        if (err instanceof ApiError && (err.code === 'CONFLICT' || err.status === 409)) {
          await query.refetch();
          setMutationError('This decision changed elsewhere. Showing the latest version.');
        } else {
          setMutationError(errorMessageOf(err));
          useProjectDataStore.getState().upsertDecision(decision);
        }
        return false;
      } finally {
        if (mountedRef.current) setIsMutating(false);
      }
    },
    [query],
  );

  const approve = useCallback(
    (decision: Decision) =>
      transition(
        decision,
        () => approveDecision(decision.id, decision.version),
        {
          status: 'APPROVED',
          approved_at: new Date().toISOString(),
          version: decision.version + 1,
        },
      ),
    [transition],
  );

  const reject = useCallback(
    (decision: Decision) =>
      transition(
        decision,
        () => rejectDecision(decision.id, decision.version),
        { status: 'REJECTED', version: decision.version + 1 },
      ),
    [transition],
  );

  const decisions = projectId ? all.filter((d) => d.project_id === projectId) : [];

  return {
    decisions,
    isLoading: query.isPending && Boolean(projectId),
    error: mutationError ?? (query.isError ? errorMessageOf(query.error) : null),
    isMutating,
    refresh,
    propose,
    approve,
    reject,
  };
}
