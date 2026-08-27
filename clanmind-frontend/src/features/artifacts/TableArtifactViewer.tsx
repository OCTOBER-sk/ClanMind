/**
 * TABLE artifact renderer (FE §44).
 *
 * §44 requirements:
 *   • Sortable columns — click header to cycle asc → desc → none
 *   • Proper alignment — numbers right, text left
 *   • Sticky headers — visible while scrolling
 *   • Search/filter rows
 *   • Copy as CSV
 *   • Empty / error states
 *   • ARIA labels on all interactive elements
 */

import { useMemo, useState } from 'react';
import { Search, Copy, Check, ArrowUp, ArrowDown, Table2 } from 'lucide-react';
import { copyToClipboard } from '@/tauri/bridge';
import { cn } from '@/design-system/utils';

export interface TableArtifactViewerProps {
  content: string; // JSON with headers and rows
}

interface TableData {
  headers: string[];
  rows: string[][];
}

type SortDir = 'asc' | 'desc' | null;

/** Detect whether a column is predominantly numeric for right-alignment. */
function isNumericColumn(rows: string[][], colIndex: number): boolean {
  let numeric = 0;
  let total = 0;
  for (const row of rows) {
    const cell = row[colIndex];
    if (cell == null || cell === '') continue;
    total++;
    // Accept integers, floats, currency, percentages, SI suffixes
    if (/^[+-]?[\d,.]+[%kKmMbB]?$/.test(cell.trim())) numeric++;
  }
  return total > 0 && numeric / total >= 0.6;
}

/** Parse table content; returns null on invalid JSON. */
function parseTable(raw: string): TableData | null {
  if (!raw || raw.trim() === '') return null;
  try {
    const data = JSON.parse(raw) as Partial<TableData>;
    if (!Array.isArray(data.headers) || !Array.isArray(data.rows)) return null;
    return {
      headers: data.headers.map((h) => (h == null ? '' : String(h))),
      rows: data.rows.map((row) => (Array.isArray(row) ? row.map((c) => (c == null ? '' : String(c))) : [])),
    };
  } catch {
    return null;
  }
}

export function TableArtifactViewer({ content }: TableArtifactViewerProps) {
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const data = useMemo(() => parseTable(content), [content]);

  // §44 — Detect numeric columns for alignment (computed once per content).
  const numericCols = useMemo(() => {
    if (!data) return new Set<number>();
    const cols = new Set<number>();
    for (let i = 0; i < data.headers.length; i++) {
      if (isNumericColumn(data.rows, i)) cols.add(i);
    }
    return cols;
  }, [data]);

  // §44 — Sort cycle: asc → desc → clear.
  const handleSort = (colIndex: number) => {
    if (sortCol !== colIndex) {
      setSortCol(colIndex);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortCol(null);
      setSortDir(null);
    }
  };

  // Filter then sort.
  const processedRows = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)));
    }
    if (sortCol !== null && sortDir) {
      const col = sortCol;
      const dir = sortDir === 'asc' ? 1 : -1;
      const isNum = numericCols.has(col);
      rows = [...rows].sort((a, b) => {
        const va = a[col] ?? '';
        const vb = b[col] ?? '';
        if (isNum) {
          const na = parseFloat(va.replace(/[^0-9.\-]/g, ''));
          const nb = parseFloat(vb.replace(/[^0-9.\-]/g, ''));
          if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
        }
        return va.localeCompare(vb) * dir;
      });
    }
    return rows;
  }, [data, search, sortCol, sortDir, numericCols]);

  const handleCopy = async () => {
    if (!data) return;
    const csv = [data.headers.join(','), ...data.rows.map((r) => r.join(','))].join('\n');
    const ok = await copyToClipboard(csv);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // §44 — Empty / error state.
  if (!data || data.headers.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center" role="status">
        <Table2 className="h-8 w-8 text-[var(--color-text-tertiary)]" aria-hidden="true" />
        <p className="max-w-xs text-xs text-[var(--color-text-secondary)]">
          This table version has no renderable data. View an earlier version or export the raw source.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-surface-raised)] text-xs">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
        <div className="relative w-60">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[var(--color-text-tertiary)]" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rows…"
            aria-label="Search table rows"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] py-1.5 pl-8 pr-3 text-xs text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-border-strong)]"
          />
        </div>

        <div className="flex items-center gap-2">
          {data.rows.length > 0 && (
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              {processedRows.length} of {data.rows.length} row{data.rows.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={handleCopy}
            aria-label="Copy table as CSV"
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2.5 py-1.5 font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[var(--color-success)]" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied CSV' : 'Copy CSV'}</span>
          </button>
        </div>
      </div>

      {/* §44 — Table with sticky headers */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left" role="grid" aria-label={`${data.headers.join(', ')} table`}>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-text)] font-semibold">
              {data.headers.map((h, i) => {
                const isActive = sortCol === i;
                const isNum = numericCols.has(i);
                return (
                  <th
                    key={i}
                    scope="col"
                    className={cn(
                      'cursor-pointer select-none p-2.5 transition-colors hover:bg-[var(--color-surface-pressed)]',
                      isNum && 'text-right',
                    )}
                    onClick={() => handleSort(i)}
                    aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span className="inline-flex items-center gap-1">
                      {h}
                      {isActive && sortDir === 'asc' && <ArrowUp className="h-3 w-3" aria-hidden="true" />}
                      {isActive && sortDir === 'desc' && <ArrowDown className="h-3 w-3" aria-hidden="true" />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {processedRows.length === 0 ? (
              <tr>
                <td colSpan={data.headers.length} className="p-4 text-center text-[var(--color-text-tertiary)]">
                  No rows match your search.
                </td>
              </tr>
            ) : (
              processedRows.map((row, rIdx) => (
                <tr key={rIdx} className="font-mono text-[11px] transition-colors hover:bg-[var(--color-surface-hover)]">
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className={cn(
                        'p-2.5 text-[var(--color-text)]',
                        numericCols.has(cIdx) && 'text-right tabular-nums',
                      )}
                    >
                      {cell || '\u00A0'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
