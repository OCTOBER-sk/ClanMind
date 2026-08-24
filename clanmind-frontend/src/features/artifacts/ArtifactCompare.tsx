/**
 * Version compare (FE §103) — per-type, human-readable diffs:
 *   • Documents / code  → line diff
 *   • Diagrams          → STRUCTURAL diff (+ side-by-side previews)
 *   • Tables            → changed rows/values
 *   • Anything else     → version metadata summary
 * Raw JSON is never exposed by default.
 */

import { useMemo } from 'react';
import { ArrowLeftRight, GitCompare } from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import {
  diffDiagram,
  diagramToSvg,
  parseDiagramContent,
} from './diagramUtils';
import { diffLines, diffTable, parseTableContent } from './diffUtils';
import { cn } from '@/design-system/utils';
import type { ArtifactType, ArtifactVersion } from '@/types';

export interface ArtifactCompareProps {
  artifactType: ArtifactType;
  versionA: ArtifactVersion;
  versionB: ArtifactVersion;
  onClose: () => void;
}

const DIAGRAM_FAMILY = new Set<ArtifactType>([
  'DIAGRAM', 'FLOWCHART', 'ARCHITECTURE', 'GRAPH', 'TIMELINE', 'MINDMAP', 'DECISION_TREE',
]);
const LINE_DIFF_FAMILY = new Set<ArtifactType>(['DOCUMENT', 'MARKDOWN', 'RESEARCH', 'CODE']);

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function ArtifactCompare({ artifactType, versionA, versionB, onClose }: ArtifactCompareProps) {
  // All hooks run unconditionally — branching happens only at render time.
  const header = (
    <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <GitCompare className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
        <h3 className="truncate text-xs font-bold text-[var(--color-text)]">
          Comparing v{versionB.version_number} → v{versionA.version_number}
        </h3>
      </div>
      <Button size="sm" variant="ghost" onClick={onClose}>
        Exit compare
      </Button>
    </div>
  );

  const diagramDiff = useMemo(() => {
    if (!DIAGRAM_FAMILY.has(artifactType)) return null;
    const before = parseDiagramContent(versionB.content);
    const after = parseDiagramContent(versionA.content);
    if (!before || !after) return undefined;
    return { result: diffDiagram(before.content, after.content), before: before.content, after: after.content };
  }, [artifactType, versionA.content, versionB.content]);

  const tableDiff = useMemo(() => {
    if (artifactType !== 'TABLE') return null;
    const before = parseTableContent(versionB.content);
    const after = parseTableContent(versionA.content);
    if (!before || !after) return undefined;
    return diffTable(before, after);
  }, [artifactType, versionA.content, versionB.content]);

  const lineRows = useMemo(
    () => (LINE_DIFF_FAMILY.has(artifactType) ? diffLines(versionB.content, versionA.content) : null),
    [artifactType, versionB.content, versionA.content],
  );

  if (diagramDiff) {
    const d = diagramDiff.result;
    const empty =
      d.addedNodes.length === 0 && d.removedNodes.length === 0 && d.addedEdges.length === 0 &&
      d.removedEdges.length === 0 && d.relabeledNodes.length === 0;
    return (
      <div className="flex h-full flex-col overflow-hidden bg-[var(--color-surface-raised)]">
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          <section aria-label="Structural changes">
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">
              <ArrowLeftRight className="h-3 w-3" aria-hidden="true" /> Structural changes
            </h4>
            {empty ? (
              <p className="text-xs text-[var(--color-text-secondary)]">No structural changes — same nodes and connections.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {d.addedNodes.map((n) => (
                  <li key={`an-${n.id}`} className="text-emerald-600 dark:text-emerald-400">+ Node · {n.label}</li>
                ))}
                {d.removedNodes.map((n) => (
                  <li key={`rn-${n.id}`} className="text-red-600 dark:text-red-400">− Node · {n.label}</li>
                ))}
                {d.relabeledNodes.map((n) => (
                  <li key={`rl-${n.before}`} className="text-[var(--color-text-secondary)]">~ {n.before} → {n.after}</li>
                ))}
                {d.addedEdges.map((e) => (
                  <li key={`ae-${e.id ?? `${e.source}->${e.target}`}`} className="text-emerald-600 dark:text-emerald-400">
                    + Connection · {e.source} → {e.target}{e.label ? ` (${e.label})` : ''}
                  </li>
                ))}
                {d.removedEdges.map((e) => (
                  <li key={`re-${e.id ?? `${e.source}->${e.target}`}`} className="text-red-600 dark:text-red-400">
                    − Connection · {e.source} → {e.target}{e.label ? ` (${e.label})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Side-by-side previews rendered from OUR deterministic layout —
              images, never injected markup (§296). */}
          <div className="grid grid-cols-2 gap-3">
            {[versionB, versionA].map((v, i) => {
              const parsed = i === 0 ? diagramDiff.before : diagramDiff.after;
              return (
                <figure key={v.version_number} className="overflow-hidden rounded-lg border border-[var(--color-border)]">
                  <figcaption className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[10px] font-semibold text-[var(--color-text-secondary)]">
                    v{v.version_number} · {v.created_by_name}
                  </figcaption>
                  <img
                    src={svgDataUrl(diagramToSvg(parsed))}
                    alt={`Diagram preview of version ${v.version_number}`}
                    className="w-full bg-white"
                  />
                </figure>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── Tables: changed rows/values ──────────────────────────────────────────
  if (tableDiff) {
    const empty = tableDiff.cellChanges.length === 0 && tableDiff.addedRowCount === 0 && tableDiff.removedRowCount === 0 && tableDiff.headerChanges.length === 0;
    return (
      <div className="flex h-full flex-col overflow-hidden bg-[var(--color-surface-raised)]">
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {empty ? (
            <p className="text-xs text-[var(--color-text-secondary)]">No changed values between these versions.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {tableDiff.headerChanges.map((c) => (
                <li key={`h-${c.columnIndex}`}>
                  Column renamed: <s className="text-red-600 dark:text-red-400">{c.before}</s>{' '}
                  <span className="text-emerald-600 dark:text-emerald-400">{c.after}</span>
                </li>
              ))}
              {tableDiff.cellChanges.map((c) => (
                <li key={`${c.rowIndex}-${c.columnIndex}`}>
                  Row {c.rowIndex + 1} · {c.header}:{' '}
                  <s className="text-red-600 dark:text-red-400">{c.before || '—'}</s>{' '}
                  <span className="text-emerald-600 dark:text-emerald-400">{c.after || '—'}</span>
                </li>
              ))}
              {tableDiff.addedRowCount > 0 && (
                <li className="text-emerald-600 dark:text-emerald-400">+ {tableDiff.addedRowCount} row(s) added</li>
              )}
              {tableDiff.removedRowCount > 0 && (
                <li className="text-red-600 dark:text-red-400">− {tableDiff.removedRowCount} row(s) removed</li>
              )}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // ─── Documents / code: line diff ──────────────────────────────────────────
  if (lineRows) {
    const rows = lineRows;
    return (
      <div className="flex h-full flex-col overflow-hidden bg-[var(--color-surface-raised)]">
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed select-text">
          {rows.map((row, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-2 px-4 py-px',
                row.type === 'added' && 'bg-emerald-50/70 dark:bg-emerald-950/25',
                row.type === 'removed' && 'bg-red-50/70 dark:bg-red-950/20',
              )}
            >
              <span className="w-8 shrink-0 text-right text-[var(--color-text-tertiary)]" aria-hidden="true">
                {row.lineA ?? row.lineB ?? ''}
              </span>
              <span
                className={cn(
                  'w-3 shrink-0',
                  row.type === 'added' && 'text-emerald-600 dark:text-emerald-400',
                  row.type === 'removed' && 'text-red-600 dark:text-red-400',
                )}
                aria-label={row.type === 'added' ? 'added line' : row.type === 'removed' ? 'removed line' : undefined}
              >
                {row.type === 'added' ? '+' : row.type === 'removed' ? '−' : ''}
              </span>
              <span className="whitespace-pre-wrap text-[var(--color-text)]">{row.text || ' '}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Fallback: version metadata summary (never raw JSON) ──────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-surface-raised)]">
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {[versionB, versionA].map((v) => (
            <div key={v.version_number} className="rounded-lg border border-[var(--color-border)] p-3 text-xs">
              <p className="font-bold text-[var(--color-text)]">Version {v.version_number}</p>
              <dl className="mt-2 space-y-1 text-[var(--color-text-secondary)]">
                <div><dt className="inline font-semibold">Creator: </dt><dd className="inline">{v.created_by_name}</dd></div>
                <div><dt className="inline font-semibold">Saved: </dt><dd className="inline">{new Date(v.created_at).toLocaleString()}</dd></div>
                {v.change_summary && <div><dt className="inline font-semibold">Change: </dt><dd className="inline">{v.change_summary}</dd></div>}
              </dl>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-[var(--color-text-tertiary)]">
          A visual comparison for this artifact type is not available yet — both versions stay
          viewable and restorable.
        </p>
      </div>
      </div>
    );
  }
