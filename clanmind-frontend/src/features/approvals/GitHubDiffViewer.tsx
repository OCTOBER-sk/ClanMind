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
 * M3: diff rows surface-container-lowest, additions success state-layer,
 * deletions error state-layer (subtle), sticky header tonal, motion-reduce.
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
  if (line.startsWith('+')) return 'var(--md-success)';
  if (line.startsWith('-')) return 'var(--md-error)';
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
        <p className="px-3 py-2 border-t border-outline-variant text-[10px] text-on-surface-variant">
          Line-level changes not available for this file — stats above are authoritative.
        </p>
      );
    }
    // §162 hunk collapse — long hunks fold behind "Show N more lines" by
    // default; a path is unfolded only once the user explicitly expands it.
    const folded = hunks.length > HUNK_COLLAPSE_THRESHOLD && !hunkExpandedPaths.has(path);
    const visible = folded ? hunks.slice(0, HUNK_COLLAPSE_THRESHOLD) : hunks;
    return (
      <div className="px-3 py-2 space-y-0.5 border-t border-outline-variant font-mono text-[11px] bg-surface-container-lowest">
        {visible.map((line, i) => {
          const isAdd = line.startsWith('+');
          const isDel = line.startsWith('-');
          return (
            <div
              key={i}
              className={
                isAdd
                  ? 'flex gap-2 rounded-xs bg-[color-mix(in_srgb,var(--md-success)_8%,transparent)]'
                  : isDel
                    ? 'flex gap-2 rounded-xs bg-[color-mix(in_srgb,var(--md-error)_8%,transparent)]'
                    : 'flex gap-2'
              }
            >
              <span className="select-none w-4 text-right shrink-0 text-on-surface-variant">{i + 1}</span>
              <span className="whitespace-pre-wrap break-all">
                {highlightLine(line).map((span, j) => (
                  <span
                    key={j}
                    style={{
                      ...(span.color
                        ? { color: span.color }
                        : diffLineColor(line)
                          ? { color: diffLineColor(line) }
                          : { color: 'var(--md-on-surface)' }),
                      fontWeight: span.bold ? 600 : undefined,
                    }}
                  >
                    {span.text}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
        {hunks.length > HUNK_COLLAPSE_THRESHOLD && (
          <button
            onClick={() => onToggleHunkCollapse(path)}
            className="mt-1 text-[10px] font-semibold cursor-pointer hover:opacity-80 outline-none focus-visible:shadow-[var(--md-focus-ring)] rounded-full px-2 py-0.5 transition-colors duration-micro ease-emphasized motion-reduce:transition-none text-tertiary"
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
        className="rounded-md border border-outline-variant overflow-hidden mb-1.5 bg-surface-container-lowest motion-reduce:transition-none"
      >
        <button
          onClick={() => onTogglePath(file.path)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left cursor-pointer outline-none focus-visible:shadow-[var(--md-focus-ring)] relative isolate overflow-hidden before:absolute before:inset-0 before:bg-[var(--md-on-surface)] before:opacity-0 hover:before:opacity-[0.08] active:before:opacity-[0.10] before:transition-opacity before:duration-micro motion-reduce:before:transition-none transition-colors duration-micro ease-emphasized bg-surface-container-lowest"
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5 shrink-0 text-on-surface-variant relative" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0 text-on-surface-variant relative" aria-hidden="true" />}
          <span className="font-mono text-[11px] truncate flex-1 text-on-surface relative">{file.path.split('/').pop()}</span>
          <span className="font-mono text-[10px] text-success relative">+{file.additions}</span>
          <span className="font-mono text-[10px] text-error relative">−{file.deletions}</span>
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
            className="flex items-center gap-1.5 w-full px-2 py-1 text-left cursor-pointer hover:opacity-80 rounded outline-none focus-visible:shadow-[var(--md-focus-ring)] transition-colors duration-micro ease-emphasized motion-reduce:transition-none"
            aria-expanded={open}
          >
            {open ? <ChevronDown className="w-3 h-3 shrink-0 text-on-surface-variant" aria-hidden="true" /> : <ChevronRight className="w-3 h-3 shrink-0 text-on-surface-variant" aria-hidden="true" />}
            <span className="font-mono text-[11px] font-semibold truncate text-on-surface-variant">{node.name}/</span>
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
    <div className="flex flex-col h-full border-l border-outline-variant text-xs bg-surface motion-reduce:transition-none">
      {/* Header — sticky tonal */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant bg-surface-container-high sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <GitPullRequest className="w-4 h-4 shrink-0 text-tertiary" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="font-bold truncate text-on-surface">{branch ? `PR: ${branch}` : 'Change review'}</h3>
            <p className="text-[10px] flex items-center gap-1 font-mono text-on-surface-variant">
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
            className="p-1.5 rounded-full cursor-pointer outline-none focus-visible:shadow-[var(--md-focus-ring)] relative isolate overflow-hidden before:absolute before:inset-0 before:bg-current before:opacity-0 hover:before:opacity-[0.08] active:before:opacity-[0.10] before:transition-opacity before:duration-micro motion-reduce:before:transition-none text-on-surface-variant transition-colors duration-micro ease-emphasized"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface">
        {/* §299 diff preview before approval */}
        <div className="flex items-center gap-2">
          <Badge variant="success" size="sm">
            +{totalAdds}
          </Badge>
          <Badge variant="danger" size="sm">
            −{totalDels}
          </Badge>
          <span className="text-[10px] flex-1 font-mono text-on-surface-variant">{files.length} file{files.length === 1 ? '' : 's'} changed</span>
          <button
            onClick={() => void handleCopyDiff()}
            className="inline-flex items-center gap-1 text-[10px] font-semibold cursor-pointer hover:opacity-80 outline-none focus-visible:shadow-[var(--md-focus-ring)] rounded-full px-2 py-1 transition-colors duration-micro ease-emphasized motion-reduce:transition-none text-on-surface-variant"
            aria-label="Copy diff"
          >
            {copied ? <Check className="w-3 h-3 text-success" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {files.length === 0 ? (
          <p className="text-[11px] p-3 rounded-md border border-outline-variant bg-surface-container-low text-on-surface-variant">
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
          className="w-full flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-80 outline-none focus-visible:shadow-[var(--md-focus-ring)] rounded-md px-1 py-1 transition-colors duration-micro ease-emphasized motion-reduce:transition-none text-on-surface-variant"
          aria-expanded={showPrPreview}
        >
          {showPrPreview ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
          <GitCommitHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
          PR preview
        </button>
        {showPrPreview && (
          <div className="p-3 rounded-md border border-outline-variant bg-surface-container-low space-y-2 motion-reduce:transition-none">
            <p className="font-bold text-on-surface">{typeof payload.pr_title === 'string' ? payload.pr_title : `PR: ${branch ?? 'branch'}`}</p>
            <p className="text-[11px] text-on-surface-variant">
              {typeof payload.pr_description === 'string' ? payload.pr_description : `${files.length} file${files.length === 1 ? '' : 's'} · +${totalAdds} −${totalDels}`}
            </p>
            <p className="text-[10px] font-mono text-on-surface-variant">
              {typeof payload.base_sha === 'string' ? `base ${payload.base_sha.slice(0, 7)}` : ''}
              {typeof payload.target_sha === 'string' ? ` · head ${payload.target_sha.slice(0, 7)}` : ''}
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
        <p className="text-xs text-on-surface-variant">This changes the connected repository.</p>
        {branch && <p className="text-[11px] font-mono mt-2 text-on-surface-variant">{branch}{defaultBranch ? ` → ${defaultBranch}` : ''}</p>}
      </Dialog>
    </div>
  );
}
