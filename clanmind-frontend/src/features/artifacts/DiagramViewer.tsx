import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Sparkles } from 'lucide-react';
import { IconButton } from '@/design-system/components/IconButton';
import { Tooltip } from '@/design-system/components/Tooltip';
import { cn } from '@/design-system/utils';

export interface DiagramNode {
  id: string;
  label: string;
  type?: 'sensor' | 'hardware' | 'buffer' | 'processing' | 'actuator' | 'default';
  status?: 'creating' | 'ready';
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  active?: boolean;
}

export interface DiagramViewerProps {
  content: string; // JSON string with nodes and edges
  isStreaming?: boolean;
  onSelectNode?: (node: DiagramNode) => void;
  onAskOdinAboutNode?: (node: DiagramNode) => void;
}

export function DiagramViewer({
  content,
  isStreaming = false,
  onSelectNode,
  onAskOdinAboutNode,
}: DiagramViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  let parsed: { nodes: DiagramNode[]; edges: DiagramEdge[] } = { nodes: [], edges: [] };
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {
      nodes: [
        { id: 'n1', label: 'Primary System Node', type: 'processing' },
        { id: 'n2', label: 'Telemetry Link', type: 'hardware' },
      ],
      edges: [{ from: 'n1', to: 'n2', label: 'Data Bus' }],
    };
  }

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2.0));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));
  const handleResetZoom = () => setZoom(1);

  const selectedNode = parsed.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="relative flex flex-col h-full bg-gray-50/50 dark:bg-gray-950 overflow-hidden select-none">
      {/* Zoom / Controls Toolbar (§105) */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xs p-1 rounded-lg border border-[var(--color-border)] shadow-sm">
        <Tooltip content="Zoom In (+)">
          <IconButton aria-label="Zoom in" size="xs" onClick={handleZoomIn}>
            <ZoomIn className="w-3.5 h-3.5" />
          </IconButton>
        </Tooltip>
        <Tooltip content="Zoom Out (-)">
          <IconButton aria-label="Zoom out" size="xs" onClick={handleZoomOut}>
            <ZoomOut className="w-3.5 h-3.5" />
          </IconButton>
        </Tooltip>
        <Tooltip content="Reset Fit">
          <IconButton aria-label="Reset zoom" size="xs" onClick={handleResetZoom}>
            <RotateCcw className="w-3.5 h-3.5" />
          </IconButton>
        </Tooltip>
        <span className="text-[10px] font-mono text-gray-400 px-1">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* SVG Canvas Area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-8">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          className="transition-transform duration-200 flex flex-col items-center gap-6 min-w-[320px]"
        >
          {parsed.nodes.map((node, index) => {
            const isSelected = selectedNodeId === node.id;
            const isLast = index === parsed.nodes.length - 1;
            const edge = parsed.edges.find((e) => e.from === node.id);

            return (
              <React.Fragment key={node.id}>
                {/* Node Box */}
                <div
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    onSelectNode?.(node);
                  }}
                  className={cn(
                    'relative px-5 py-3 rounded-xl border transition-all cursor-pointer shadow-xs min-w-[240px] text-center',
                    isSelected
                      ? 'border-gray-900 ring-2 ring-gray-900 dark:border-white dark:ring-white bg-[var(--color-surface-raised)] scale-105'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-raised)] hover:border-gray-400 dark:hover:border-gray-600',
                    node.status === 'creating' && 'animate-pulse spectral-pulse'
                  )}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-0.5">
                    {node.type || 'Component'}
                  </span>
                  <p className="text-xs font-semibold text-[var(--color-text)]">
                    {node.label}
                  </p>
                </div>

                {/* Connecting Edge (§98, §99 animated spectral edge on insertion) */}
                {!isLast && (
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'w-0.5 h-8',
                        isStreaming || edge?.active
                          ? 'spectral-active'
                          : 'bg-gray-300 dark:bg-gray-700'
                      )}
                    />
                    {edge?.label && (
                      <span className="text-[9px] font-mono font-medium text-[var(--color-text-tertiary)] px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] -my-2.5 z-10">
                        {edge.label}
                      </span>
                    )}
                    <div
                      className={cn(
                        'w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px]',
                        isStreaming || edge?.active
                          ? 'border-t-amber-500'
                          : 'border-t-gray-300 dark:border-t-gray-700'
                      )}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Selected Node Details & "Ask Odin About This" Follow-up Bar (§106, §107) */}
      {selectedNode && (
        <div className="p-3 bg-[var(--color-surface-raised)] border-t border-[var(--color-border)] flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[10px] font-bold uppercase text-gray-400">
              Selected: {selectedNode.type}
            </span>
            <p className="text-xs font-semibold text-[var(--color-text)]">
              {selectedNode.label}
            </p>
          </div>
          <button
            onClick={() => onAskOdinAboutNode?.(selectedNode)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Ask Odin about this</span>
          </button>
        </div>
      )}
    </div>
  );
}
