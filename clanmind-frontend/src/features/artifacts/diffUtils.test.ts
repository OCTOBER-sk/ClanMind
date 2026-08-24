/**
 * P6 — version-compare primitives (FE §103) and diagram domain utilities
 * (BE §74 parsing, deterministic layout, structural diff, SVG export §254).
 */

import { describe, it, expect } from 'vitest';
import {
  parseDiagramContent,
  layoutDiagram,
  diffDiagram,
  diagramToSvg,
} from './diagramUtils';
import { diffLines, diffTable, parseTableContent } from './diffUtils';

const STRUCTURED = JSON.stringify({
  nodes: [
    { id: 'a', label: 'Sensor', kind: 'sensor' },
    { id: 'b', label: 'Controller', kind: 'processing' },
  ],
  edges: [{ source: 'a', target: 'b', label: 'data' }],
});

describe('parseDiagramContent', () => {
  it('parses the BE §74 structured schema', () => {
    const parsed = parseDiagramContent(STRUCTURED)!;
    expect(parsed.legacy).toBe(false);
    expect(parsed.content.nodes).toHaveLength(2);
    expect(parsed.content.edges[0]!.id).toBe('a->b');
  });

  it('drops edges referencing unknown nodes (never renders ghosts)', () => {
    const raw = JSON.stringify({
      nodes: [{ id: 'a', label: 'A' }],
      edges: [{ source: 'a', target: 'ghost' }],
    });
    expect(parseDiagramContent(raw)!.content.edges).toHaveLength(0);
  });

  it('adapts legacy mermaid-flavoured lines into the domain schema', () => {
    const parsed = parseDiagramContent('graph TD\n  A[Sensor] -->|spi| B[Controller]')!;
    expect(parsed.legacy).toBe(true);
    expect(parsed.content.nodes.map((n) => n.label)).toEqual(['Sensor', 'Controller']);
    expect(parsed.content.edges[0]).toMatchObject({ source: 'A', target: 'B', label: 'spi' });
  });

  it('returns null for empty/garbage content — never throws (§291)', () => {
    expect(parseDiagramContent('')).toBeNull();
    expect(parseDiagramContent('not json at all')).toBeNull();
    expect(parseDiagramContent(null)).toBeNull();
    expect(parseDiagramContent('{broken')).toBeNull();
  });
});

describe('layoutDiagram', () => {
  it('assigns deterministic layered positions', () => {
    const parsed = parseDiagramContent(STRUCTURED)!;
    const cells1 = layoutDiagram(parsed.content);
    const cells2 = layoutDiagram(parsed.content);
    expect(cells1.get('b')!.depth).toBeGreaterThan(cells1.get('a')!.depth);
    expect([...cells1.entries()]).toEqual([...cells2.entries()]);
  });

  it('survives cycles without hanging', () => {
    const cells = layoutDiagram({
      nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'a' },
      ],
    });
    expect(cells.size).toBe(2);
  });
});

describe('diffDiagram (§103 structural)', () => {
  it('reports added/removed/relabeled nodes and edges', () => {
    const before = parseDiagramContent(STRUCTURED)!.content;
    const after = parseDiagramContent(JSON.stringify({
      nodes: [
        { id: 'a', label: 'Sensor v2', kind: 'sensor' },
        { id: 'c', label: 'Radio', kind: 'hardware' },
      ],
      edges: [{ source: 'a', target: 'c' }],
    }))!.content;

    const d = diffDiagram(before, after);
    expect(d.addedNodes.map((n) => n.id)).toEqual(['c']);
    expect(d.removedNodes.map((n) => n.id)).toEqual(['b']);
    expect(d.relabeledNodes).toEqual([{ before: 'Sensor', after: 'Sensor v2' }]);
    expect(d.addedEdges).toHaveLength(1);
    expect(d.removedEdges.map((e) => e.id)).toEqual(['a->b']);
  });
});

describe('diagramToSvg (§254)', () => {
  it('produces a standalone SVG document with node labels', () => {
    const parsed = parseDiagramContent(STRUCTURED)!;
    const svg = diagramToSvg(parsed.content, 'My diagram');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('My diagram');
    expect(svg).toContain('Sensor');
    expect(svg).toContain('</svg>');
  });

  it('escapes XML-unsafe label characters', () => {
    const svg = diagramToSvg({ nodes: [{ id: 'x', label: '<A & B>' }], edges: [] });
    expect(svg).not.toContain('<A & B>');
    expect(svg).toContain('&lt;A &amp; B&gt;');
  });
});

describe('diffLines (§103 documents)', () => {
  it('classifies added and removed lines', () => {
    const rows = diffLines('one\ntwo\nthree', 'one\ntwo-plus\nthree');
    expect(rows.filter((r) => r.type === 'removed').map((r) => r.text)).toEqual(['two']);
    expect(rows.filter((r) => r.type === 'added').map((r) => r.text)).toEqual(['two-plus']);
    expect(rows.filter((r) => r.type === 'same')).toHaveLength(2);
  });

  it('handles pure additions and pure removals', () => {
    expect(diffLines('', 'a\nb').filter((r) => r.type === 'added')).toHaveLength(2);
    expect(diffLines('a\nb', '').filter((r) => r.type === 'removed')).toHaveLength(2);
  });
});

describe('table compare (§103 tables)', () => {
  it('detects changed cells and row counts', () => {
    const before = parseTableContent(JSON.stringify({
      headers: ['Signal', 'Pin'],
      rows: [['SCK', 'PA5'], ['MISO', 'PA6']],
    }))!;
    const after = parseTableContent(JSON.stringify({
      headers: ['Signal', 'Pin'],
      rows: [['SCK', 'PB3'], ['MISO', 'PA6'], ['MOSI', 'PB5']],
    }))!;

    const d = diffTable(before, after);
    expect(d.cellChanges).toEqual([{
      rowIndex: 0,
      columnIndex: 1,
      header: 'Pin',
      before: 'PA5',
      after: 'PB3',
    }]);
    expect(d.addedRowCount).toBe(1);
    expect(d.removedRowCount).toBe(0);
  });

  it('parseTableContent tolerates junk', () => {
    expect(parseTableContent('nope')).toBeNull();
    expect(parseTableContent('{}')).toBeNull();
  });
});
