/**
 * Artifact work surface (FE §94–§96, §102–§107, §110, §254).
 *
 * Header: name · TYPE · vN · Pin · Version · More. Body renders the per-type
 * viewer — heavy renderers lazy-load (FE §201), each inside its own error
 * boundary so a broken renderer can never take down chat (§291/§325 #9).
 * Version compare/restore/export flows run through the feature controller.
 */

import { Suspense, lazy, memo, useEffect, useRef, useState } from 'react';
import { fetchArtifact } from '@/api/endpoints/artifacts';
import { useArtifactStore } from '@/state/useArtifactStore';
import {
  Download,
  GitCompare,
  History,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pin,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Dropdown } from '@/design-system/components/Dropdown';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { IconButton } from '@/design-system/components/IconButton';
import { Popover } from '@/design-system/components/Popover';
import { Tooltip } from '@/design-system/components/Tooltip';
import { useToast } from '@/design-system/components/Toast';
import { checkForUpdate } from '@/tauri/bridge';
import { cn } from '@/design-system/utils';
import { DocumentViewer } from './DocumentViewer';
import { TableArtifactViewer } from './TableArtifactViewer';
import { UnsupportedArtifactCard } from './UnsupportedArtifactCard';
import { ArtifactCompare } from './ArtifactCompare';
import { useArtifactController } from './useArtifactController';
import { supportedExports } from './exporters';
import { relativeTime } from './relativeTime';
import type { ExportFormatId } from './exporters';
import type { ConstructionState } from './constructionStore';
import type { Artifact, ArtifactType, ArtifactVersion } from '@/types';

// §201 — heavy viewers load as their own chunks on first artifact open.
const DiagramViewer = lazy(() => import('./DiagramViewer'));
const ChartViewer = lazy(() => import('./ChartViewer'));

export interface ArtifactPanelProps {
  artifact: Artifact;
  activeVersionNumber: number;
  compareVersionNumber: number | null;
  /** Live construction trace for THIS artifact (null when none running). */
  construction: ConstructionState | null;
  onClose: () => void;
  onSelectVersion: (versionNumber: number) => void;
  onSetCompareVersion: (versionNumber: number | null) => void;
  onAskOdinAboutNode?: (nodeLabel: string) => void;
  /** §110 — send the artifact into the composer as chat context. */
  onSendToChat?: (artifact: Artifact) => void;
}

const DOC_TYPES = new Set<ArtifactType>(['DOCUMENT', 'MARKDOWN', 'RESEARCH', 'CODE', 'HTML', 'OTHER']);

function ViewerSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center p-8" role="status" aria-label="Loading artifact viewer">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]" />
        <span className="text-[11px] text-[var(--color-text-tertiary)]">Loading viewer…</span>
      </div>
    </div>
  );
}

/** §291 isolation fallback — a renderer crash never propagates further. */
function RendererIsolationFallback({ onExportRaw }: { onExportRaw?: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="max-w-xs text-xs font-semibold text-[var(--color-text)]">
        This artifact cannot be rendered in this version.
      </p>
      <p className="max-w-xs text-[11px] text-[var(--color-text-secondary)]">
        View raw or export it — everything else in ClanMind keeps working.
      </p>
      {onExportRaw && (
        <Button size="sm" variant="outline" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={onExportRaw}>
          Export JSON
        </Button>
      )}
    </div>
  );
}

function ArtifactPanelBody({
  artifact,
  activeVersionNumber,
  compareVersionNumber,
  construction,
  onClose,
  onSelectVersion,
  onSetCompareVersion,
  onAskOdinAboutNode,
  onSendToChat,
}: ArtifactPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVersionMenuOpen, setVersionMenuOpen] = useState(false);
  const [viewRaw, setViewRaw] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const { toast } = useToast();
  const { togglePin, toggleContext, restoreVersion, exportAs } = useArtifactController();

  // §109 — fetch full artifact with versions when panel opens
  const [fetchedVersions, setFetchedVersions] = useState<ArtifactVersion[]>([]);
  useEffect(() => {
    if (!artifact.id) return;
    fetchArtifact(artifact.id).then((full) => {
      if (full && full.versions.length > 0) {
        setFetchedVersions(full.versions);
        useArtifactStore.getState().mergeArtifactVersion(full);
      }
    }).catch(() => {});
  }, [artifact.id]);

  // Use fetched versions if available, otherwise fall back to artifact versions
  const effectiveVersions = fetchedVersions.length > 0 ? fetchedVersions : artifact.versions;

  const currentVersion: ArtifactVersion =
    (activeVersionNumber && activeVersionNumber > 0
      ? effectiveVersions.find((v) => v.version_number === activeVersionNumber)
      : null) ??
    effectiveVersions[effectiveVersions.length - 1] ??
    effectiveVersions[0] ?? {
      version_number: artifact.current_version,
      content: '',
      created_by_name: 'Unknown',
      created_at: artifact.updated_at,
    };

  // §104 — Esc exits fullscreen; it never closes the panel itself.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  // §100 — ONE subtle completion glow per live build; never re-fires.
  const prevPhaseRef = useRef<ConstructionState['phase'] | null>(construction?.phase ?? null);
  useEffect(() => {
    const phase = construction?.phase ?? null;
    if (prevPhaseRef.current === 'constructing' && phase === 'ready') {
      setGlowing(true);
      const t = setTimeout(() => setGlowing(false), 900);
      prevPhaseRef.current = phase;
      return () => clearTimeout(t);
    }
    prevPhaseRef.current = phase;
  }, [construction?.phase]);

  const isConstructing = construction?.phase === 'constructing';
  const compareVersion = compareVersionNumber
    ? effectiveVersions.find((v) => v.version_number === compareVersionNumber) ?? null
    : null;

  // §254 — exports derive from the PROP artifact (the panel's own truth),
  // so the menu is correct even before a store round-trip lands.
  const exportOptions = supportedExports(artifact, currentVersion);

  const handleExport = (formatId: ExportFormatId) => {
    if (!currentVersion.content) {
      toast({ title: 'Nothing to export yet', description: 'This version has no content.' });
      return;
    }
    exportAs(artifact.id, currentVersion.version_number, formatId);
  };

  const moreMenuItems = [
    // §100 — the toolbar "activates" on Ready: exports stay disabled while
    // the artifact is still streaming (partial content is not exportable).
    ...exportOptions.map((o) => ({
      id: `export_${o.id}`,
      label: `Export ${o.label}`,
      icon: <Download className="h-3.5 w-3.5" />,
      disabled: isConstructing,
      onClick: () => handleExport(o.id),
    })),
    ...(exportOptions.length > 0 ? [{ divider: true as const, id: 'divider_export' }] : []),
    {
      id: 'ctx_toggle',
      label: artifact.used_as_context ? '✓ Used by Odin' : 'Use as Project Context',
      icon: <Sparkles className={cn('h-3.5 w-3.5', artifact.used_as_context && 'text-amber-500')} />,
      onClick: () => toggleContext(artifact.id),
    },
    ...(onSendToChat
      ? [{
          id: 'send_chat',
          label: 'Send to Chat',
          icon: <Send className="h-3.5 w-3.5" />,
          onClick: () => onSendToChat(artifact),
        }]
      : []),
    { divider: true as const, id: 'divider_actions' },
    {
      id: 'check_update',
      label: 'Check for updates',
      icon: <History className="h-3.5 w-3.5" />,
      onClick: () =>
        void checkForUpdate().then((r) => {
          toast({
            title: r.available ? `Update ${r.version} available` : "You're up to date",
            variant: r.available ? 'info' : 'success',
          });
        }),
    },
  ];

  const rawView = viewRaw ? (
    <div className="flex-1 overflow-auto p-4 select-text">
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setViewRaw(false)} aria-label="Exit raw content view">
          Exit raw view
        </Button>
      </div>
      <pre className="whitespace-pre-wrap rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-mono text-[11px] leading-relaxed text-[var(--color-text)]" role="textbox" aria-readonly="true" aria-label="Raw artifact content">
        {currentVersion.content || '(no content stored for this version)'}
      </pre>
    </div>
  ) : null;

  const renderViewer = () => {
    // §103 compare mode wins over the plain viewer.
    if (compareVersion) {
      return (
        <ArtifactCompare
          artifactType={artifact.artifact_type}
          versionA={currentVersion}
          versionB={compareVersion}
          onClose={() => onSetCompareVersion(null)}
        />
      );
    }
    if (viewRaw) return rawView;

    // Metadata-only row (D15) or still-empty live version — honest emptiness.
    if (!currentVersion.content && !isConstructing) {
      return (
        <UnsupportedArtifactCard
          onViewRaw={() => setViewRaw(true)}
          onExportRaw={() => handleExport('json')}
          onUpdate={() => void checkForUpdate()}
        />
      );
    }

    switch (artifact.artifact_type) {
      case 'DIAGRAM':
      case 'FLOWCHART':
      case 'ARCHITECTURE':
      case 'GRAPH':
      case 'TIMELINE':
      case 'MINDMAP':
      case 'DECISION_TREE':
        return (
          <ErrorBoundary label="Diagram renderer" fallback={<RendererIsolationFallback onExportRaw={() => handleExport('json')} />}>
            <Suspense fallback={<ViewerSkeleton />}>
              <DiagramViewer
                artifactId={artifact.id}
                content={currentVersion.content}
                onAskOdinAboutNode={onAskOdinAboutNode}
              />
            </Suspense>
          </ErrorBoundary>
        );
      case 'CHART':
        return (
          <ErrorBoundary label="Chart renderer" fallback={<RendererIsolationFallback onExportRaw={() => handleExport('json')} />}>
            <Suspense fallback={<ViewerSkeleton />}>
              <ChartViewer content={currentVersion.content} />
            </Suspense>
          </ErrorBoundary>
        );
      case 'TABLE':
        return (
          <ErrorBoundary label="Table renderer" fallback={<RendererIsolationFallback onExportRaw={() => handleExport('json')} />}>
            <TableArtifactViewer content={currentVersion.content} />
          </ErrorBoundary>
        );
      default:
        break;
    }
    if (DOC_TYPES.has(artifact.artifact_type)) {
      return (
        <ErrorBoundary label="Document renderer" fallback={<RendererIsolationFallback onExportRaw={() => handleExport('json')} />}>
          <DocumentViewer content={currentVersion.content} />
        </ErrorBoundary>
      );
    }
    // §200 — unknown/newer types degrade gracefully, never crash.
    return (
      <UnsupportedArtifactCard
        onViewRaw={() => setViewRaw(true)}
        onExportRaw={() => handleExport('json')}
        onUpdate={() => void checkForUpdate()}
      />
    );
  };

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface-raised)] transition-all duration-200',
        isFullscreen && 'fixed inset-0 z-50 border-none',
      )}
    >
      {/* ─── Header (§96) ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-semibold text-[var(--color-text)] leading-tight">{artifact.title}</h2>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] leading-tight text-[var(--color-text-tertiary)]">
              <span className="font-medium uppercase tracking-wider">{artifact.artifact_type}</span>
              <span aria-hidden="true">·</span>
              {/* §102 — version selector popover with per-version actions */}
              <Popover
                open={isVersionMenuOpen}
                onOpenChange={setVersionMenuOpen}
                align="start"
                trigger={
                  <button
                    className="cursor-pointer font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                    aria-label={`Version ${activeVersionNumber} — open version history`}
                  >
                    v{activeVersionNumber}
                  </button>
                }
              >
                <div className="max-h-72 w-72 overflow-y-auto" role="listbox" aria-label="Artifact versions">
                  {[...effectiveVersions].sort((a, b) => b.version_number - a.version_number).map((v) => {
                    const isActive = v.version_number === activeVersionNumber;
                    return (
                      <div
                        key={v.version_number}
                        className={cn(
                          'mb-1 rounded-lg border p-2.5 text-left transition-colors',
                          isActive ? 'border-[var(--color-border-strong)] bg-[var(--color-surface-hover)]' : 'border-transparent hover:bg-[var(--color-surface-hover)]',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            className="min-w-0 cursor-pointer text-left"
                            onClick={() => {
                              onSelectVersion(v.version_number);
                              setVersionMenuOpen(false);
                            }}
                            aria-label={`View version ${v.version_number}`}
                          >
                            <span className="text-xs font-bold text-[var(--color-text)]">v{v.version_number}</span>
                            <span className="ml-2 text-[10px] text-[var(--color-text-secondary)]">
                              {v.created_by_name} · {relativeTime(v.created_at)}
                            </span>
                            {v.ai_run_id && (
                              <span className="ml-1 text-[10px] text-[var(--color-text-tertiary)]">· AI run</span>
                            )}
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            {v.version_number !== currentVersion.version_number && (
                              <Tooltip content={`Compare with v${v.version_number}`}>
                                <IconButton aria-label={`Compare current with version ${v.version_number}`} size="xs"
                                  onClick={() => { onSetCompareVersion(v.version_number); setVersionMenuOpen(false); }}>
                                  <GitCompare className="h-3 w-3" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {v.version_number !== artifact.current_version && !isConstructing && (
                              <Tooltip content={`Restore v${v.version_number} as current`}>
                                <IconButton aria-label={`Restore version ${v.version_number}`} size="xs"
                                  onClick={() => { void restoreVersion(artifact.id, v.version_number); setVersionMenuOpen(false); }}>
                                  <History className="h-3 w-3" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                        {v.change_summary && (
                          <p className="mt-1 line-clamp-2 text-[10px] text-[var(--color-text-tertiary)]">{v.change_summary}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Popover>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip content={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}>
            <IconButton aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} size="xs"
              onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </IconButton>
          </Tooltip>

          <Tooltip content={artifact.pinned ? 'Unpin from Garage' : 'Pin to Garage'}>
            <IconButton aria-label={artifact.pinned ? 'Unpin artifact' : 'Pin artifact'} size="xs"
              onClick={() => togglePin(artifact.id)}>
              <Pin className={cn('h-3.5 w-3.5', artifact.pinned && 'fill-current text-amber-500')} />
            </IconButton>
          </Tooltip>

          {/* §254 export + §110 context actions */}
          <Dropdown trigger={<IconButton aria-label="More artifact actions" size="xs"><MoreHorizontal className="h-3.5 w-3.5" /></IconButton>} items={moreMenuItems} />

          <IconButton aria-label="Close artifact panel" size="xs" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {/* ─── Body (§291 isolated viewers; §100 completion glow once; §41 spectral border during construction) ──────── */}
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden',
          glowing && 'completion-glow',
          isConstructing && 'spectral-border',
        )}
        role={isConstructing ? 'status' : undefined}
        aria-label={isConstructing ? `Artifact under construction: ${construction?.statusText ?? 'Building…'}` : undefined}
      >
        {renderViewer()}
      </div>
    </div>
  );
}

/**
 * P14 — memoized at the export boundary (FE §203/§288). AppShell re-renders on
 * every composer keystroke and presence tick; the artifact surface must stay
 * inert unless one of its actual inputs changes. All callback props are
 * referentially stable in AppShell (store actions or useCallback), so shallow
 * comparison is sufficient — no custom comparator that could go stale.
 */
export const ArtifactPanel = memo(ArtifactPanelBody);

