/**
 * Artifact live-construction state (FE §97–§100).
 *
 * Tracks progressive arrival of nodes/edges from BE §75 streaming events so
 * the diagram renderer animates ONLY what changed (FE §204) and settles into
 * a static render afterwards (§99 — spectral never pulses indefinitely).
 * Keyed by artifact id; unknown artifacts are ignored until created arrives.
 *
 * Reduced motion (FE §219): this store additionally exposes textual progress
 * (`statusText`) so the UI can replace movement with words, never lose info.
 */

import { create } from 'zustand';
import type { DiagramContent } from '@/types';

export type ConstructionPhase = 'constructing' | 'ready';

export interface ConstructionState {
  phase: ConstructionPhase;
  /** Node ids in arrival order — drives incremental xyflow commits. */
  nodeOrder: string[];
  /** Edge ids in arrival order — each draws ONCE then goes static (§98/§99). */
  edgeOrder: string[];
  /** Bumped when a node is UPDATED after arrival — re-animates that node only. */
  revisionByNode: Record<string, number>;
  /** Human-readable build status ("Drafting architecture…", "3/6 nodes"). */
  statusText: string;
  /** Timestamp of the §100 completion — drives the ONE subtle glow. */
  completedAt: string | null;
  /**
   * Partial structured content assembled from §75 node/edge events while the
   * final version row is still streaming. Empty until events arrive; replaced
   * by the merged version content on completion. Never fabricated.
   */
  draft: DiagramContent;
}

type ConstructionMap = Record<string, ConstructionState>;

interface ConstructionStore {
  byArtifact: ConstructionMap;
  beginConstruction: (artifactId: string, initialStatus?: string) => void;
  nodeCreated: (artifactId: string, node: DiagramContent['nodes'][number]) => void;
  nodeUpdated: (artifactId: string, node: DiagramContent['nodes'][number]) => void;
  edgeCreated: (artifactId: string, edge: DiagramContent['edges'][number]) => void;
  renderStateChanged: (artifactId: string, statusText: string) => void;
  completeConstruction: (artifactId: string) => void;
  /** Clear one artifact's construction trace (version switch / unmount). */
  clearConstruction: (artifactId: string) => void;
}

const EMPTY: ConstructionState = {
  phase: 'constructing',
  nodeOrder: [],
  edgeOrder: [],
  revisionByNode: {},
  statusText: 'Preparing…',
  completedAt: null,
  draft: { nodes: [], edges: [] },
};

function ensure(map: ConstructionMap, artifactId: string): ConstructionState {
  return map[artifactId] ?? EMPTY;
}

export const useConstructionStore = create<ConstructionStore>((set) => ({
  byArtifact: {},

  beginConstruction: (artifactId, initialStatus) =>
    set((state) => ({
      byArtifact: {
        ...state.byArtifact,
        [artifactId]: {
          ...EMPTY,
          draft: { nodes: [], edges: [] },
          statusText: initialStatus || EMPTY.statusText,
        },
      },
    })),

  nodeCreated: (artifactId, node) =>
    set((state) => {
      if (!node?.id) return {};
      const current = ensure(state.byArtifact, artifactId);
      if (current.nodeOrder.includes(node.id)) return {}; // idempotent replays
      const count = current.nodeOrder.length + 1;
      return {
        byArtifact: {
          ...state.byArtifact,
          [artifactId]: {
            ...current,
            phase: 'constructing',
            completedAt: null,
            nodeOrder: [...current.nodeOrder, node.id],
            draft: {
              nodes: [...current.draft.nodes.filter((n) => n.id !== node.id), node],
              edges: current.draft.edges,
            },
            statusText: `Building · ${count} node${count === 1 ? '' : 's'}`,
          },
        },
      };
    }),

  nodeUpdated: (artifactId, node) =>
    set((state) => {
      if (!node?.id) return {};
      const current = ensure(state.byArtifact, artifactId);
      const known = current.nodeOrder.includes(node.id);
      return {
        byArtifact: {
          ...state.byArtifact,
          [artifactId]: {
            ...current,
            revisionByNode: known
              ? { ...current.revisionByNode, [node.id]: (current.revisionByNode[node.id] ?? 0) + 1 }
              : current.revisionByNode,
            draft: {
              nodes: current.draft.nodes.some((n) => n.id === node.id)
                ? current.draft.nodes.map((n) => (n.id === node.id ? node : n))
                : [...current.draft.nodes, node],
              edges: current.draft.edges,
            },
          },
        },
      };
    }),

  edgeCreated: (artifactId, edge) =>
    set((state) => {
      if (!edge?.source || !edge?.target) return {};
      const current = ensure(state.byArtifact, artifactId);
      // Edges reference nodes by id — tolerate either endpoint vocabulary.
      const edgeId = edge.id ?? `${edge.source}->${edge.target}`;
      if (current.edgeOrder.includes(edgeId)) return {};
      return {
        byArtifact: {
          ...state.byArtifact,
          [artifactId]: {
            ...current,
            phase: 'constructing',
            edgeOrder: [...current.edgeOrder, edgeId],
            draft: {
              nodes: current.draft.nodes,
              edges: [
                ...current.draft.edges.filter(
                  (e) => (e.id ?? `${e.source}->${e.target}`) !== edgeId,
                ),
                edge,
              ],
            },
          },
        },
      };
    }),

  renderStateChanged: (artifactId, statusText) =>
    set((state) => {
      if (!statusText) return {};
      const current = ensure(state.byArtifact, artifactId);
      if (current.statusText === statusText) return {};
      return {
        byArtifact: {
          ...state.byArtifact,
          [artifactId]: { ...current, statusText },
        },
      };
    }),

  completeConstruction: (artifactId) =>
    set((state) => {
      const current = ensure(state.byArtifact, artifactId);
      if (current.phase === 'ready') return {}; // glow fires exactly once
      return {
        byArtifact: {
          ...state.byArtifact,
          [artifactId]: {
            ...current,
            phase: 'ready',
            statusText: 'Ready',
            completedAt: new Date().toISOString(),
          },
        },
      };
    }),

  clearConstruction: (artifactId) =>
    set((state) => {
      if (!(artifactId in state.byArtifact)) return {};
      const next = { ...state.byArtifact };
      delete next[artifactId];
      return { byArtifact: next };
    }),
}));

/** Convenience selector — avoids fresh-object identity churn on reads. */
export function getConstruction(byArtifact: ConstructionMap, artifactId: string): ConstructionState | null {
  return byArtifact[artifactId] ?? null;
}
