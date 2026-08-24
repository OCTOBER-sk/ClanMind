/**
 * GitHub integration + generic approval endpoints — the ONLY REST sites for
 * the BE §113 surface the UI uses (FE §9 layer boundary):
 *
 *   GET  /groups/:groupId/github/status            → {connected, connection}   (§76.2)
 *   POST /groups/:groupId/github/connect           → GithubConnection (201)
 *   POST /groups/:groupId/github/disconnect        → {ok}                      (§231)
 *   GET  /projects/:projectId/github/actions       → {items: GithubActionItem[]} (§78 join)
 *   POST /projects/:projectId/github/actions       → 202 {action, github_action}
 *   POST /github/actions/:actionId/approve         → {executed, reason?, action}
 *   POST /github/actions/:actionId/reject          → {ok}
 *
 * §164A.2 — approve submits the EXACT displayed payload_hash + payload_version
 * (`displayed_payload_hash` / `displayed_payload_version`, BE approvalBody);
 * never an `approved: true` boolean. An ACTION_EXPIRED answer means the
 * payload changed since render: the caller must re-fetch (§164A.4) and never
 * silently retry with the old hash.
 */

import { api } from '@/api/client';
import {
  ApproveGithubActionResponseSchema,
  GithubActionListSchema,
  GithubStatusResponseSchema,
} from '@/api/schemas';
import type {
  ApproveGithubActionResponse,
  GithubActionItem,
  GithubConnection,
  GithubStatusResponse,
  ProposeGithubActionResponse,
} from '@/types';

/** GET §76.2 — one Group = one connected repository (initial constraint). */
export async function fetchGithubStatus(groupId: string): Promise<GithubStatusResponse> {
  const raw = await api.get(`/groups/${encodeURIComponent(groupId)}/github/status`);
  const parsed = GithubStatusResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error('GitHub status response failed schema validation.');
  return parsed.data as GithubStatusResponse;
}

export interface ConnectGithubInput {
  installation_id: number;
  owner_login: string;
  repo_name: string;
  default_branch?: string | null;
  permission_mode?: 'READ_ONLY' | 'READ_WRITE';
}

/** POST connect — Owner/Admin only server-side; 201 → connection row. */
export async function connectGithub(
  groupId: string,
  input: ConnectGithubInput,
): Promise<GithubConnection> {
  const raw = await api.post(`/groups/${encodeURIComponent(groupId)}/github/connect`, input);
  // The Worker returns the raw connection row.
  if (
    raw &&
    typeof raw === 'object' &&
    'id' in (raw as Record<string, unknown>) &&
    'permission_mode' in (raw as Record<string, unknown>)
  ) {
    return raw as GithubConnection;
  }
  throw new Error('GitHub connect response failed schema validation.');
}

/** POST disconnect — history rows are kept server-side (§142). */
export async function disconnectGithub(groupId: string): Promise<void> {
  await api.post(`/groups/${encodeURIComponent(groupId)}/github/disconnect`, {});
}

/** GET joined action list — status/risk via ai_actions (§78A.2). */
export async function fetchGithubActions(projectId: string): Promise<GithubActionItem[]> {
  const raw = await api.get(`/projects/${encodeURIComponent(projectId)}/github/actions`);
  const parsed = GithubActionListSchema.safeParse(raw);
  if (!parsed.success) return [];
  return (parsed.data.items ?? []) as unknown as GithubActionItem[];
}

export interface ProposeGithubActionInput {
  action_type: 'create_branch' | 'apply_patch' | 'create_pr';
  branch_name: string;
  base_sha: string;
  head_sha: string;
  changed_files: Array<{ path: string; additions: number; deletions: number }>;
}

/** POST propose — creates ai_actions + github_actions, HIGH risk, needs approval. */
export async function proposeGithubAction(
  projectId: string,
  input: ProposeGithubActionInput,
): Promise<ProposeGithubActionResponse> {
  return api.post<ProposeGithubActionResponse>(
    `/projects/${encodeURIComponent(projectId)}/github/actions`,
    input,
  );
}

/**
 * §164A.2/§78A — bind the approval to the hash+version the human saw.
 * Backend errors with ACTION_EXPIRED when the payload changed or the window
 * lapsed; callers must surface the re-review flow, never auto-retry.
 */
export async function approveGithubAction(
  actionId: string,
  payloadHash: string,
  payloadVersion: number,
): Promise<ApproveGithubActionResponse> {
  const raw = await api.post(`/github/actions/${encodeURIComponent(actionId)}/approve`, {
    displayed_payload_hash: payloadHash,
    displayed_payload_version: payloadVersion,
  });
  const parsed = ApproveGithubActionResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Approve response failed schema validation.');
  return parsed.data as ApproveGithubActionResponse;
}

/** POST reject — terminal REJECTED; no further action (§164A.3). */
export async function rejectGithubAction(actionId: string): Promise<void> {
  await api.post(`/github/actions/${encodeURIComponent(actionId)}/reject`, {});
}
