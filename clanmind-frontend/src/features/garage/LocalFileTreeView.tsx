/**
 * §50 File Tree — Hierarchical file browser with expand/collapse,
 * file type icons, size/date metadata, and dual sync + index state display.
 */

import { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileImage,
  FileArchive,
  File,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { FileSyncIcon, FileIndexChip } from './FileSyncIcon';
import { EmptyState } from '@/design-system/components/EmptyState';
import type { FileSyncState, FileIndexState } from '@/types';

export interface LocalFileItem {
  id: string;
  name: string;
  isFolder: boolean;
  size?: number;
  modified?: string;
  syncState: FileSyncState;
  indexState: FileIndexState;
  children?: LocalFileItem[];
}

export interface LocalFileTreeViewProps {
  files: LocalFileItem[];
  onSelectFile: (file: LocalFileItem) => void;
}

/** §50 — file type icon based on extension. */
function fileIcon(name: string, isFolder: boolean, isOpen?: boolean): React.ReactNode {
  if (isFolder) {
    return isOpen
      ? <FolderOpen className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
      : <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />;
  }
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  // Code files
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'c', 'cpp', 'h', 'java', 'rb', 'php', 'swift', 'kt'].includes(ext)) {
    return <FileCode className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-info)' }} aria-hidden="true" />;
  }
  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)) {
    return <FileImage className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-success)' }} aria-hidden="true" />;
  }
  // Archive files
  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext)) {
    return <FileArchive className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />;
  }
  // Text/document files
  if (['md', 'txt', 'doc', 'docx', 'pdf', 'rtf', 'json', 'yaml', 'yml', 'toml', 'xml', 'html', 'css'].includes(ext)) {
    return <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />;
  }
  return <File className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />;
}

/** §50 — human-readable file size. */
function formatSize(bytes?: number): string {
  if (bytes == null || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** §50 — single tree node with expand/collapse and metadata. */
function FileTreeNode({
  file,
  depth,
  onSelectFile,
}: {
  file: LocalFileItem;
  depth: number;
  onSelectFile: (file: LocalFileItem) => void;
}) {
  const [isOpen, setIsOpen] = useState(depth === 0);
  const hasChildren = file.isFolder && file.children && file.children.length > 0;

  const handleClick = () => {
    if (file.isFolder) {
      setIsOpen((prev) => !prev);
    }
    onSelectFile(file);
  };

  return (
    <div role="treeitem" aria-expanded={file.isFolder ? isOpen : undefined} aria-label={file.name}>
      <button
        onClick={handleClick}
        className="w-full flex items-center justify-between px-3 py-2 transition-colors text-left cursor-pointer hover:bg-[var(--color-surface-hover)]"
        style={{ color: 'var(--color-text)', paddingLeft: `${12 + depth * 16}px` }}
        aria-label={file.isFolder ? `${isOpen ? 'Collapse' : 'Expand'} ${file.name}` : file.name}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* §50 expand/collapse chevron for folders */}
          {file.isFolder ? (
            <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center" aria-hidden="true">
              {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          ) : (
            <span className="w-3.5 h-3.5 shrink-0" />
          )}
          {fileIcon(file.name, file.isFolder, isOpen)}
          <span className="font-semibold truncate">{file.name}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* §50 size metadata */}
          {file.size != null && file.size > 0 && (
            <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
              {formatSize(file.size)}
            </span>
          )}
          <FileIndexChip state={file.indexState} />
          <FileSyncIcon state={file.syncState} />
        </div>
      </button>

      {/* §50 recursive children when expanded */}
      {hasChildren && isOpen && (
        <div role="group">
          {file.children!.map((child) => (
            <FileTreeNode
              key={child.id}
              file={child}
              depth={depth + 1}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
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
        <span className="flex items-center gap-4">
          <span>Size</span>
          <span>Sync &amp; AI Index</span>
        </span>
      </div>

      {files.length === 0 ? (
        <EmptyState
          icon={<Folder className="w-8 h-8" />}
          title="No local files yet"
          description="Connect a folder to get started."
        />
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }} role="tree" aria-label="Project files">
          {files.map((file) => (
            <FileTreeNode
              key={file.id}
              file={file}
              depth={0}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
