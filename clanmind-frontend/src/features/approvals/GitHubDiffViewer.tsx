import React, { useMemo, useState } from 'react';
import {
  X,
  GitPullRequest,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  GitBranch,
  GitCommitHorizontal,
} from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import { Dialog } from '@/design-system/components/Dialog';
import { copyToClipboard } from '@/tauri/bridge';
import type { AiAction } from '@/types';

/**
 * §162 GitHub Diff Viewer — file tree, diff, additions/deletions, syntax
 * highlighting basics, hunk collapse, copy, PR preview. EVERYTHING renders
 * from the ai_actions payload (branch, changed_files, SHAs) — there are no
 * hard-coded demo fallbacks; an empty payload degrades honestly.
 *
 * §299 — before approval the viewer shows the exact files, base/target
 * branch context, additions/deletions and the high-level risk level.
 *
 * §164 — merging is high impact and asks via a real dialog:
 *   "Merge pull request / This changes the connected repository. [Cancel][Merge]"
 */

export interface GitHubDiffViewerProps {
  action?: AiAction;
  /** The connected repo's default branch (PR target), when known. */
  defaultBranch?: string | null;
  /** §165A.2 github_merge — when off, no Merge affordance exists at all. */
  mergeEnabled?: boolean;
  onClose: () => void;
  /** §164 — high-impact merge requires explicit confirmation */
  onApproveAndMerge?: () => void;
}

interface FileEntry {
  path: string;
  additions: number;
  deletions: number;
}

function readFiles(payload: Record<string, unknown>): FileEntry[] {
  const raw = (payload.changed_files ?? payload.files) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const e = entry as Record<string, unknown>;
    if (typeof e.path !== 'string') return [];
    return [
      {
        path: e.path,
        additions: typeof e.additions === 'number' ? e.additions : 0,
        deletions: typeof e.deletions === 'number' ? e.deletions : 0,
      },
    ];
  });
}

function readHunksFor(payload: Record<string, unknown>, path: string): string[] {
  // Demo-only inline extension (`file_diffs`, per path). The real backend
  // ships stats only today — the viewer shows an honest "line changes not
  // available" state rather than inventing hunks (see INTEGRATION_NOTES).
  const byFile = payload.file_diffs as Record<string, unknown> | undefined;
  if (byFile && Array.isArray(byFile[path])) {
    return (byFile[path] as unknown[]).filter((l): l is string => typeof l === 'string');
  }
  return [];
}

// ─── §162 syntax-highlighting basics ─────────────────────────────────────────

const KEYWORDS = new Set([
  'void', 'int', 'uint8_t', 'uint16_t', 'uint32_t', 'static', 'const', 'return',
  'if', 'else', 'for', 'while', 'struct', 'enum', 'typedef', 'extern', 'volatile',
  'import', 'export', 'from', 'function', 'class', 'interface', 'type', 'new',
]);

interface Span {
  text: string;
  color?: string;
  bold?: boolean;
}

/** Tiny tokenizer: preprocessor directives, comments, strings, numbers, keywords. */
export function highlightLine(line: string): Span[] {
  const spans: Span[] = [];
  let rest = line;

  // Preprocessor directive (#include, #define…) — highlight the directive.
  const directive = rest.match(/^\s*(#\w+)/);
  if (directive) {
    spans.push({ text: directive[0].slice(0, directive[0].indexOf(directive[1])), color: undefined });
    spans.push({ text: directive[1], color: 'var(--color-warning)', bold: true });
    rest = rest.slice(directive[0].length);
    if (!rest) return spans;
  }

  // Whole-line comments.
  if (/^\s*(\/\/|\*|\/\*)/.test(rest)) {
    spans.push({ text: rest, color: 'var(--color-text-tertiary)' });
    return spans;
  }

  const pattern = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b|\s+|.)/g;
  for (const token of rest.match(pattern) ?? []) {
    if (/^["']/.test(token)) spans.push({ text: token, color: 'var(--color-success)' });
    else if (/^\d/.test(token)) spans.push({ text: token, color: 'var(--color-info)' });
    else if (KEYWORDS.has(token)) spans.push({ text: token, color: 'var(--color-info)', bold: true });
    else spans.push({ text: token });
  }
  return spans;
}

function diffLineColor(line: string): string | undefined {
  if (line.startsWith('+')) return 'var(--color-success)';
  if (line.startsWith('-')) return 'var(--color-danger)';
  return undefined;
}

// ─── File tree model (§162) ──────────────────────────────────────────────────

interface TreeNode {
  name: string;
  fullPath: string;
  children: TreeNode[];
  file?: FileEntry;
}

function buildTree(files: FileEntry[]): TreeNode[] {
  const rootChildren: TreeNode[] = [];
  const findOrCreate = (list: TreeNode[], name: string, fullPath: string): TreeNode => {
    let node = list.find((n) => n.name === name && !n.file);
    if (!node) {
      node = { name, fullPath, children: [] };
      list.push(node);
    }
    return node;
  };
  for (const f of files) {
    const parts = f.path.split('/');
    let list = rootChildren;
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1;
      if (isLeaf) {
        list.push({ name: part, fullPath: f.path, children: [], file: f });
      } else {
        const node = findOrCreate(list, part, parts.slice(0, i + 1).join('/'));
        list = node.children;
      }
    });
  }
  // Directories first, then files; alphabetical within each group.
  const sortLevel = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (!!a.file === !!b.file ? a.name.localeCompare(b.name) : a.file ? 1 : -1));
    nodes.forEach((n) => sortLevel(n.children));
  };
  sortLevel(rootChildren);
  return rootChildren;
}

const HUNK_COLLAPSE_THRESHOLD = 8;

interface DiffBodyProps {
  action: AiAction;
  collapsedPaths: Set<string>;
  hunkExpandedPaths: Set<string>;
  onTogglePath: (path: string) => void;
  onToggleHunkCollapse: (path: string) => void;
}

/** Per-file diff body — hunks when available, honest fallback otherwise. */
function DiffBody({
  action,
  collapsedPaths,
  hunkExpandedPaths,
  onTogglePath,
  onToggleHunkCollapse,
}: DiffBodyProps) {
  const payload = action.payload as Record<string, unknown>;
  const files = readFiles(payload);
  const tree = useMemo(() => buildTree(files), [files]);
  /** Directory expansion is tree-local UI state; everything opens by default. */
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());

  const toggleDir = (fullPath: string) => {
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(fullPath)) next.delete(fullPath);
      else next.add(fullPath);
      return next;
    });
  };

  const renderHunks = (path: string) => {
    const hunks = readHunksFor(payload, path);
    if (hunks.length === 0) {
      return (
        <p className="px-3 py-2 border-t text-[10px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}>
          Line-level changes not available for this file — stats above are authoritative.
        </p>
      );
    }
    // §162 hunk collapse — long hunks fold behind "Show N more lines" by
    // default; a path is unfolded only once the user explicitly expands it.
    const folded = hunks.length > HUNK_COLLAPSE_THRESHOLD && !hunkExpandedPaths.has(path);
    const visible = folded ? hunks.slice(0, HUNK_COLLAPSE_THRESHOLD) : hunks;
    return (
      <div className="px-3 py-2 space-y-0.5 border-t font-mono text-[11px]" style={{ borderColor: 'var(--color-border)' }}>
        {visible.map((line, i) => (
          <div key={i} className="flex gap-2">
            <span className="select-none w-4 text-right shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
              {i + 1}
            </span>
            <span className="whitespace-pre-wrap break-all">
              {highlightLine(line).map((span, j) => (
                <span
                  key={j}
                  style={{
                    ...(span.color
                      ? { color: span.color }
                      : diffLineColor(line)
                        ? { color: diffLineColor(line) }
                        : {}),
                    fontWeight: span.bold ? 600 : undefined,
                  }}
                >
                  {span.text}
                </span>
              ))}
            </span>
          </div>
        ))}
        {hunks.length > HUNK_COLLAPSE_THRESHOLD && (
          <button
            onClick={() => onToggleHunkCollapse(path)}
            className="mt-1 text-[10px] font-semibold cursor-pointer hover:opacity-80"
            style={{ color: 'var(--color-info)' }}
            aria-expanded={!folded}
          >
            {folded ? `Show ${hunks.length - HUNK_COLLAPSE_THRESHOLD} more lines` : 'Collapse lines'}
          </button>
        )}
      </div>
    );
  };

  const renderFile = (file: FileEntry): React.ReactNode => {
    const collapsed = collapsedPaths.has(file.path);
    return (
      <div
        key={file.path}
        data-testid="diff-file"
        className="rounded-lg border overflow-hidden mb-1.5"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <button
          onClick={() => onTogglePath(file.path)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left cursor-pointer hover:opacity-90"
          style={{ background: 'var(--color-surface-raised)' }}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          <span className="font-mono text-[11px] truncate flex-1" style={{ color: 'var(--color-text)' }}>
            {/* §162 hierarchical tree — leaf basename under its directory node */}
            {file.path.split('/').pop()}
          </span>
          <span className="font-mono text-[10px]" style={{ color: 'var(--color-success)' }}>
            +{file.additions}
          </span>
          <span className="font-mono text-[10px]" style={{ color: 'var(--color-danger)' }}>
            −{file.deletions}
          </span>
        </button>
        {!collapsed && renderHunks(file.path)}
      </div>
    );
  };

  const renderNodes = (nodes: TreeNode[]): React.ReactNode =>
    nodes.map((node) => {
      if (node.file) return renderFile(node.file);
      const open = !openDirs.has(node.fullPath);
      return (
        <div key={`dir:${node.fullPath}`} className="mb-1.5">
          <button
            onClick={() => toggleDir(node.fullPath)}
            className="flex items-center gap-1.5 w-full px-2 py-1 text-left cursor-pointer hover:opacity-90 rounded"
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown className="w-3 h-3 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />
            )}
            <span
              className="font-mono text-[11px] font-semibold truncate"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {node.name}/
            </span>
          </button>
          {open && <div style={{ paddingLeft: 10 }}>{renderNodes(node.children)}</div>}
        </div>
      );
    });

  return <div data-testid="diff-file-tree">{renderNodes(tree)}</div>;
}

export function GitHubDiffViewer({
  action,
  defaultBranch,
  mergeEnabled = true,
  onClose,
  onApproveAndMerge,
}: GitHubDiffViewerProps) {
  const [copied, setCopied] = useState(false);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [hunkExpandedPaths, setHunkExpandedPaths] = useState<Set<string>>(new Set());
  const [showPrPreview, setShowPrPreview] = useState(false);
  /** §164 — merge confirm lives in a real dialog, never an inline surprise. */
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  const payload = useMemo(() => (action?.payload ?? {}) as Record<string, unknown>, [action]);
  const branch = typeof payload.branch === 'string' ? payload.branch : null;
  const files = useMemo(() => readFiles(payload), [payload]);
  const totalAdds = files.reduce((s, f) => s + f.additions, 0);
  const totalDels = files.reduce((s, f) => s + f.deletions, 0);

  const togglePath = (path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleHunkCollapse = (path: string) => {
    setHunkExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const allHunks = useMemo(() => {
    const lines: string[] = [];
    for (const f of files) lines.push(...readHunksFor(payload, f.path));
    return lines;
  }, [files, payload]);

  const handleCopyDiff = async () => {
    const okCopy = await copyToClipboard(allHunks.join('\n'));
    if (okCopy) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const riskBadge = () => {
    const level = action?.risk_level ?? '';
    if (!level) return null;
    if (level === 'CRITICAL' || level === 'HIGH')
      return (
        <Badge variant="danger" size="sm">
          Risk: {level}
        </Badge>
      );
    if (level === 'MEDIUM')
      return (
        <Badge variant="warning" size="sm">
          Risk: {level}
        </Badge>
      );
    return (
      <Badge variant="neutral" size="sm">
        Risk: {level}
      </Badge>
    );
  };

  if (!action) return null;

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
              {branch ? `PR: ${branch}` : 'Change review'}
            </h3>
            <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
              <GitBranch className="w-2.5 h-2.5" aria-hidden="true" />
              {branch ?? '—'}
              {defaultBranch ? ` → ${defaultBranch}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {riskBadge()}
          <button
            onClick={onClose}
            aria-label="Close diff viewer"
            className="p-1 cursor-pointer hover:opacity-80"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
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
            onClick={() => void handleCopyDiff()}
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

        {files.length === 0 ? (
          <p
            className="text-[11px] p-3 rounded-lg border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            No changed-file details are available for this action yet. The approval card stays authoritative.
          </p>
        ) : (
          /* §162 hierarchical file tree with hunk collapse */
          <DiffBody
            action={action}
            collapsedPaths={collapsedPaths}
            hunkExpandedPaths={hunkExpandedPaths}
            onTogglePath={togglePath}
            onToggleHunkCollapse={toggleHunkCollapse}
          />
        )}

        {/* §162 PR preview — payload-driven title/description only */}
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
              {typeof payload.pr_title === 'string' ? payload.pr_title : `PR: ${branch ?? 'branch'}`}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
              {typeof payload.pr_description === 'string'
                ? payload.pr_description
                : `${files.length} file${files.length === 1 ? '' : 's'} · +${totalAdds} −${totalDels}`}
            </p>
            <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
              {typeof payload.base_sha === 'string' ? `base ${payload.base_sha.slice(0, 7)}` : ''}
              {typeof payload.target_sha === 'string'
                ? ` · head ${payload.target_sha.slice(0, 7)}`
                : ''}
            </p>
          </div>
        )}

        {/* §164 Merge — high impact, explicit confirmation dialog */}
        {mergeEnabled && onApproveAndMerge && (
          <Button size="sm" variant="primary" className="w-full" onClick={() => setMergeDialogOpen(true)} aria-label="Approve and merge this pull request">
            Approve &amp; Merge
          </Button>
        )}
      </div>

      <Dialog
        open={mergeDialogOpen}
        onOpenChange={(open) => {
          setMergeDialogOpen(open);
        }}
        title="Merge pull request"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setMergeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setMergeDialogOpen(false);
                onApproveAndMerge?.();
              }}
              aria-label="Confirm merge of this pull request"
            >
              Merge
            </Button>
          </>
        }
      >
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          This changes the connected repository.
        </p>
        {branch && (
          <p className="text-[11px] font-mono mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
            {branch}
            {defaultBranch ? ` → ${defaultBranch}` : ''}
          </p>
        )}
      </Dialog>
    </div>
  );
}
