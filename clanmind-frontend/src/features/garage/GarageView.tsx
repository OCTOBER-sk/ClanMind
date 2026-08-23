import React, { useEffect, useState } from 'react';
import {
  Folder,
  FileText,
  FileCode,
  LayoutGrid,
  List,
  Pin,
  Sparkles,
  Search,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import { cn } from '@/design-system/utils';
import { useToast } from '@/design-system/components/Toast';
import { LocalFileTreeView, type LocalFileItem } from './LocalFileTreeView';
import { SEED_LOCAL_FILES } from './localFiles';
import { pickLocalFolder } from '@/tauri/bridge';
import type { Artifact } from '@/types';

export interface GarageViewProps {
  artifacts: Artifact[];
  onOpenArtifact: (artifact: Artifact) => void;
  onTogglePin: (id: string) => void;
}

type GarageTab = 'all' | 'artifacts' | 'files' | 'pinned';

export function GarageView({ artifacts, onOpenArtifact, onTogglePin }: GarageViewProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<GarageTab>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('cm_garage_view') as 'grid' | 'list') || 'grid'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [localFiles, setLocalFiles] = useState<LocalFileItem[]>(SEED_LOCAL_FILES);

  // §90: remember preferred view locally
  useEffect(() => {
    localStorage.setItem('cm_garage_view', viewMode);
  }, [viewMode]);

  // §187/§237: connect a local folder via the Tauri dialog
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

  const filteredArtifacts = artifacts.filter((a) => {
    if (activeTab === 'pinned' && !a.pinned) return false;
    if (activeTab === 'artifacts' && a.artifact_type === 'OTHER') return false;
    if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const cardActionClass =
    'p-1 rounded cursor-pointer hover:opacity-80 focus-visible:shadow-[var(--focus-ring)]';

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--color-background)' }}>
      {/* Top Header & Filter Bar */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-6 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            Project Garage
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            Living library of project artifacts, system models, research findings, and technical references.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div
            className="flex items-center p-1 rounded-lg border"
            style={{ background: 'var(--color-surface-hover)', borderColor: 'var(--color-border)' }}
          >
            <button
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              className={cn(
                'p-1.5 rounded-md cursor-pointer transition-colors',
                viewMode === 'grid' && 'bg-[var(--color-surface-raised)] shadow-[var(--shadow-sm)]'
              )}
              style={{ color: viewMode === 'grid' ? 'var(--color-text)' : 'var(--color-text-tertiary)' }}
            >
              <LayoutGrid className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              className={cn(
                'p-1.5 rounded-md cursor-pointer transition-colors',
                viewMode === 'list' && 'bg-[var(--color-surface-raised)] shadow-[var(--shadow-sm)]'
              )}
              style={{ color: viewMode === 'list' ? 'var(--color-text)' : 'var(--color-text-tertiary)' }}
            >
              <List className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <Button
            size="sm"
            variant="primary"
            leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
            onClick={handleAddFolder}
          >
            Connect local folder
          </Button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="flex items-center gap-3">
          {(['all', 'artifacts', 'files', 'pinned'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer',
                activeTab === tab
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-fg)]'
                  : 'hover:bg-[var(--color-surface-hover)]'
              )}
              style={activeTab === tab ? undefined : { color: 'var(--color-text-secondary)' }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search
            className="w-3.5 h-3.5 absolute left-3 top-2.5"
            style={{ color: 'var(--color-text-tertiary)' }}
            aria-hidden="true"
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter garage items…"
            aria-label="Filter garage items"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none"
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
        {/* §87 Files section — local file tree with sync states (§189/§212) */}
        {activeTab === 'files' ? (
          <LocalFileTreeView
            files={localFiles}
            onSelectFile={(f) => {
              toast({
                title: f.name,
                description: f.isFolder ? 'Folder contents are indexed locally.' : 'File preview coming with the filesystem bridge.',
              });
            }}
          />
        ) : filteredArtifacts.length === 0 ? (
          <div className="text-center py-16 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            <Folder className="w-10 h-10 mx-auto mb-2 opacity-40" aria-hidden="true" />
            {/* §179 empty state: what / why / next */}
            <p className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              No {activeTab === 'pinned' ? 'pinned ' : ''}artifacts yet.
            </p>
            <p className="mt-1">Ask Odin in chat to create an architecture blueprint or system specification.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredArtifacts.map((artifact) => (
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
                className="group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between"
                style={{
                  borderColor: 'var(--color-border)',
                  background: 'var(--color-surface-raised)',
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="p-1.5 rounded-md" style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}>
                        {artifact.artifact_type === 'DIAGRAM' || artifact.artifact_type === 'ARCHITECTURE' ? (
                          <FileCode className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <FileText className="w-4 h-4" aria-hidden="true" />
                        )}
                      </span>
                      <Badge variant="neutral" size="sm">
                        {artifact.artifact_type}
                      </Badge>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(artifact.id);
                      }}
                      aria-label={artifact.pinned ? 'Unpin artifact' : 'Pin artifact'}
                      aria-pressed={artifact.pinned}
                      className={cardActionClass}
                    >
                      <Pin
                        className={cn('w-3.5 h-3.5', artifact.pinned && 'fill-current')}
                        style={{ color: artifact.pinned ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <h3 className="font-bold text-xs" style={{ color: 'var(--color-text)' }}>
                    {artifact.title}
                  </h3>
                </div>

                <div
                  className="flex items-center justify-between mt-4 pt-3 border-t text-[10px]"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}
                >
                  <span>v{artifact.current_version} · By Odin</span>
                  {artifact.used_as_context && (
                    <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--color-warning)' }}>
                      <Sparkles className="w-2.5 h-2.5" aria-hidden="true" /> Used by Odin
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="divide-y rounded-xl overflow-hidden border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
          >
            {filteredArtifacts.map((artifact) => (
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
                className="flex items-center justify-between p-3.5 cursor-pointer transition-colors text-xs"
                style={{ color: 'var(--color-text)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{artifact.title}</p>
                    <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      {artifact.artifact_type} · Version {artifact.current_version}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                  {artifact.used_as_context && (
                    <span className="flex items-center gap-1" style={{ color: 'var(--color-warning)' }}>
                      <Sparkles className="w-3 h-3" aria-hidden="true" /> Context
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(artifact.id);
                    }}
                    aria-label={artifact.pinned ? 'Unpin artifact' : 'Pin artifact'}
                    className={cardActionClass}
                  >
                    <Pin
                      className={cn('w-3.5 h-3.5', artifact.pinned && 'fill-current')}
                      style={{ color: artifact.pinned ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}