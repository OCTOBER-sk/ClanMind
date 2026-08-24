/**
 * §159 GitHub project panel — the Group's repository workbench:
 *
 *   Connected · owner/repo · default branch · last synced ·
 *   pending actions · pull requests
 *
 * §160 — a public repo URL is read-only; the UI never implies write access.
 * Write capability requires an explicit "Connect GitHub" (App installation).
 *
 * §165A.2 github_write — repository info and read-only status render as
 * normal, but every write-triggering affordance (approval cards for GitHub
 * actions) disappears when the flag is off. Reads still work (BE §76.1).
 *
 * §231 — disconnect explains consequences before it happens:
 *   "ClanMind will stop repository actions. Existing project history remains."
 */

import React, { useMemo, useState } from 'react';
import {
  GitBranch,
  GitPullRequest,
  RefreshCw,
  Clock,
  Link2Off,
  ShieldCheck,
  CircleAlert,
} from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import { Input } from '@/design-system/components/Input';
import { Dialog } from '@/design-system/components/Dialog';
import { ApprovalCard } from '@/features/approvals/ApprovalCard';
import { GITHUB_STATUS_LABEL, type GithubConnectionState } from './useGithubConnection';
import type { AiAction, GithubActionItem } from '@/types';

export interface GitHubPanelProps {
  groupId: string;
  projectId?: string | null;
  /** Shared connection state — owned by the app shell (one fetch site). */
  githubState: GithubConnectionState;
  /** §165A server-controlled flags. */
  githubWriteEnabled: boolean;
  githubMergeEnabled: boolean;
  /** Pending-action card bindings — the generic §164A handlers. */
  aiActions: AiAction[];
  onApproveAction: (actionId: string, payloadHash: string, payloadVersion: number) => void;
  onRejectAction: (actionId: string) => void;
  onReviewLatest: (actionId: string) => void;
  onOpenDiff: () => void;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

export function GitHubPanel({
  groupId: _groupId,
  projectId,
  githubState,
  githubWriteEnabled,
  githubMergeEnabled: _githubMergeEnabled,
  aiActions,
  onApproveAction,
  onRejectAction,
  onReviewLatest,
  onOpenDiff,
}: GitHubPanelProps) {
  const { status, connection, actions, isLoading, error, refresh, connect, disconnect } =
    githubState;
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  /** §160 — the explicit "Connect GitHub" upgrade path from a read-only URL. */
  const [showConnectForm, setShowConnectForm] = useState(false);

  // ─── Connect form (§160) ───
  const [ownerLogin, setOwnerLogin] = useState('');
  const [repoName, setRepoName] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [installationId, setInstallationId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  /** Pending = still awaiting a terminal state (§159 "pending actions"). */
  const pendingGithubRows = useMemo(
    () =>
      actions.filter(
        (row: GithubActionItem) => row.status === 'WAITING_APPROVAL' || row.status === 'APPROVED' || row.status === 'EXECUTING',
      ),
    [actions],
  );

  /**
   * PR list — derived ONLY from what the backend reported (create_pr rows).
   * Nothing is invented when the list is empty.
   */
  const pullRequests = useMemo(() => actions.filter((r) => r.action_type === 'create_pr'), [actions]);

  const isConnected = status === 'READ_ONLY' || status === 'READ_WRITE';
  const showWriteAffordances = githubWriteEnabled && isConnected;

  const handleConnect = async () => {
    setIsConnecting(true);
    await connect({
      installation_id: Number(installationId),
      owner_login: ownerLogin.trim(),
      repo_name: repoName.trim(),
      default_branch: defaultBranch.trim() || null,
      permission_mode: 'READ_WRITE',
    });
    setIsConnecting(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-3xl space-y-6 text-xs" data-testid="github-panel">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
          GitHub
        </h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Repository connection for this Group&rsquo;s projects.
        </p>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-danger)' }} role="alert">
          <CircleAlert className="w-3.5 h-3.5" aria-hidden="true" />
          {error}
        </p>
      )}

      {/* ─── Connection card (§159 + §165 matrix) ─── */}
      <div
        className="p-4 rounded-xl border space-y-4"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 shrink-0" style={{ color: 'var(--color-info)' }} aria-hidden="true" />
              <h3 className="font-bold truncate" style={{ color: 'var(--color-text)' }}>
                {connection?.repo_full_name ?? 'No repository connected'}
              </h3>
            </div>
            {connection?.default_branch && (
              <p className="font-mono text-[11px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                {connection.repo_full_name ?? ''} · {connection.default_branch}
              </p>
            )}
            {isConnected && (
              <p className="flex items-center gap-1 text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                <Clock className="w-3 h-3" aria-hidden="true" />
                Last synced {relativeTime(connection?.connected_at)}
              </p>
            )}
          </div>
          <Badge variant={status === 'READ_WRITE' ? 'success' : status === 'READ_ONLY' ? 'info' : 'neutral'} size="sm">
            {GITHUB_STATUS_LABEL[status]}
          </Badge>
        </div>

        {/* §160 — public URL ≠ write access; make the implication explicit */}
        {status === 'READ_ONLY' && (
          <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            A public repository URL provides read access only. For write capability, connect GitHub.
          </p>
        )}
        {status === 'READ_ONLY' && !showConnectForm && (
          <Button size="sm" variant="outline" leftIcon={<ShieldCheck className="w-3.5 h-3.5" />} onClick={() => setShowConnectForm(true)}>
            Connect GitHub
          </Button>
        )}

        {/* §231 disconnect with explicit consequence copy */}
        {isConnected && (
          <Button size="sm" variant="ghost" leftIcon={<Link2Off className="w-3.5 h-3.5" />} onClick={() => setDisconnectOpen(true)}>
            Disconnect
          </Button>
        )}

        {(() => {
          const needsForm =
            status === 'NOT_CONNECTED' ||
            status === 'DISCONNECTED' ||
            (status === 'READ_ONLY' && showConnectForm) ||
            status === 'NEEDS_REAUTH';
          if (!needsForm) return null;
          return (
            <ConnectForm
              ownerLogin={ownerLogin}
              repoName={repoName}
              defaultBranch={defaultBranch}
              installationId={installationId}
              isConnecting={isConnecting}
              onOwnerLogin={setOwnerLogin}
              onRepoName={setRepoName}
              onDefaultBranch={setDefaultBranch}
              onInstallationId={setInstallationId}
              onSubmit={() => void handleConnect()}
            />
          );
        })()}
        {status === 'CONNECTING' && (
          <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
            Connecting…
          </p>
        )}
      </div>

      {/* ─── Pending actions (§159) — gated by github_write per §165A.2 ─── */}
      {projectId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
              Pending actions
            </h3>
            <span className="flex items-center gap-2">
              <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                {pendingGithubRows.length} pending
              </span>
              <Button size="sm" variant="ghost" leftIcon={<RefreshCw className="w-3 h-3" />} onClick={() => void refresh()}>
                Refresh
              </Button>
            </span>
          </div>

          {showWriteAffordances ? (
            <>
              {aiActions.length === 0 && pendingGithubRows.length > 0 && (
                <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  {pendingGithubRows.length} action{pendingGithubRows.length === 1 ? '' : 's'} awaiting review — full details arrive with the approval event.
                </p>
              )}
              {aiActions.map((a) => (
                <ApprovalCard
                  key={a.id}
                  action={a}
                  onApprove={onApproveAction}
                  onReject={onRejectAction}
                  onReviewLatest={onReviewLatest}
                  onViewDiff={onOpenDiff}
                />
              ))}
              {aiActions.length === 0 && pendingGithubRows.length === 0 && (
                <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  No pending GitHub actions.
                </p>
              )}
            </>
          ) : (
            /* github_write off → no write-triggering cards at all (§165A.2) */
            <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {githubWriteEnabled
                ? 'Connect GitHub to review repository actions here.'
                : 'Repository writes are disabled for this Group — read-only browsing stays available.'}
            </p>
          )}
        </div>
      )}

      {/* ─── Pull requests (§159) — backend-reported rows only ─── */}
      <div className="space-y-2">
        <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
          Pull requests
        </h3>
        {pullRequests.length === 0 ? (
          <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            No pull requests yet.
          </p>
        ) : (
          <div
            className="divide-y rounded-xl overflow-hidden border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
          >
            {pullRequests.map((pr) => (
              <div key={pr.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="flex items-center gap-2 font-mono text-[11px] min-w-0">
                  <GitPullRequest className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-info)' }} aria-hidden="true" />
                  <span className="truncate" style={{ color: 'var(--color-text)' }}>
                    #{pr.pr_number ?? '—'} {pr.branch_name ?? ''}
                  </span>
                </span>
                <Badge variant={pr.status === 'SUCCEEDED' ? 'success' : 'neutral'} size="sm">
                  {pr.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
          Syncing…
        </p>
      )}

      {/* §231 — exact consequence copy before disconnecting */}
      <Dialog
        open={disconnectOpen}
        onOpenChange={(open) => {
          setDisconnectOpen(open);
        }}
        title="Disconnect GitHub?"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setDisconnectOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setDisconnectOpen(false);
                void disconnect();
              }}
            >
              Disconnect
            </Button>
          </>
        }
      >
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          ClanMind will stop repository actions. Existing project history remains.
        </p>
      </Dialog>
    </div>
  );
}

interface ConnectFormProps {
  ownerLogin: string;
  repoName: string;
  defaultBranch: string;
  installationId: string;
  isConnecting: boolean;
  onOwnerLogin: (v: string) => void;
  onRepoName: (v: string) => void;
  onDefaultBranch: (v: string) => void;
  onInstallationId: (v: string) => void;
  onSubmit: () => void;
}

function ConnectForm({
  ownerLogin,
  repoName,
  defaultBranch,
  installationId,
  isConnecting,
  onOwnerLogin,
  onRepoName,
  onDefaultBranch,
  onInstallationId,
  onSubmit,
}: ConnectFormProps) {
  const valid =
    ownerLogin.trim().length > 0 &&
    repoName.trim().length > 0 &&
    Number.isInteger(Number(installationId)) &&
    Number(installationId) > 0;
  const inputClass = 'px-3 py-2 rounded-lg border outline-none w-full focus:shadow-[var(--focus-ring)]';
  return (
    <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
        Connect GitHub
      </p>
      <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
        Installing the ClanMind GitHub App grants write access. A public repository URL alone never does.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="block text-[10px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            Owner
          </span>
          <Input value={ownerLogin} onChange={(e) => onOwnerLogin(e.target.value)} placeholder="robotics-core" />
        </label>
        <label className="space-y-1">
          <span className="block text-[10px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            Repository
          </span>
          <Input value={repoName} onChange={(e) => onRepoName(e.target.value)} placeholder="flight-controller" />
        </label>
        <label className="space-y-1">
          <span className="block text-[10px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            Default branch
          </span>
          <input
            value={defaultBranch}
            onChange={(e) => onDefaultBranch(e.target.value)}
            className={`${inputClass} font-mono text-[11px]`}
            style={{
              borderColor: 'var(--color-border-strong)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-[10px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            Installation ID
          </span>
          <input
            value={installationId}
            onChange={(e) => onInstallationId(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="4821934"
            className={`${inputClass} font-mono text-[11px]`}
            style={{
              borderColor: 'var(--color-border-strong)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          />
        </label>
      </div>
      <Button size="sm" variant="primary" disabled={!valid} isLoading={isConnecting} onClick={onSubmit}>
        Connect GitHub
      </Button>
    </div>
  );
}
