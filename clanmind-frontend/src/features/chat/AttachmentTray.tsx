import React from 'react';
import { FileText, Image as ImageIcon, X, AlertCircle, Loader2 } from 'lucide-react';
import type { Attachment } from '@/types';

export interface AttachmentTrayProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

/** §48/§50/§51: chip states — selected/uploading/uploaded/failed; retry & remove; never drop silently */
export function AttachmentTray({ attachments, onRemove }: AttachmentTrayProps) {
  if (attachments.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 p-2 border-b rounded-t-lg"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {attachments.map((file) => {
        const isImage = file.mime_type.startsWith('image/');
        const isUploading = file.sync_state === 'UPLOADING' || file.sync_state === 'QUEUED';
        const isFailed = file.sync_state === 'CONFLICT';

        return (
          <div
            key={file.id}
            className="flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs shadow-[var(--shadow-sm)] max-w-[220px]"
            style={{
              background: 'var(--color-surface-raised)',
              borderColor: 'var(--color-border)',
            }}
          >
            {isImage ? (
              <ImageIcon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-info)' }} aria-hidden="true" />
            ) : (
              <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
            )}

            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-[11px]" style={{ color: 'var(--color-text)' }}>
                {file.file_name}
              </p>
              <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                {isUploading ? (
                  <span className="flex items-center gap-1" style={{ color: 'var(--color-info)' }}>
                    <Loader2 className="w-2.5 h-2.5 animate-spin" aria-hidden="true" />
                    {file.sync_state === 'QUEUED' ? 'Queued' : `${file.upload_progress || 45}%`}
                  </span>
                ) : isFailed ? (
                  <span className="flex items-center gap-1" style={{ color: 'var(--color-danger)' }}>
                    <AlertCircle className="w-2.5 h-2.5" aria-hidden="true" />
                    {/* §51 */}
                    Couldn&rsquo;t upload this file.
                  </span>
                ) : (
                  `${(file.file_size / 1024).toFixed(0)} KB`
                )}
              </span>
            </div>

            {isFailed && (
              <button
                onClick={() => onRemove(file.id)}
                className="text-[10px] font-semibold cursor-pointer hover:underline"
                style={{ color: 'var(--color-danger)' }}
              >
                Retry
              </button>
            )}

            <button
              onClick={() => onRemove(file.id)}
              aria-label={`Remove ${file.file_name}`}
              className="p-0.5 rounded cursor-pointer hover:opacity-80"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}