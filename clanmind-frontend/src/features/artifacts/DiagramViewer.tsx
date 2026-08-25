/**
 * Diagram work-surface renderer (FE §98–§107) built on @xyflow/react.
 *
 * Content contract: BE §74 `{nodes[], edges[]}` domain schema — the client
 * owns ALL visual decisions. Live construction (§97/§98) commits nodes
 * incrementally as §75 events land, plays ONE spectral draw per edge (§99),
 * and settles static after completion (§100 glow lives in ArtifactPanel).
 *
 * Perf (FE §204): layout is computed deterministically ONCE per content
 * revision; only arrived nodes/edges are committed to React Flow; transforms
 * drive all motion. Reduced motion swaps movement for textual status (§219).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BaseEdge,
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  getSmoothStepPath,
  useReactFlow,
  useStore,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Minus, Plus, Scan, Crosshair, Sparkles } from 'lucide-react';
import { IconButton } from '@/design-system/components/IconButton';
import { Tooltip } from '@/design-system/components/Tooltip';
import { cn } from '@/design-system/utils';
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  layoutDiagram,
  parseDiagramContent,
  type LayoutCell,
} from './diagramUtils';
import {
  useConstructionStore,
  type ConstructionState,
} from './constructionStore';
import type { DiagramContent, DiagramEdgeSpec, DiagramNodeSpec } from '@/types';

export interface DiagramViewerProps {
  /** Live construction events key on this id (optional for static renders). */
  artifactId?: string;
  content: string;
  /** §106/§107 — selected object flows back to the AI composer. */
  onAskOdinAboutNode?: (nodeLabel: string) => void;
}

// ─── Custom pieces ───────────────────────────────────────────────────────────

interface CmNodeData extends Record<string, unknown> {
  label: string;
  kind?: string;
  /** Arrival index while constructing; -1 for static renders. */
  arriveIndex: number;
  /** Bumped when §75 node.updated lands — replays the settle animation. */
  revision: number;
}

type CmFlowNode = Node<CmNodeData, 'cm'>;

interface SpectralEdgeData extends Record<string, unknown> {
  /** True ONLY during live construction — draws once, then static (§99). */
  drawing: boolean;
}

function CmNodeView({ data, selected }: NodeProps<CmFlowNode>) {
  // Remount ONLY the inner surface on revision bumps so the one-shot arrival
  // animation replays without touching React Flow's node state (§204).
  const animKey = `${data.arriveIndex}-${data.revision}`;
  return (
    <div
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      className="h-full w-full"
      data-diagram-node={data.label}
    >
      <div
        key={animKey}
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-xl border bg-[var(--color-surface-raised)] px-3 text-center shadow-xs',
          selected
            ? 'border-transparent outline outline-2 outline-offset-1 outline-[var(--color-text)]'
            : 'border-[var(--color-border-strong)]',
          data.arriveIndex >= 0 && 'node-arrive',
        )}
      >
        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          {data.kind ?? 'node'}
        </span>
        <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-[var(--color-text)]">
          {data.label}
        </span>
      </div>
      {/* Hidden hit targets keep the graph wiring invisible */}
      <Handle type="target" position={Position.Left} className="!opacity-0" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="!opacity-0" isConnectable={false} />
    </div>
  );
}

function SpectralEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<SpectralEdgeData>>) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 14,
  });
  const drawing = data?.drawing === true;
  const gradientId = `cm-edge-grad-${id}`;
  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {/* Spectral restraint — gradient exists ONLY while drawing (§99). */}
          <stop offset="0%" stopColor="#7e57c2" />
          <stop offset="50%" stopColor="#7ee8fa" />
          <stop offset="100%" stopColor="#80ff72" />
        </linearGradient>
      </defs>
      <BaseEdge
        id={id}
        path={path}
        className={cn(drawing && 'cm-edge-draw')}
        style={{
          stroke: drawing ? `url(#${gradientId})` : 'var(--color-border-strong)',
          strokeWidth: drawing ? 2 : 1.5,
        }}
      />
    </>
  );
}

const nodeTypes = { cm: CmNodeView };
const edgeTypes = { spectral: SpectralEdgeView };

/** Merge live-draft arrivals over whatever version content already exists. */
function mergeDraft(base: DiagramContent | null, construction: ConstructionState): DiagramContent {
  const byId = new Map<string, DiagramNodeSpec>();
  for (const node of base?.nodes ?? []) byId.set(node.id, node);
  for (const node of construction.draft.nodes) byId.set(node.id, node);
  const edgeKey = (e: DiagramEdgeSpec) => e.id ?? `${e.source}->${e.target}`;
  const edgesById = new Map<string, DiagramEdgeSpec>();
  for (const edge of base?.edges ?? []) edgesById.set(edgeKey(edge), edge);
  for (const edge of construction.draft.edges) edgesById.set(edgeKey(edge), edge);
  return { nodes: [...byId.values()], edges: [...edgesById.values()] };
}

// ─── Viewer ──────────────────────────────────────────────────────────────────

function DiagramFlowInner({
  flowNodes,
  flowEdges,
  selectedId,
  onSelect,
}: {
  flowNodes: CmFlowNode[];
  flowEdges: Array<Edge<SpectralEdgeData>>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const fittedRef = useRef(false);

  // Fit once when content first appears and once more when construction
  // settles (layout is final then). Never on every delta (§204).
  const nodeCount = flowNodes.length;
  useEffect(() => {
    if (nodeCount > 0 && !fittedRef.current) {
      fittedRef.current = true;
      void fitView({ padding: 0.18, duration: 220 });
    }
  }, [nodeCount, fitView]);

  return (
    <>
      {/* §105 zoom controls — keyboard-operable buttons with labels */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)]/90 p-1 shadow-sm backdrop-blur-xs">
        <Tooltip content="Zoom in">
          <IconButton aria-label="Zoom in" size="xs" onClick={() => void zoomIn({ duration: 180 })}>
            <Plus className="h-3.5 w-3.5" />
          </IconButton>
        </Tooltip>
        <Tooltip content="Zoom out">
          <IconButton aria-label="Zoom out" size="xs" onClick={() => void zoomOut({ duration: 180 })}>
            <Minus className="h-3.5 w-3.5" />
          </IconButton>
        </Tooltip>
        <Tooltip content="Fit diagram">
          <IconButton aria-label="Fit diagram" size="xs" onClick={() => void fitView({ padding: 0.18, duration: 220 })}>
            <Scan className="h-3.5 w-3.5" />
          </IconButton>
        </Tooltip>
        <Tooltip content="Reset to 100%">
          <IconButton
            aria-label="Reset zoom"
            size="xs"
            onClick={() => void setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 180 })}
          >
            <Crosshair className="h-3.5 w-3.5" />
          </IconButton>
        </Tooltip>
        <span className="px-1 font-mono text-[10px] text-[var(--color-text-tertiary)]" aria-live="off">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        minZoom={0.2}
        maxZoom={2.5}
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        fitView
        deleteKeyCode={null}
      >
        <Background color="var(--color-border)" gap={22} size={1} />
      </ReactFlow>

      {/* Keep selectedId referenced for a11y queries without extra renders */}
      <span hidden data-selected-node={selectedId ?? ''} />
    </>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export default function DiagramViewer({
  artifactId,
  content,
  onAskOdinAboutNode,
}: DiagramViewerProps) {
  const construction = useConstructionStore((s) => (artifactId ? s.byArtifact[artifactId] : undefined));
  const reducedMotion = usePrefersReducedMotion();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const parsed = useMemo(() => parseDiagramContent(content), [content]);
  const livePhase = construction?.phase ?? null;

  /** What is actually on canvas right now (live subset while building). */
  const activeContent = useMemo(() => {
    if (livePhase === 'constructing') {
      // While streaming, the version row may still be EMPTY — the §75 draft
      // arrivals ARE the content until completion merges the full version.
      const base = parsed?.content ?? { nodes: [], edges: [] };
      const merged = mergeDraft(base, construction!);
      const arrived = new Set(construction!.nodeOrder);
      const arrivedEdges = new Set(construction!.edgeOrder);
      return {
        nodes: merged.nodes.filter((n) => arrived.has(n.id)),
        edges: merged.edges.filter(
          (e) => arrivedEdges.has(e.id ?? `${e.source}->${e.target}`),
        ),
      };
    }
    if (!parsed) return null;
    return parsed.content;
  }, [parsed, livePhase, construction]);

  const cells = useMemo(
    () => (activeContent ? layoutDiagram(activeContent) : new Map<string, LayoutCell>()),
    [activeContent],
  );

  const flowNodes: CmFlowNode[] = useMemo(() => {
    if (!activeContent) return [];
    return activeContent.nodes.map((node) => ({
      id: node.id,
      type: 'cm' as const,
      position: {
        x: cells.get(node.id)?.x ?? 0,
        y: cells.get(node.id)?.y ?? 0,
      },
      data: {
        label: node.label,
        ...(node.kind ? { kind: node.kind } : {}),
        arriveIndex:
          !reducedMotion && livePhase === 'constructing'
            ? (construction?.nodeOrder.indexOf(node.id) ?? -1)
            : -1,
        revision: construction?.revisionByNode[node.id] ?? 0,
      },
      selected: selectedNodeId === node.id,
    }));
  }, [activeContent, cells, livePhase, construction, reducedMotion, selectedNodeId]);

  const flowEdges = useMemo(() => {
    if (!activeContent) return [];
    const drawing = !reducedMotion && livePhase === 'constructing';
    return activeContent.edges.map((edge) => ({
      id: edge.id ?? `${edge.source}->${edge.target}`,
      type: 'spectral' as const,
      source: edge.source,
      target: edge.target,
      ...(edge.label ? { label: edge.label, labelShowBg: true } : {}),
      data: { drawing },
      selectable: false,
    }));
  }, [activeContent, livePhase, reducedMotion]);

  const handleSelect = useCallback((id: string | null) => setSelectedNodeId(id), []);

  const selectedNode = activeContent?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Broken/absent content never crashes the surface (FE §291).
  if (!parsed || !activeContent) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        {livePhase === 'constructing' ? (
          <>
            <div className="spectral-pulse h-10 w-10 rounded-full border-2 border-dashed border-[var(--color-border-strong)]" />
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
              {construction?.statusText ?? 'Preparing diagram…'}
            </p>
          </>
        ) : (
          <p className="max-w-xs text-xs text-[var(--color-text-secondary)]">
            This diagram version has no renderable content. View an earlier version, export the raw
            source, or ask Odin to regenerate it.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[var(--color-surface)] select-none">
      <div className="relative min-h-0 flex-1">
        <ReactFlowProvider>
          <DiagramFlowInner
            flowNodes={flowNodes}
            flowEdges={flowEdges}
            selectedId={selectedNodeId}
            onSelect={handleSelect}
          />
        </ReactFlowProvider>
      </div>

      {/* §97/§219 — textual build status; the ONLY motion info channel needed */}
      {livePhase === 'constructing' && (
        <div
          className="flex items-center gap-2 border-t border-[var(--color-border)] px-4 py-1.5 text-[11px] font-medium"
          style={{ color: 'var(--color-text-secondary)' }}
          role="status"
        >
          <span className="odin-working inline-block h-1.5 w-1.5 rounded-full" aria-hidden="true" />
          {construction?.statusText ?? 'Building…'}
        </div>
      )}

      {/* §106/§107 — selection details + Ask Odin with object context */}
      {selectedNode && (
        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 shadow-lg">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase text-[var(--color-text-tertiary)]">
              Selected · {selectedNode.kind ?? 'node'}
            </span>
            <p className="truncate text-xs font-semibold text-[var(--color-text)]">{selectedNode.label}</p>
          </div>
          <button
            onClick={() => onAskOdinAboutNode?.(selectedNode.label)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-3 w-3 text-amber-400" aria-hidden="true" />
            Ask Odin about this
          </button>
        </div>
      )}
    </div>
  );
}
