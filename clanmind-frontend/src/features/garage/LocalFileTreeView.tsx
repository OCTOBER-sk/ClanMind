import { Folder, FileCode, FileText } from 'lucide-react';
import { FileSyncIcon, FileIndexChip } from './FileSyncIcon';
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
      className="p-4 rounded-xl border space-y-2 text-xs"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
    >
      <div
        className="flex items-center justify-between pb-2 border-b text-[10px] uppercase font-bold"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}
      >
        <span>File Name</span>
        <span>Sync &amp; AI Index Status</span>
      </div>

      {files.length === 0 && (
        <p className="py-4 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
          No local files yet. Connect a folder to get started.
        </p>
      )}

      <div className="space-y-1">
        {files.map((file) => (
          <button
            key={file.id}
            onClick={() => onSelectFile(file)}
            className="w-full flex items-center justify-between p-2 rounded-lg transition-colors text-left cursor-pointer"
            style={{ color: 'var(--color-text)' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {file.isFolder ? (
                <Folder className="w-4 h-4 shrink-0" style={{ color: 'var(--color-info)' }} aria-hidden="true" />
              ) : file.name.endsWith('.c') || file.name.endsWith('.ts') ? (
                <FileCode className="w-4 h-4 shrink-0" style={{ color: 'var(--color-info)' }} aria-hidden="true" />
              ) : (
                <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
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
    </div>
  );
}