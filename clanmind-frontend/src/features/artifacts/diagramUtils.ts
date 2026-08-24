/**
 * Diagram domain utilities — parsing, deterministic layout, structural diff
 * and SVG serialization for BE §74 `{nodes[], edges[]}` content.
 *
 * The backend emits stable DOMAIN schemas, never DOM/mermaid instructions
 * (BE §74). A tolerant legacy adapter accepts the old mermaid-flavoured text
 * some historical rows still carry and converts it into the same domain
 * schema — rendering stays client-owned either way.
 */

import type { DiagramContent, DiagramEdgeSpec, DiagramNodeSpec } from '@/types';

export interface ParsedDiagram {
  content: DiagramContent;
  /** True when the raw string needed the legacy text adapter. */
  legacy: boolean;
}

/** Parse structured diagram content; never throws (FE §291 tolerance). */
export function parseDiagramContent(raw: unknown): ParsedDiagram | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;

  // Modern path — already the BE §74 schema.
  if (raw.trimStart().startsWith('{')) {
    try {
      const data = JSON.parse(raw) as Partial<DiagramContent>;
      if (!Array.isArray(data.nodes)) return null;
      const nodes: DiagramNodeSpec[] = data.nodes
        .filter((n): n is DiagramNodeSpec => !!n && typeof n.id === 'string' && typeof n.label === 'string')
        .map((n) => ({ id: n.id, label: n.label, ...(n.kind ? { kind: n.kind } : {}) }));
      const known = new Set(nodes.map((n) => n.id));
      const edges: DiagramEdgeSpec[] = (Array.isArray(data.edges) ? data.edges : [])
        .filter(
          (e): e is DiagramEdgeSpec =>
            !!e && typeof e.source === 'string' && typeof e.target === 'string' &&
            known.has(e.source) && known.has(e.target),
        )
        .map((e) => ({
          id: e.id ?? `${e.source}->${e.target}`,
          source: e.source,
          target: e.target,
          ...(e.label ? { label: e.label } : {}),
        }));
      return { content: { nodes, edges }, legacy: false };
    } catch {
      return null;
    }
  }

  // Legacy adapter — `A[Label] -->|note| B[Label]` / `A --> B` line format.
  const nodes = new Map<string, DiagramNodeSpec>();
  const edges: DiagramEdgeSpec[] = [];
  const ensureNode = (token: string): string | null => {
    const match = /^([\w-]+)(?:\[([^\]]*)\]|\(([^)]*)\))?$/.exec(token.trim());
    if (!match) return null;
    const id = match[1]!;
    if (!nodes.has(id)) {
      nodes.set(id, { id, label: (match[2] ?? match[3] ?? id).trim() });
    }
    return id;
  };
  for (const line of raw.split('\n')) {
    // Drop mermaid direction headers like "graph TD".
    const edgeMatch = /^(.+?)\s*-->(?:\|([^|]*)\|)?\s*(.+)$/.exec(line.trim());
    if (!edgeMatch) continue;
    const source = ensureNode(edgeMatch[1]!);
    const target = ensureNode(edgeMatch[3]!);
    if (source && target) {
      edges.push({
        id: `${source}->${target}`,
        source,
        target,
        ...(edgeMatch[2] ? { label: edgeMatch[2].trim() } : {}),
      });
    }
  }
  if (nodes.size === 0) return null;
  return { content: { nodes: [...nodes.values()], edges }, legacy: true };
}

// ─── Deterministic layered layout (§204 — computed once per content) ────────

export interface LayoutCell {
  x: number;
  y: number;
  depth: number;
}

export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 64;
const COLUMN_GAP = 96;
const ROW_GAP = 28;

/**
 * Longest-path layering with cycle-safe traversal. Same input always yields
 * the same positions, so exports and renders are stable across sessions.
 */
export function layoutDiagram(content: DiagramContent): Map<string, LayoutCell> {
  const depthByNode = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, Set<string>>();
  for (const node of content.nodes) {
    depthByNode.set(node.id, 0);
    outgoing.set(node.id, []);
    if (!incoming.has(node.id)) incoming.set(node.id, new Set());
  }
  for (const edge of content.edges) {
    outgoing.get(edge.source)?.push(edge.target);
    incoming.get(edge.target)?.add(edge.source);
  }

  // Kahn-style relaxation — back edges simply don't deepen anything.
  let changed = true;
  let guard = content.nodes.length * 4 + 8; // hard stop against cycles
  while (changed && guard-- > 0) {
    changed = false;
    for (const edge of content.edges) {
      const current = depthByNode.get(edge.target) ?? 0;
      const candidate = (depthByNode.get(edge.source) ?? 0) + 1;
      if (candidate > current) {
        depthByNode.set(edge.target, candidate);
        changed = true;
      }
    }
  }

  const columnRows = new Map<number, string[]>();
  for (const node of content.nodes) {
    const depth = depthByNode.get(node.id) ?? 0;
    const rows = columnRows.get(depth) ?? [];
    rows.push(node.id);
    columnRows.set(depth, rows);
  }

  const cells = new Map<string, LayoutCell>();
  for (const [depth, ids] of [...columnRows.entries()].sort((a, b) => a[0] - b[0])) {
    ids.forEach((id, row) => {
      cells.set(id, {
        x: depth * (NODE_WIDTH + COLUMN_GAP),
        y: row * (NODE_HEIGHT + ROW_GAP),
        depth,
      });
    });
  }
  return cells;
}

// ─── Structural diff (FE §103 — diagrams compare structurally) ──────────────

export interface DiagramDiffResult {
  addedNodes: DiagramNodeSpec[];
  removedNodes: DiagramNodeSpec[];
  addedEdges: DiagramEdgeSpec[];
  removedEdges: DiagramEdgeSpec[];
  relabeledNodes: Array<{ before: string; after: string }>;
}

export function diffDiagram(before: DiagramContent, after: DiagramContent): DiagramDiffResult {
  const beforeNodes = new Map(before.nodes.map((n) => [n.id, n]));
  const afterNodes = new Map(after.nodes.map((n) => [n.id, n]));
  const keyOf = (e: DiagramEdgeSpec) => e.id ?? `${e.source}->${e.target}`;
  const beforeEdges = new Map(before.edges.map((e) => [keyOf(e), e]));
  const afterEdges = new Map(after.edges.map((e) => [keyOf(e), e]));

  return {
    addedNodes: after.nodes.filter((n) => !beforeNodes.has(n.id)),
    removedNodes: before.nodes.filter((n) => !afterNodes.has(n.id)),
    addedEdges: after.edges.filter((e) => !beforeEdges.has(keyOf(e))),
    removedEdges: before.edges.filter((e) => !afterEdges.has(keyOf(e))),
    relabeledNodes: after.nodes.flatMap((n) => {
      const prev = beforeNodes.get(n.id);
      return prev && prev.label !== n.label ? [{ before: prev.label, after: n.label }] : [];
    }),
  };
}

// ─── Standalone SVG export (§254) ────────────────────────────────────────────

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Serialize a diagram to a self-contained SVG document using the SAME
 * deterministic layout as the interactive renderer. Pure string building —
 * no DOM required (unit-testable, worker-safe).
 */
export function diagramToSvg(content: DiagramContent, title?: string): string {
  const cells = layoutDiagram(content);
  let maxX = 0;
  let maxY = 0;
  for (const cell of cells.values()) {
    maxX = Math.max(maxX, cell.x + NODE_WIDTH);
    maxY = Math.max(maxY, cell.y + NODE_HEIGHT);
  }
  const pad = 32;
  const headerH = title ? 40 : 0;
  const width = Math.max(maxX + pad * 2, 320);
  const height = maxY + pad * 2 + headerH;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, sans-serif">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  if (title) {
    parts.push(
      `<text x="${pad}" y="${pad + 12}" font-size="15" font-weight="600" fill="#111827">${escapeXml(title)}</text>`,
    );
  }

  // Edges first so nodes overlay their endpoints.
  for (const edge of content.edges) {
    const a = cells.get(edge.source);
    const b = cells.get(edge.target);
    if (!a || !b) continue;
    const x1 = a.x + NODE_WIDTH;
    const y1 = a.y + NODE_HEIGHT / 2 + headerH;
    const x2 = b.x;
    const y2 = b.y + NODE_HEIGHT / 2 + headerH;
    const midX = (x1 + x2) / 2;
    parts.push(
      `<path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2 - 6} ${y2}" fill="none" stroke="#9ca3af" stroke-width="1.5"/>`,
      `<polygon points="${x2},${y2} ${x2 - 7},${y2 - 4} ${x2 - 7},${y2 + 4}" fill="#9ca3af"/>`,
    );
    if (edge.label) {
      parts.push(
        `<text x="${midX}" y="${(y1 + y2) / 2 - 6}" font-size="10" fill="#6b7280" text-anchor="middle">${escapeXml(edge.label)}</text>`,
      );
    }
  }

  for (const node of content.nodes) {
    const cell = cells.get(node.id);
    if (!cell) continue;
    const x = cell.x + pad;
    const y = cell.y + pad + headerH;
    parts.push(
      `<rect x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="12" fill="#ffffff" stroke="#d1d5db"/>`,
      `<text x="${x + NODE_WIDTH / 2}" y="${y + 26}" font-size="11" font-weight="700" fill="#374151" text-anchor="middle">${escapeXml(node.kind?.toUpperCase() ?? 'NODE')}</text>`,
    );
    // Plain <text> keeps the export rasterizable everywhere (no foreignObject).
    const words = node.label.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > 24) {
        if (current) lines.push(current.trim());
        current = word;
      } else {
        current = `${current} ${word}`;
      }
    }
    if (current.trim()) lines.push(current.trim());
    lines.slice(0, 2).forEach((line, i) => {
      parts.push(
        `<text x="${x + NODE_WIDTH / 2}" y="${y + 42 + i * 13}" font-size="11" font-weight="600" fill="#111827" text-anchor="middle">${escapeXml(line)}</text>`,
      );
    });
  }

  parts.push('</svg>');
  return parts.join('\n');
}
