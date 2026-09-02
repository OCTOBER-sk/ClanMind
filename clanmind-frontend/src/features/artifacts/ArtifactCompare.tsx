/**
 * Version compare (FE §103) — per-type, human-readable diffs:
 *   • Documents / code  → line diff
 *   • Diagrams          → STRUCTURAL diff (+ side-by-side previews)
 *   • Tables            → changed rows/values
 *   • Anything else     → version metadata summary
 * Raw JSON is never exposed by default.
 */

import { useMemo, useState } from 'react';
import { ArrowLeftRight, Columns2, GitCompare, Rows3 } from 'lucide-react';
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
  // §47 — split/unified toggle for line diffs.
  const [diffView, setDiffView] = useState<'unified' | 'split'>('unified');
  // All hooks run unconditionally — branching happens only at render time.
  const header = (
    <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container px-4 py-3 motion-reduce:transition-none">
      <div className="flex min-w-0 items-center gap-2">
        <GitCompare className="h-4 w-4 shrink-0 text-tertiary" aria-hidden="true" />
        <h3 className="truncate text-xs font-bold text-on-surface">
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
      <div className="flex h-full flex-col overflow-hidden bg-surface-container-low">
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4 bg-surface-container-lowest">
          <section aria-label="Structural changes">
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
              <ArrowLeftRight className="h-3 w-3" aria-hidden="true" /> Structural changes
            </h4>
            {empty ? (
              <p className="text-xs text-on-surface-variant">No structural changes — same nodes and connections.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {d.addedNodes.map((n) => (
                  <li key={`an-${n.id}`} className="rounded-sm px-1.5 py-0.5 bg-success-container/30 text-on-success-container border border-success/10">+ Node · {n.label}</li>
                ))}
                {d.removedNodes.map((n) => (
                  <li key={`rn-${n.id}`} className="rounded-sm px-1.5 py-0.5 bg-error-container/30 text-on-error-container border border-error/10">− Node · {n.label}</li>
                ))}
                {d.relabeledNodes.map((n) => (
                  <li key={`rl-${n.before}`} className="rounded-sm px-1.5 py-0.5 bg-surface-container text-on-surface-variant border border-outline-variant">~ {n.before} → {n.after}</li>
                ))}
                {d.addedEdges.map((e) => (
                  <li key={`ae-${e.id ?? `${e.source}->${e.target}`}`} className="rounded-sm px-1.5 py-0.5 bg-success-container/30 text-on-success-container border border-success/10">
                    + Connection · {e.source} → {e.target}{e.label ? ` (${e.label})` : ''}
                  </li>
                ))}
                {d.removedEdges.map((e) => (
                  <li key={`re-${e.id ?? `${e.source}->${e.target}`}`} className="rounded-sm px-1.5 py-0.5 bg-error-container/30 text-on-error-container border border-error/10">
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
                <figure key={v.version_number} className="overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest">
                  <figcaption className="border-b border-outline-variant bg-surface-container px-2.5 py-1.5 text-[10px] font-semibold text-on-surface-variant">
                    v{v.version_number} · {v.created_by_name}
                  </figcaption>
                  <img
                    src={svgDataUrl(diagramToSvg(parsed))}
                    alt={`Diagram preview of version ${v.version_number}`}
                    className="w-full bg-surface-container-lowest"
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
      <div className="flex h-full flex-col overflow-hidden bg-surface-container-low">
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 bg-surface-container-lowest">
          {empty ? (
            <p className="text-xs text-on-surface-variant">No changed values between these versions.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {tableDiff.headerChanges.map((c) => (
                <li key={`h-${c.columnIndex}`} className="rounded-sm px-1.5 py-0.5 bg-surface-container border border-outline-variant">
                  Column renamed: <s className="text-error decoration-error/60">{c.before}</s>{' '}
                  <span className="text-success bg-success-container/30 px-1 rounded-sm">{c.after}</span>
                </li>
              ))}
              {tableDiff.cellChanges.map((c) => (
                <li key={`${c.rowIndex}-${c.columnIndex}`} className="rounded-sm px-1.5 py-0.5 bg-surface-container-lowest border border-outline-variant">
                  Row {c.rowIndex + 1} · {c.header}:{' '}
                  <s className="text-error bg-error-container/30 px-1 rounded-sm decoration-error/60">{c.before || '—'}</s>{' '}
                  <span className="text-success bg-success-container/30 px-1 rounded-sm">{c.after || '—'}</span>
                </li>
              ))}
              {tableDiff.addedRowCount > 0 && (
                <li className="rounded-sm px-1.5 py-0.5 bg-success-container/30 text-on-success-container border border-success/10">+ {tableDiff.addedRowCount} row(s) added</li>
              )}
              {tableDiff.removedRowCount > 0 && (
                <li className="rounded-sm px-1.5 py-0.5 bg-error-container/30 text-on-error-container border border-error/10">− {tableDiff.removedRowCount} row(s) removed</li>
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
      <div className="flex h-full flex-col overflow-hidden bg-surface-container-low">
        {header}
        {/* §47 — view mode toggle */}
        <div className="flex items-center gap-1 border-b border-outline-variant bg-surface-container px-4 py-1.5">
          <span className="mr-2 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">View</span>
          <button
            onClick={() => setDiffView('unified')}
            aria-pressed={diffView === 'unified'}
            aria-label="Unified diff view"
            className={cn(
              'flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition-colors duration-micro ease-emphasized motion-reduce:transition-none focus-visible:shadow-[var(--md-focus-ring)] focus-visible:outline-none relative isolate overflow-hidden before:absolute before:inset-0 before:bg-current before:opacity-0 hover:before:opacity-[0.08] before:transition-opacity',
              diffView === 'unified'
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            <Rows3 className="h-3 w-3" aria-hidden="true" />
            Unified
          </button>
          <button
            onClick={() => setDiffView('split')}
            aria-pressed={diffView === 'split'}
            aria-label="Split diff view"
            className={cn(
              'flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition-colors duration-micro ease-emphasized motion-reduce:transition-none focus-visible:shadow-[var(--md-focus-ring)] focus-visible:outline-none relative isolate overflow-hidden before:absolute before:inset-0 before:bg-current before:opacity-0 hover:before:opacity-[0.08] before:transition-opacity',
              diffView === 'split'
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            <Columns2 className="h-3 w-3" aria-hidden="true" />
            Split
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed select-text bg-surface-container-lowest">
          {diffView === 'unified' ? (
            // §47 — Unified view: all lines in one column with +/- markers.
            rows.map((row, i) => (
              <div
                key={i}
                className={cn(
                  'flex gap-2 px-4 py-px',
                  row.type === 'added' && 'bg-success-container/30 text-on-success-container',
                  row.type === 'removed' && 'bg-error-container/30 text-on-error-container',
                )}
              >
                <span className="w-8 shrink-0 text-right text-on-surface-variant" aria-hidden="true">
                  {row.lineA ?? row.lineB ?? ''}
                </span>
                <span
                  className={cn(
                    'w-3 shrink-0',
                    row.type === 'added' && 'text-success',
                    row.type === 'removed' && 'text-error',
                  )}
                  aria-label={row.type === 'added' ? 'added line' : row.type === 'removed' ? 'removed line' : undefined}
                >
                  {row.type === 'added' ? '+' : row.type === 'removed' ? '−' : ''}
                </span>
                <span className="whitespace-pre-wrap text-on-surface">{row.text || ' '}</span>
              </div>
            ))
          ) : (
            // §47 — Split view: removed on left, added on right.
            <div className="grid grid-cols-2 divide-x divide-outline-variant">
              <div className="overflow-x-auto" role="region" aria-label="Before version">
                <div className="px-1.5 py-1 text-center text-[9px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant bg-surface-container">
                  v{versionB.version_number} — Before
                </div>
                {rows.map((row, i) => (
                  <div
                    key={`l-${i}`}
                    className={cn(
                      'flex gap-1 px-2 py-px',
                      row.type === 'removed' && 'bg-error-container/30',
                      row.type === 'added' && 'opacity-30',
                    )}
                  >
                    <span className="w-6 shrink-0 text-right text-on-surface-variant" aria-hidden="true">
                      {row.lineA ?? ''}
                    </span>
                    <span className="whitespace-pre-wrap text-on-surface">
                      {row.type !== 'added' ? (row.text || ' ') : ''}
                    </span>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto" role="region" aria-label="After version">
                <div className="px-1.5 py-1 text-center text-[9px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant bg-surface-container">
                  v{versionA.version_number} — After
                </div>
                {rows.map((row, i) => (
                  <div
                    key={`r-${i}`}
                    className={cn(
                      'flex gap-1 px-2 py-px',
                      row.type === 'added' && 'bg-success-container/30',
                      row.type === 'removed' && 'opacity-30',
                    )}
                  >
                    <span className="w-6 shrink-0 text-right text-on-surface-variant" aria-hidden="true">
                      {row.lineB ?? ''}
                    </span>
                    <span className="whitespace-pre-wrap text-on-surface">
                      {row.type !== 'removed' ? (row.text || ' ') : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Fallback: version metadata summary (never raw JSON) ──────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-container-low">
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 bg-surface-container-lowest">
        <div className="grid grid-cols-2 gap-3">
          {[versionB, versionA].map((v) => (
            <div key={v.version_number} className="rounded-md border border-outline-variant bg-surface-container p-3 text-xs motion-reduce:transition-none">
              <p className="font-bold text-on-surface">Version {v.version_number}</p>
              <dl className="mt-2 space-y-1 text-on-surface-variant">
                <div><dt className="inline font-semibold">Creator: </dt><dd className="inline text-on-surface">{v.created_by_name}</dd></div>
                <div><dt className="inline font-semibold">Saved: </dt><dd className="inline">{new Date(v.created_at).toLocaleString()}</dd></div>
                {v.change_summary && <div><dt className="inline font-semibold">Change: </dt><dd className="inline">{v.change_summary}</dd></div>}
              </dl>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-on-surface-variant">
          A visual comparison for this artifact type is not available yet — both versions stay
          viewable and restorable.
        </p>
      </div>
      </div>
    );
  }
