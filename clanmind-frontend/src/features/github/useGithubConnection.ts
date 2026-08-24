/**
 * §159/§165 GitHub connection state — one hook feeding both the Settings
 * GitHub section and the GitHub project panel. All reads go through the
 * §113 endpoint module; connection status maps onto the exact §165 matrix:
 *
 *   Not connected · Connecting · Read only · Read/write ·
 *   Needs reauthorization · Disconnected
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  connectGithub,
  disconnectGithub,
  fetchGithubActions,
  fetchGithubStatus,
} from '@/api/endpoints/github';
import type { ConnectGithubInput } from '@/api/endpoints/github';
import type { GithubActionItem, GithubConnection, GitHubConnectionStatus } from '@/types';

export interface GithubConnectionState {
  /** §165 matrix value — never a free-form string. */
  status: GitHubConnectionStatus;
  connection: GithubConnection | null;
  actions: GithubActionItem[];
  isLoading: boolean;
  /** Error message for the last failed mutation (§102 envelope message). */
  error: string | null;
  refresh: () => Promise<void>;
  connect: (input: ConnectGithubInput) => Promise<boolean>;
  disconnect: () => Promise<boolean>;
}

/**
 * Derive the §165 status value from server truth. NEEDS_REAUTH has no
 * backend signal yet (token expiry is not exposed) — it stays in the union
 * for protocol completeness and is never fabricated.
 */
export function deriveGithubStatus(
  connected: boolean,
  connection: GithubConnection | null,
): GitHubConnectionStatus {
  if (!connection && !connected) return 'NOT_CONNECTED';
  if (connection?.disconnected_at) return 'DISCONNECTED';
  if (!connected || !connection) return 'NOT_CONNECTED';
  return connection.permission_mode === 'READ_WRITE' ? 'READ_WRITE' : 'READ_ONLY';
}

export const GITHUB_STATUS_LABEL: Record<GitHubConnectionStatus, string> = {
  NOT_CONNECTED: 'Not connected',
  CONNECTING: 'Connecting',
  READ_ONLY: 'Read only',
  READ_WRITE: 'Read/write',
  NEEDS_REAUTH: 'Needs reauthorization',
  DISCONNECTED: 'Disconnected',
};

export function errorMessageOf(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return 'Something went wrong. Try again.';
}

export function useGithubConnection(
  groupId: string | undefined,
  projectId?: string | null,
): GithubConnectionState {
  const [status, setStatus] = useState<GitHubConnectionStatus>('NOT_CONNECTED');
  const [connection, setConnection] = useState<GithubConnection | null>(null);
  const [actions, setActions] = useState<GithubActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!groupId) return;
    setIsLoading(true);
    try {
      const result = await fetchGithubStatus(groupId);
      if (!mountedRef.current) return;
      setConnection(result.connection);
      setStatus(deriveGithubStatus(result.connected, result.connection as GithubConnection | null));
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(errorMessageOf(err));
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }

    if (!projectId) return;
    try {
      const items = await fetchGithubActions(projectId);
      if (!mountedRef.current) return;
      setActions(items);
    } catch {
      if (mountedRef.current) setActions([]);
    }
  }, [groupId, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(
    async (input: ConnectGithubInput): Promise<boolean> => {
      if (!groupId) return false;
      setStatus('CONNECTING');
      try {
        await connectGithub(groupId, input);
        await refresh();
        return true;
      } catch (err) {
        if (mountedRef.current) setError(errorMessageOf(err));
        await refresh();
        return false;
      }
    },
    [groupId, refresh],
  );

  const disconnect = useCallback(async (): Promise<boolean> => {
    if (!groupId) return false;
    try {
      await disconnectGithub(groupId);
      await refresh();
      return true;
    } catch (err) {
      if (mountedRef.current) setError(errorMessageOf(err));
      return false;
    }
  }, [groupId, refresh]);

  return {
    status,
    connection,
    actions,
    isLoading,
    error,
    refresh,
    connect,
    disconnect,
  };
}
