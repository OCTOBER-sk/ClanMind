/**
 * P6 — artifact live-construction state (FE §97–§100, §204).
 *
 * Verifies progressive arrival ordering, idempotent replays, one-time
 * completion and the textual status channel used by reduced motion (§219).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useConstructionStore,
  getConstruction,
} from './constructionStore';

function reset(): void {
  useConstructionStore.setState({ byArtifact: {} });
}

describe('constructionStore', () => {
  beforeEach(reset);

  it('begins a construction trace with empty draft', () => {
    useConstructionStore.getState().beginConstruction('art1');
    const c = getConstruction(useConstructionStore.getState().byArtifact, 'art1');
    expect(c).not.toBeNull();
    expect(c!.phase).toBe('constructing');
    expect(c!.nodeOrder).toEqual([]);
    expect(c!.draft.nodes).toEqual([]);
  });

  it('records node arrivals in order with status text (§97)', () => {
    const s = useConstructionStore.getState();
    s.beginConstruction('art1');
    s.nodeCreated('art1', { id: 'a', label: 'A' });
    s.nodeCreated('art1', { id: 'b', label: 'B' });
    const c = getConstruction(useConstructionStore.getState().byArtifact, 'art1')!;
    expect(c.nodeOrder).toEqual(['a', 'b']);
    expect(c.statusText).toBe('Building · 2 nodes');
    expect(c.draft.nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('ignores duplicate node arrivals (idempotent replays)', () => {
    const s = useConstructionStore.getState();
    s.beginConstruction('art1');
    s.nodeCreated('art1', { id: 'a', label: 'A' });
    s.nodeCreated('art1', { id: 'a', label: 'A' });
    expect(getConstruction(useConstructionStore.getState().byArtifact, 'art1')!.nodeOrder).toHaveLength(1);
  });

  it('bumps node revision on update — re-animate only that node (§204)', () => {
    const s = useConstructionStore.getState();
    s.beginConstruction('art1');
    s.nodeCreated('art1', { id: 'a', label: 'A' });
    s.nodeUpdated('art1', { id: 'a', label: 'A v2' });
    const c = getConstruction(useConstructionStore.getState().byArtifact, 'art1')!;
    expect(c.revisionByNode['a']).toBe(1);
    expect(c.draft.nodes[0]!.label).toBe('A v2');
    // Node count must not grow on update.
    expect(c.nodeOrder).toEqual(['a']);
  });

  it('records edges keyed by id or endpoints, deduped', () => {
    const s = useConstructionStore.getState();
    s.beginConstruction('art1');
    s.edgeCreated('art1', { source: 'a', target: 'b', label: 'uses' });
    s.edgeCreated('art1', { source: 'a', target: 'b', label: 'uses' });
    const c = getConstruction(useConstructionStore.getState().byArtifact, 'art1')!;
    expect(c.edgeOrder).toEqual(['a->b']);
    expect(c.draft.edges).toHaveLength(1);
  });

  it('completion fires exactly once and settles status (§100)', () => {
    const s = useConstructionStore.getState();
    s.beginConstruction('art1');
    s.completeConstruction('art1');
    const first = getConstruction(useConstructionStore.getState().byArtifact, 'art1')!;
    expect(first.phase).toBe('ready');
    expect(first.completedAt).not.toBeNull();
    const at = first.completedAt;
    s.completeConstruction('art1');
    const second = getConstruction(useConstructionStore.getState().byArtifact, 'art1')!;
    expect(second.completedAt).toBe(at); // unchanged → glow cannot re-fire
  });

  it('render state changes feed the textual status channel (§219)', () => {
    const s = useConstructionStore.getState();
    s.beginConstruction('art1');
    s.renderStateChanged('art1', 'Settling layout');
    expect(getConstruction(useConstructionStore.getState().byArtifact, 'art1')!.statusText).toBe('Settling layout');
  });

  it('clearConstruction removes the trace', () => {
    const s = useConstructionStore.getState();
    s.beginConstruction('art1');
    s.clearConstruction('art1');
    expect(getConstruction(useConstructionStore.getState().byArtifact, 'art1')).toBeNull();
  });
});
