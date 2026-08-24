/**
 * Version-compare primitives (FE §103). Pure functions — no raw JSON is ever
 * surfaced to users; every consumer renders these structured results.
 */

// ─── Document / code line diff ───────────────────────────────────────────────

export type LineDiffType = 'same' | 'added' | 'removed';

export interface LineDiffRow {
  type: LineDiffType;
  text: string;
  /** 1-based line number in the BEFORE document (removed/same rows). */
  lineA?: number;
  /** 1-based line number in the AFTER document (added/same rows). */
  lineB?: number;
}

/** Classic LCS line diff — artifact-scale docs only, never chat bodies. */
export function diffLines(before: string, after: string): LineDiffRow[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const n = a.length;
  const m = b.length;

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const rows: LineDiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: 'same', text: a[i]!, lineA: i + 1, lineB: j + 1 });
      i += 1;
      j += 1;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      rows.push({ type: 'removed', text: a[i]!, lineA: i + 1 });
      i += 1;
    } else {
      rows.push({ type: 'added', text: b[j]!, lineB: j + 1 });
      j += 1;
    }
  }
  while (i < n) {
    rows.push({ type: 'removed', text: a[i]!, lineA: i + 1 });
    i += 1;
  }
  while (j < m) {
    rows.push({ type: 'added', text: b[j]!, lineB: j + 1 });
    j += 1;
  }
  return rows;
}

// ─── Table diff (§103 "changed rows/values") ────────────────────────────────

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface TableCellChange {
  rowIndex: number;
  columnIndex: number;
  header: string;
  before: string;
  after: string;
}

export interface TableDiffResult {
  addedRowCount: number;
  removedRowCount: number;
  headerChanges: Array<{ columnIndex: number; before: string; after: string }>;
  cellChanges: TableCellChange[];
}

function cellText(value: unknown): string {
  if (value == null) return '';
  return typeof value === 'string' ? value : String(value);
}

/** Tolerant parser for table version content. */
export function parseTableContent(raw: unknown): TableData | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const data = JSON.parse(raw) as Partial<TableData>;
    if (!Array.isArray(data.headers) || !Array.isArray(data.rows)) return null;
    return {
      headers: data.headers.map(cellText),
      rows: data.rows.map((row) => (Array.isArray(row) ? row.map(cellText) : [])),
    };
  } catch {
    return null;
  }
}

export function diffTable(before: TableData, after: TableData): TableDiffResult {
  const headerChanges = after.headers.flatMap((header, columnIndex) => {
    const prev = before.headers[columnIndex];
    return prev !== undefined && prev !== header
      ? [{ columnIndex, before: prev, after: header }]
      : [];
  });

  const sharedRows = Math.min(before.rows.length, after.rows.length);
  const cellChanges: TableCellChange[] = [];
  for (let r = 0; r < sharedRows; r++) {
    const cols = Math.min(before.rows[r]!.length, after.rows[r]!.length);
    for (let c = 0; c < cols; c++) {
      const beforeCell = before.rows[r]![c]!;
      const afterCell = after.rows[r]![c]!;
      if (beforeCell !== afterCell) {
        cellChanges.push({
          rowIndex: r,
          columnIndex: c,
          header: after.headers[c] ?? `Column ${c + 1}`,
          before: beforeCell,
          after: afterCell,
        });
      }
    }
  }

  return {
    addedRowCount: Math.max(0, after.rows.length - before.rows.length),
    removedRowCount: Math.max(0, before.rows.length - after.rows.length),
    headerChanges,
    cellChanges,
  };
}
