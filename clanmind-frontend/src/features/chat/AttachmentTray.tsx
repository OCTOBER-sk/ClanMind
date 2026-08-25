import React from 'react';
import {
  FileText,
  File as FileIcon,
  Film,
  Music2,
  X,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import { cn } from '@/design-system/utils';
import { formatBytes } from '@/config/limits';
import type { Attachment } from '@/types';

export interface AttachmentTrayProps {
  attachments: Attachment[];
  /** X / Remove — always available except mid-flight (Cancel instead). */
  onRemove: (id: string) => void;
  /** §51 Retry on a failed chip. */
  onRetry?: (id: string) => void;
  /** §50 Cancel an in-flight upload. */
  onCancel?: (id: string) => void;
}

function glyphFor(mime: string): React.ReactNode {
  if (mime.startsWith('video/')) return <Film className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  if (mime.startsWith('audio/')) return <Music2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  if (mime === 'application/pdf' || mime.startsWith('text/'))
    return <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  return <FileIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
}

/**
 * §49 — thumbnails stay CHIP-SIZED. No large attachment cards in the composer.
 */
function Thumb({ attachment }: { attachment: Attachment }) {
  if (attachment.file_url && attachment.mime_type.startsWith('image/')) {
    return (
      <img
        src={attachment.file_url}
        alt=""
        className="h-7 w-7 shrink-0 rounded border object-cover"
        style={{ borderColor: 'var(--color-border)' }}
        loading="lazy"
      />
    );
  }
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border"
      style={{
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-tertiary)',
        background: 'var(--color-surface)',
      }}
      aria-hidden="true"
    >
      {glyphFor(attachment.mime_type)}
    </span>
  );
}

/**
 * §48/§49/§50/§51 — one compact chip per selected file:
 *   icon/thumbnail · filename · size-or-status · remove
 * States: selected → uploading (`name · 64%`, Cancel) → uploaded
 * (`Uploaded`, then `Uploaded · Preparing for Odin…` while indexing, §127)
 * → failed (`Couldn't upload this file.` with Retry/Remove — never dropped
 * silently).
 */
export function AttachmentTray({ attachments, onRemove, onRetry, onCancel }: AttachmentTrayProps) {
  if (attachments.length === 0) return null;

  return (
    <div
      role="list"
      aria-label="Attached files"
      data-testid="attachment-tray"
      className="flex flex-wrap items-center gap-2 p-2 border-b rounded-t-xl"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {attachments.map((file) => {
        const isUploading = file.upload_state === 'uploading';
        const isFailed = file.upload_state === 'failed';
        const indexing = file.index_state === 'INDEXING';

        let statusText: React.ReactNode;
        if (file.upload_state === 'selected') {
          statusText = `${formatBytes(file.file_size)} · Queued`;
        } else if (isUploading) {
          // §50 — `requirements.pdf · 64%`
          statusText = `${file.upload_progress ?? 0}%`;
        } else if (isFailed) {
          // §51 exact copy.
          statusText = "Couldn't upload this file.";
        } else if (file.upload_state === 'uploaded') {
          // §50 — after upload: `Uploaded`; while indexing add §127 note.
          statusText = indexing ? 'Uploaded · Preparing for Odin…' : 'Uploaded';
        } else {
          statusText = formatBytes(file.file_size);
        }

        return (
          <div
            key={file.id}
            role="listitem"
            data-testid="attachment-chip"
            data-upload-state={isFailed ? 'failed' : isUploading ? 'uploading' : file.upload_state}
            className={cn(
              'relative flex items-center gap-2 overflow-hidden rounded-lg border px-2 py-1.5 pr-1.5 text-[12px] max-w-[240px] transition-colors',
            )}
            style={{
              background: 'var(--color-surface-raised)',
              borderColor: isFailed ? 'var(--color-danger)' : 'var(--color-border)',
            }}
          >
            <Thumb attachment={file} />

            <div className="min-w-0 flex-1">
              <p
                className="truncate text-[12px] font-medium leading-tight"
                style={{ color: 'var(--color-text)' }}
                title={file.file_name}
              >
                {file.file_name}
              </p>
              <span
                className="mt-0.5 flex items-center gap-1 text-[10px] leading-tight"
                style={{
                  color: isFailed
                    ? 'var(--color-danger)'
                    : isUploading
                      ? 'var(--color-info)'
                      : file.upload_state === 'uploaded'
                        ? 'var(--color-success)'
                        : 'var(--color-text-tertiary)',
                }}
              >
                {isUploading && (
                  <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0" aria-hidden="true" />
                )}
                {file.upload_state === 'uploaded' && !indexing && (
                  <Check className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                )}
                {isFailed && <AlertCircle className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />}
                <span className="truncate">{statusText}</span>
              </span>
            </div>

            {isUploading ? (
              onCancel && (
                <button
                  type="button"
                  onClick={() => onCancel(file.id)}
                  className="shrink-0 cursor-pointer rounded px-1 py-0.5 text-[10px] font-semibold hover:bg-[var(--color-surface-hover)] transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-label={`Cancel upload of ${file.file_name}`}
                >
                  Cancel
                </button>
              )
            ) : isFailed ? (
              <>
                {onRetry && (
                  <button
                    type="button"
                    onClick={() => onRetry(file.id)}
                    className="shrink-0 cursor-pointer rounded px-1 py-0.5 text-[10px] font-semibold hover:underline"
                    style={{ color: 'var(--color-info)' }}
                    aria-label={`Retry upload of ${file.file_name}`}
                  >
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(file.id)}
                  className="shrink-0 cursor-pointer rounded px-1 py-0.5 text-[10px] font-semibold hover:underline"
                  style={{ color: 'var(--color-danger)' }}
                  aria-label={`Remove ${file.file_name}`}
                >
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onRemove(file.id)}
                aria-label={`Remove ${file.file_name}`}
                className="shrink-0 cursor-pointer rounded p-0.5 hover:bg-[var(--color-surface-hover)] transition-colors"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}

            {/* §50 — quiet progress edge; width only, no looping animation */}
            {isUploading && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-0 h-0.5 transition-[width] duration-200"
                style={{
                  width: `${file.upload_progress ?? 0}%`,
                  background: 'var(--color-info)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
