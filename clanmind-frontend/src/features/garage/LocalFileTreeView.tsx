import { Folder, FileCode, FileText } from 'lucide-react';
import { FileSyncIcon, FileIndexChip } from './FileSyncIcon';
import { EmptyState } from '@/design-system/components/EmptyState';
import type { FileSyncState, FileIndexState } from '@/types';

export interface LocalFileItem {
  id: string;
  name: string;
  isFolder: boolean;
  size?: number;
  syncState: FileSyncState;
  indexState: FileIndexState;
  children?: LocalFileItem[];
}

export interface LocalFileTreeViewProps {
  files: LocalFileItem[];
  onSelectFile: (file: LocalFileItem) => void;
}

/** §188/§189/§212: local file tree with dual sync + index state display */
export function LocalFileTreeView({ files, onSelectFile }: LocalFileTreeViewProps) {
  return (
    <div
      className="rounded-lg border text-xs overflow-hidden"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b text-[10px] uppercase font-bold"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)', background: 'var(--color-surface)' }}
      >
        <span>File Name</span>
        <span>Sync &amp; AI Index</span>
      </div>

      {files.length === 0 ? (
        <EmptyState
          icon={<Folder className="w-8 h-8" />}
          title="No local files yet"
          description="Connect a folder to get started."
        />
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {files.map((file) => (
            <button
              key={file.id}
              onClick={() => onSelectFile(file)}
              className="w-full flex items-center justify-between px-3 py-2 transition-colors text-left cursor-pointer"
              style={{ color: 'var(--color-text)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {file.isFolder ? (
                  <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
                ) : file.name.endsWith('.c') || file.name.endsWith('.ts') ? (
                  <FileCode className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
                ) : (
                  <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
                )}
                <span className="font-semibold truncate">{file.name}</span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <FileIndexChip state={file.indexState} />
                <FileSyncIcon state={file.syncState} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}