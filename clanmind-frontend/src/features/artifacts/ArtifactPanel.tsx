import React, { useState } from 'react';
import {
  X,
  Pin,
  Sparkles,
  GitCompare,
  Download,
  FileCode,
  Users,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { IconButton } from '@/design-system/components/IconButton';
import { Tooltip } from '@/design-system/components/Tooltip';
import { Dropdown } from '@/design-system/components/Dropdown';
import { DiagramViewer } from './DiagramViewer';
import { DocumentViewer } from './DocumentViewer';
import { TableArtifactViewer } from './TableArtifactViewer';
import { PdfViewer } from './PdfViewer';
import { UnsupportedArtifactCard } from './UnsupportedArtifactCard';
import { ArtifactCompare } from './ArtifactCompare';
import { cn } from '@/design-system/utils';
import type { Artifact } from '@/types';

export interface ArtifactPanelProps {
  artifact: Artifact;
  activeVersionNumber: number;
  compareVersionNumber: number | null;
  onClose: () => void;
  onSelectVersion: (versionNumber: number) => void;
  onSetCompareVersion: (versionNumber: number | null) => void;
  onTogglePin: (id: string) => void;
  onToggleContext: (id: string) => void;
  onAskOdinAboutNode?: (nodeLabel: string) => void;
}

export function ArtifactPanel({
  artifact,
  activeVersionNumber,
  compareVersionNumber,
  onClose,
  onSelectVersion,
  onSetCompareVersion,
  onTogglePin,
  onToggleContext,
  onAskOdinAboutNode,
}: ArtifactPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentVersion =
    artifact.versions.find((v) => v.version_number === activeVersionNumber) ||
    artifact.versions[0];

  const compareVersion = compareVersionNumber
    ? artifact.versions.find((v) => v.version_number === compareVersionNumber) || null
    : null;

  const versionMenuItems = artifact.versions.map((v) => ({
    id: `v_${v.version_number}`,
    label: (
      <div className="flex items-center justify-between w-full">
        <span>Version {v.version_number}</span>
        <span className="text-[10px] text-gray-400 ml-2">by {v.created_by_name}</span>
      </div>
    ),
    onClick: () => onSelectVersion(v.version_number),
  }));

  const exportMenuItems = [
    {
      id: 'export_md',
      label: 'Export Markdown (.md)',
      onClick: () => alert('Exporting Markdown...'),
    },
    {
      id: 'export_json',
      label: 'Export JSON (.json)',
      onClick: () => alert('Exporting JSON...'),
    },
    {
      id: 'export_png',
      label: 'Export PNG Image (.png)',
      onClick: () => alert('Exporting PNG...'),
    },
  ];

  const renderViewer = () => {
    if (compareVersion) {
      return (
        <ArtifactCompare
          versionA={currentVersion}
          versionB={compareVersion}
          onClose={() => onSetCompareVersion(null)}
        />
      );
    }

    switch (artifact.artifact_type) {
      case 'DIAGRAM':
      case 'FLOWCHART':
      case 'ARCHITECTURE':
      case 'GRAPH':
      case 'CHART':
      case 'TIMELINE':
      case 'MINDMAP':
      case 'DECISION_TREE':
        return (
          <DiagramViewer
            content={currentVersion.content}
            onAskOdinAboutNode={(node) => onAskOdinAboutNode?.(node.label)}
          />
        );
      case 'TABLE':
        return <TableArtifactViewer content={currentVersion.content} />;
      case 'DOCUMENT':
      case 'MARKDOWN':
      case 'CODE':
      case 'HTML':
      case 'RESEARCH':
        if (artifact.title.toLowerCase().endsWith('.pdf')) {
          return <PdfViewer fileName={artifact.title} />;
        }
        return <DocumentViewer content={currentVersion.content} />;
      default:
        return <UnsupportedArtifactCard onExportRaw={() => alert('Exporting raw source...')} />;
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-[var(--color-surface-raised)] border-l border-[var(--color-border)] transition-all',
        isFullscreen && 'fixed inset-0 z-50 border-none'
      )}
    >
      {/* Top Header Bar (Â§96) */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)] bg-gray-50/50 dark:bg-gray-800/30">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-4 h-4 text-gray-500 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-[var(--color-text)] truncate">
              {artifact.title}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span>{artifact.artifact_type}</span>
              <span>â€¢</span>
              {/* Version Selector Dropdown (Â§102) */}
              <Dropdown
                trigger={
                  <button className="font-semibold text-[var(--color-text-secondary)] hover:underline cursor-pointer">
                    v{activeVersionNumber}
                  </button>
                }
                items={versionMenuItems}
              />
              <span>â€¢</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Users className="w-2.5 h-2.5" /> 2 viewing
              </span>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Fullscreen Toggle (Â§104) */}
          <Tooltip content={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            <IconButton
              aria-label="Toggle Fullscreen"
              size="xs"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </IconButton>
          </Tooltip>

          {/* Compare Version Trigger (Â§103) */}
          {artifact.versions.length > 1 && (
            <Tooltip content="Compare with previous version">
              <IconButton
                aria-label="Compare version"
                size="xs"
                onClick={() => {
                  if (compareVersionNumber) {
                    onSetCompareVersion(null);
                  } else {
                    const prevV = artifact.versions.find(
                      (v) => v.version_number !== activeVersionNumber
                    );
                    if (prevV) onSetCompareVersion(prevV.version_number);
                  }
                }}
              >
                <GitCompare
                  className={cn(
                    'w-3.5 h-3.5',
                    compareVersionNumber && 'text-blue-500 font-bold'
                  )}
                />
              </IconButton>
            </Tooltip>
          )}

          {/* Use as Context Toggle (Â§113, Â§114) */}
          <Tooltip content={artifact.used_as_context ? 'Approved Odin Context' : 'Enable for Odin Context'}>
            <IconButton
              aria-label="Toggle Odin Context"
              size="xs"
              onClick={() => onToggleContext(artifact.id)}
            >
              <Sparkles
                className={cn(
                  'w-3.5 h-3.5',
                  artifact.used_as_context
                    ? 'text-amber-500 fill-amber-500'
                    : 'text-gray-400'
                )}
              />
            </IconButton>
          </Tooltip>

          {/* Pin */}
          <Tooltip content={artifact.pinned ? 'Unpin from Garage' : 'Pin to Garage'}>
            <IconButton
              aria-label="Toggle pin"
              size="xs"
              onClick={() => onTogglePin(artifact.id)}
            >
              <Pin
                className={cn(
                  'w-3.5 h-3.5',
                  artifact.pinned ? 'text-amber-500 fill-amber-500' : 'text-gray-400'
                )}
              />
            </IconButton>
          </Tooltip>

          {/* Export Dropdown (Â§254) */}
          <Dropdown
            trigger={
              <IconButton aria-label="Export artifact" size="xs">
                <Download className="w-3.5 h-3.5" />
              </IconButton>
            }
            items={exportMenuItems}
          />

          {/* Close */}
          <IconButton aria-label="Close artifact panel" size="xs" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {renderViewer()}
      </div>
    </div>
  );
}
