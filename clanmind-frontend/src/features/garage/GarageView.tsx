/**
 * Project Garage (FE §87–§90, §257) — a project library, not an uploads dump.
 *
 * Sections: All · Artifacts · Files · Research · Pinned · Recent.
 * Grid (§90) and list (§89) views; the preference persists locally.
 * Cards show preview/title/type/creator/updated/version/pin (§88) with
 * pinned-first ordering (§257).
 */

import { useMemo, useState } from 'react';
import {
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pin,
  Search,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import { Dropdown } from '@/design-system/components/Dropdown';
import { IconButton } from '@/design-system/components/IconButton';
import { Tooltip } from '@/design-system/components/Tooltip';
import { cn } from '@/design-system/utils';
import { useToast } from '@/design-system/components/Toast';
import { useUiStore } from '@/state/useUiStore';
import { LocalFileTreeView, type LocalFileItem } from './LocalFileTreeView';
import { SEED_LOCAL_FILES } from './localFiles';
import { pickLocalFolder } from '@/tauri/bridge';
import { useArtifactController } from '@/features/artifacts/useArtifactController';
import { relativeTime } from '@/features/artifacts/relativeTime';
import { parseDiagramContent, diagramToSvg } from '@/features/artifacts/diagramUtils';
import type { Artifact } from '@/types';

export interface GarageViewProps {
  artifacts: Artifact[];
  onOpenArtifact: (artifact: Artifact) => void;
}

type GarageSection = 'all' | 'artifacts' | 'files' | 'research' | 'pinned' | 'recent';

const SECTIONS: Array<{ id: GarageSection; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'files', label: 'Files' },
  { id: 'research', label: 'Research' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'recent', label: 'Recent' },
];

const DIAGRAM_FAMILY = new Set([
  'DIAGRAM', 'FLOWCHART', 'ARCHITECTURE', 'GRAPH', 'TIMELINE', 'MINDMAP', 'DECISION_TREE',
]);

function creatorOf(a: Artifact): string {
  return [...a.versions].sort((x, y) => y.version_number - x.version_number)[0]?.created_by_name ?? 'Unknown';
}

/** Pinned first (§257), then most recently updated. */
function garageOrder(a: Artifact[]): Artifact[] {
  return [...a].sort((x, y) => {
    if (x.pinned !== y.pinned) return x.pinned ? -1 : 1;
    return y.updated_at.localeCompare(x.updated_at);
  });
}

/** Real preview where possible: diagrams render their deterministic SVG. */
function previewFor(artifact: Artifact): { kind: 'image'; url: string } | { kind: 'text'; excerpt: string } {
  if (DIAGRAM_FAMILY.has(artifact.artifact_type)) {
    const version =
      artifact.versions.find((v) => v.version_number === artifact.current_version) ?? artifact.versions[0];
    const parsed = parseDiagramContent(version?.content);
    if (parsed) {
      return { kind: 'image', url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(diagramToSvg(parsed.content))}` };
    }
  }
  // Text preview: the first meaningful body line of the current version.
  const version =
    artifact.versions.find((v) => v.version_number === artifact.current_version) ?? artifact.versions[0];
  const firstLine = (version?.content ?? '')
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').replace(/[*_`>-]/g, '').trim())
    .find((line) => line.length > 0);
  const excerpt = (firstLine || artifact.title).slice(0, 96);
  return { kind: 'text', excerpt };
}

export function GarageView({ artifacts, onOpenArtifact }: GarageViewProps) {
  const { toast } = useToast();
  const [section, setSection] = useState<GarageSection>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [localFiles, setLocalFiles] = useState<LocalFileItem[]>(SEED_LOCAL_FILES);
  const { togglePin, toggleContext, exportAs } = useArtifactController();

  // Grid/list persisted via the UI-prefs store (FE §90).
  const viewMode = useGarageViewMode();

  const handleAddFolder = async () => {
    const folder = await pickLocalFolder();
    if (folder === null) return; // cancelled — not an error
    toast({
      title: 'Folder connected',
      description: 'ClanMind will only access the folder you chose.',
    });
    setLocalFiles((prev) => [
      { id: `lf_${Date.now()}`, name: 'local_project/', isFolder: true, size: 0, syncState: 'SYNCED', indexState: 'READY' },
      ...prev,
    ]);
  };

  const visibleArtifacts = useMemo(() => {
    let list = artifacts.filter((a) => !a.deleted);
    switch (section) {
      case 'artifacts':
        list = list.filter((a) => a.artifact_type !== 'RESEARCH');
        break;
      case 'research':
        list = list.filter((a) => a.artifact_type === 'RESEARCH');
        break;
      case 'pinned':
        list = list.filter((a) => a.pinned);
        break;
      case 'recent':
        list = [...list]
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .slice(0, 12);
        break;
      default:
        break;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) =>
        a.title.toLowerCase().includes(q) || a.artifact_type.toLowerCase().includes(q),
      );
    }
    // §257 — pinned first everywhere except the Recent section.
    return section === 'recent' ? list : garageOrder(list);
  }, [artifacts, section, searchQuery]);

  const moreItemsFor = (artifact: Artifact) => [
    { id: 'open', label: 'Open', onClick: () => onOpenArtifact(artifact) },
    {
      id: 'pin',
      label: artifact.pinned ? 'Unpin' : 'Pin to Garage',
      onClick: () => togglePin(artifact.id),
    },
    {
      id: 'ctx',
      label: artifact.used_as_context ? '✓ Used by Odin' : 'Use as Project Context',
      onClick: () => toggleContext(artifact.id),
    },
    {
      id: 'export_json',
      label: 'Export JSON',
      onClick: () => exportAs(artifact.id, artifact.current_version, 'json'),
    },
  ];

  const renderEmpty = (message: string, hint: string) => (
    <div className="py-12 text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
      <Folder className="mx-auto mb-2 h-8 w-8 opacity-40" aria-hidden="true" />
      <p className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
      <p className="mt-1">{hint}</p>
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <div
        className="flex flex-col items-start justify-between gap-3 border-b px-6 py-4 sm:flex-row sm:items-center"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div>
          <h1 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>
            Project Garage
          </h1>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
            Artifacts, research findings, and technical references.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* §90 view mode — remembered locally */}
          <div
            className="flex items-center rounded-md border p-0.5"
            style={{ background: 'var(--color-surface-hover)', borderColor: 'var(--color-border)' }}
            role="group"
            aria-label="View mode"
          >
            <button
              onClick={() => setGarageGrid()}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              className={cn(
                'cursor-pointer rounded p-1.5 transition-colors',
                viewMode === 'grid' && 'bg-[var(--color-surface-raised)]',
              )}
              style={{ color: viewMode === 'grid' ? 'var(--color-text)' : 'var(--color-text-tertiary)' }}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              onClick={() => setGarageList()}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              className={cn(
                'cursor-pointer rounded p-1.5 transition-colors',
                viewMode === 'list' && 'bg-[var(--color-surface-raised)]',
              )}
              style={{ color: viewMode === 'list' ? 'var(--color-text)' : 'var(--color-text-tertiary)' }}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <Button
            size="sm"
            variant="primary"
            leftIcon={<FolderOpen className="h-3.5 w-3.5" />}
            onClick={() => void handleAddFolder()}
          >
            Connect folder
          </Button>
        </div>
      </div>

      {/* Sections & search */}
      <div
        className="flex items-center justify-between gap-3 overflow-x-auto border-b px-6 py-2.5"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="flex items-center gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              aria-pressed={section === s.id}
              className={cn(
                'shrink-0 cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors',
                section === s.id
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="relative w-48 shrink-0">
          <Search
            className="absolute left-2.5 top-2 h-3.5 w-3.5"
            style={{ color: 'var(--color-text-tertiary)' }}
            aria-hidden="true"
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter…"
            aria-label="Filter garage items"
            className="w-full rounded-md border py-1.5 pl-7 pr-2.5 text-[11px] outline-none"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text)',
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {section === 'files' ? (
          <LocalFileTreeView
            files={localFiles}
            onSelectFile={(f) => {
              toast({
                title: f.name,
                description: f.isFolder
                  ? 'Folder contents are indexed locally.'
                  : 'File preview arrives with the filesystem bridge.',
              });
            }}
          />
        ) : visibleArtifacts.length === 0 ? (
          section === 'research' ? (
            renderEmpty('No research saved yet.', 'Deep-research runs save their findings here automatically.')
          ) : section === 'pinned' ? (
            renderEmpty('Nothing pinned yet.', 'Pin artifacts from the work surface or a card to keep them at hand.')
          ) : (
            renderEmpty(
              'No artifacts yet.',
              'Ask Odin in chat to draft a spec or blueprint — it will appear here.',
            )
          )
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visibleArtifacts.map((artifact) => {
              const preview = previewFor(artifact);
              return (
                <div
                  key={artifact.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenArtifact(artifact)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenArtifact(artifact);
                    }
                  }}
                  className="group relative flex cursor-pointer flex-col rounded-lg border p-3 transition-all hover:border-[var(--color-border-strong)]"
                  style={{
                    borderColor: 'var(--color-border)',
                    background: 'var(--color-surface-raised)',
                  }}
                >
                  {/* §88 preview — real SVG for diagrams, body excerpt for text */}
                  {preview.kind === 'image' ? (
                    <img
                      src={preview.url}
                      alt=""
                      aria-hidden="true"
                      className="mb-2 h-20 w-full rounded-md border object-contain object-left-top p-0.5"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                    />
                  ) : (
                    <p
                      className="mb-2 line-clamp-2 rounded-md border p-2 text-[10px] italic"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)', background: 'var(--color-surface)' }}
                    >
                      {preview.excerpt}
                    </p>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="rounded p-1"
                        style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}
                        aria-hidden="true"
                      >
                        {DIAGRAM_FAMILY.has(artifact.artifact_type) || artifact.artifact_type === 'CODE' ? (
                          <FileCode className="h-3.5 w-3.5" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <Badge variant="neutral" size="sm">
                        {artifact.artifact_type}
                      </Badge>
                    </div>

                    {/* §88 hover actions — pin is ALSO keyboard reachable */}
                    <div className="flex items-center gap-0.5 opacity-100 transition-opacity group-hover:opacity-100 sm:opacity-60 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
                      <Tooltip content={artifact.pinned ? 'Unpin' : 'Pin'}>
                        <IconButton
                          aria-label={artifact.pinned ? 'Unpin artifact' : 'Pin artifact'}
                          aria-pressed={artifact.pinned}
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(artifact.id);
                          }}
                        >
                          <Pin
                            className={cn('h-3.5 w-3.5', artifact.pinned && 'fill-current')}
                            style={{ color: artifact.pinned ? 'var(--color-warning)' : undefined }}
                            aria-hidden="true"
                          />
                        </IconButton>
                      </Tooltip>
                      <span onClick={(e) => e.stopPropagation()} role="presentation">
                        <Dropdown
                          align="end"
                          trigger={
                            <IconButton aria-label={`More actions for ${artifact.title}`} size="xs">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </IconButton>
                          }
                          items={moreItemsFor(artifact)}
                        />
                      </span>
                    </div>
                  </div>

                  <h3 className="mt-1.5 line-clamp-2 text-xs font-bold" style={{ color: 'var(--color-text)' }}>
                    {artifact.title}
                  </h3>

                  {/* §88 metadata row */}
                  <div
                    className="mt-2 flex items-center justify-between border-t pt-2 text-[10px]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}
                  >
                    <span className="truncate">
                      v{artifact.current_version} · {creatorOf(artifact)} · {relativeTime(artifact.updated_at)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {artifact.used_as_context && (
                        <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--color-warning)' }}>
                          <Sparkles className="h-2.5 w-2.5" aria-hidden="true" /> Odin
                        </span>
                      )}
                      {artifact.pinned && (
                        <Pin className="h-3 w-3 fill-current" style={{ color: 'var(--color-warning)' }} aria-label="Pinned" />
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* §89 list columns */
          <div
            className="overflow-hidden rounded-lg border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
          >
            <div
              className="grid grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_32px] gap-2 border-b px-3 py-2 text-[10px] font-bold uppercase tracking-wide"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)', background: 'var(--color-surface)' }}
            >
              <span>Name</span>
              <span>Type</span>
              <span>Updated</span>
              <span>Creator</span>
              <span>Version</span>
              <span />
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {visibleArtifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenArtifact(artifact)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenArtifact(artifact);
                    }
                  }}
                  className="grid cursor-pointer grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_32px] items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-[var(--color-surface-hover)]"
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
                    <span className="truncate font-semibold">{artifact.title}</span>
                    {artifact.pinned && (
                      <Pin className="h-3 w-3 shrink-0 fill-current" style={{ color: 'var(--color-warning)' }} aria-label="Pinned" />
                    )}
                  </span>
                  <span className="truncate" style={{ color: 'var(--color-text-secondary)' }}>{artifact.artifact_type}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{relativeTime(artifact.updated_at)}</span>
                  <span className="truncate" style={{ color: 'var(--color-text-secondary)' }}>{creatorOf(artifact)}</span>
                  <span>v{artifact.current_version}</span>
                  <span
                    onClick={(e) => e.stopPropagation()}
                    role="presentation"
                    className="flex justify-end"
                  >
                    <Dropdown
                      align="end"
                      trigger={<IconButton aria-label={`More actions for ${artifact.title}`} size="xs"><MoreHorizontal className="h-3.5 w-3.5" /></IconButton>}
                      items={moreItemsFor(artifact)}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Thin selector so the component only re-renders on its own pref. */
function useGarageViewMode() {
  return useUiStore((s) => s.garageViewMode);
}

function setGarageGrid() {
  useUiStore.getState().setGarageViewMode('grid');
}

function setGarageList() {
  useUiStore.getState().setGarageViewMode('list');
}
