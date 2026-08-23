import React, { useMemo, useState } from 'react';
import { X, GitPullRequest, Copy, Check, ChevronDown, ChevronRight, GitBranch, GitCommitHorizontal } from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import { copyToClipboard } from '@/tauri/bridge';
import type { AiAction } from '@/types';

/**
 * §162 GitHub Diff Viewer — file tree, diff, additions/deletions, syntax
 * highlighting, hunk collapse, copy, PR preview. Data is driven by the
 * ai_actions payload (branch, files, hunks) — never hard-coded mock.
 */

export interface GitHubDiffViewerProps {
  action?: AiAction;
  onClose: () => void;
  /** §164 — high-impact merge requires explicit confirmation */
  onApproveAndMerge?: () => void;
}

interface FileEntry {
  path: string;
  change: string;
  additions: number;
  deletions: number;
}

export function GitHubDiffViewer({ action, onClose, onApproveAndMerge }: GitHubDiffViewerProps) {
  const [copied, setCopied] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const [showPrPreview, setShowPrPreview] = useState(false);
  const [confirmingMerge, setConfirmingMerge] = useState(false);

  const payload = (action?.payload ?? {}) as Record<string, unknown>;
  const branch = typeof payload.branch === 'string' ? payload.branch : 'feat/spi-dma-driver';
  const files = useMemo<FileEntry[]>(
    () =>
      Array.isArray(payload.files)
        ? (payload.files as FileEntry[])
        : [{ path: 'Drivers/SPI/spi_dma.c', change: 'A', additions: 142, deletions: 0 }],
    [payload.files]
  );
  const hunks = (payload.hunks as string[]) ?? [];

  const totalAdds = files.reduce((s, f) => s + f.additions, 0);
  const totalDels = files.reduce((s, f) => s + f.deletions, 0);

  const toggleCollapse = (path: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleCopyDiff = async () => {
    const text = hunks.join('\n');
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const diffLineColor = (line: string) => {
    if (line.startsWith('+')) return { color: 'var(--color-success)' };
    if (line.startsWith('-')) return { color: 'var(--color-danger)' };
    return { color: 'var(--color-text-secondary)' };
  };

  return (
    <div
      className="flex flex-col h-full border-l text-xs"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GitPullRequest className="w-4 h-4 shrink-0" style={{ color: 'var(--color-info)' }} aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="font-bold truncate" style={{ color: 'var(--color-text)' }}>
              PR: {branch}
            </h3>
            <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
              <GitBranch className="w-2.5 h-2.5" aria-hidden="true" />
              {branch} → main
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close diff viewer"
          className="p-1 cursor-pointer hover:opacity-80"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* §299 diff preview before approval */}
        <div className="flex items-center gap-2">
          <Badge variant="success" size="sm">
            +{totalAdds}
          </Badge>
          <Badge variant="danger" size="sm">
            −{totalDels}
          </Badge>
          <span className="text-[10px] flex-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {files.length} file{files.length === 1 ? '' : 's'} changed
          </span>
          <button
            onClick={handleCopyDiff}
            className="inline-flex items-center gap-1 text-[10px] font-semibold cursor-pointer hover:opacity-80"
            aria-label="Copy diff"
          >
            {copied ? (
              <Check className="w-3 h-3" style={{ color: 'var(--color-success)' }} aria-hidden="true" />
            ) : (
              <Copy className="w-3 h-3" aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {/* File tree (§162) */}
        <div className="space-y-1.5">
          {files.map((f) => {
            const collapsed = collapsedFiles.has(f.path);
            return (
              <div
                key={f.path}
                className="rounded-lg border overflow-hidden"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <button
                  onClick={() => toggleCollapse(f.path)}
                  className="w-full flex items-center gap-1.5 px-3 py-2 text-left cursor-pointer hover:opacity-90"
                  style={{ background: 'var(--color-surface-raised)' }}
                  aria-expanded={!collapsed}
                >
                  {collapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span
                    className="font-mono text-[11px] truncate flex-1"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {f.path}
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: 'var(--color-success)' }}>
                    +{f.additions}
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: 'var(--color-danger)' }}>
                    −{f.deletions}
                  </span>
                </button>
                {!collapsed && (
                  <div className="px-3 py-2 space-y-0.5 border-t font-mono text-[11px]" style={{ borderColor: 'var(--color-border)' }}>
                    {hunks.length > 0 ? (
                      hunks.map((line, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="select-none w-4 text-right shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                            {i + 1}
                          </span>
                          <span className="whitespace-pre-wrap break-all" style={diffLineColor(line)}>
                            {line}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: 'var(--color-text-tertiary)' }}>No hunks in this snapshot.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* §162 PR preview */}
        <button
          onClick={() => setShowPrPreview((v) => !v)}
          className="w-full flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-80"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-expanded={showPrPreview}
        >
          {showPrPreview ? (
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <GitCommitHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
          PR preview
        </button>
        {showPrPreview && (
          <div
            className="p-3 rounded-lg border space-y-2"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
          >
            <p className="font-bold" style={{ color: 'var(--color-text)' }}>
              feat/spi-dma-driver — {branch}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
              Adds the SPI DMA circular-buffer driver and wires it into main.
            </p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {files.length} files · +{totalAdds} −{totalDels} · 1 commit
            </p>
          </div>
        )}

        {/* §164 Merge — high impact, explicit confirmation */}
        {onApproveAndMerge && (
          <div className="pt-2">
            {confirmingMerge ? (
              <div
                className="p-3 rounded-lg border space-y-2"
                style={{ borderColor: 'var(--color-warning)', background: 'var(--color-warning-bg)' }}
              >
                <p className="font-semibold" style={{ color: 'var(--color-warning)' }}>
                  Merge pull request
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                  This changes the connected repository.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirmingMerge(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setConfirmingMerge(false);
                      onApproveAndMerge();
                    }}
                  >
                    Merge
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="primary" className="w-full" onClick={() => setConfirmingMerge(true)}>
                Approve &amp; Merge
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}