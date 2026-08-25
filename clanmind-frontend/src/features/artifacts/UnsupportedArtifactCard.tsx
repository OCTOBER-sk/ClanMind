import { AlertCircle, Download, FileJson, RefreshCw } from 'lucide-react';
import { Button } from '@/design-system/components/Button';

export interface UnsupportedArtifactCardProps {
  /** §291 — raw/export escape hatches keep the content reachable. */
  onViewRaw?: () => void;
  onExportRaw?: () => void;
  /** Update surface — desktop updater check wired by the panel. */
  onUpdate?: () => void;
}

/**
 * FE §200/§291 — unknown artifact types and broken renderers land here.
 * No crash; the rest of ClanMind keeps working (FE §325 #9).
 */
export function UnsupportedArtifactCard({ onViewRaw, onExportRaw, onUpdate }: UnsupportedArtifactCardProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs space-y-4 bg-[var(--color-surface-raised)]">
      <div className="p-3 rounded-full bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/20">
        <AlertCircle className="w-8 h-8 text-[var(--color-warning)]" aria-hidden="true" />
      </div>

      <div className="max-w-sm space-y-1">
        <h3 className="font-bold text-sm text-[var(--color-text)]">
          This artifact was created by a newer ClanMind version.
        </h3>
        <p className="text-[var(--color-text-secondary)]">
          Update to view it here — or open the raw source below. Everything else in
          ClanMind keeps working.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {onViewRaw && (
          <Button size="sm" variant="ghost" leftIcon={<FileJson className="w-3.5 h-3.5" />} onClick={onViewRaw}>
            View raw
          </Button>
        )}
        {onExportRaw && (
          <Button size="sm" variant="outline" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={onExportRaw}>
            Export JSON
          </Button>
        )}
        {onUpdate && (
          <Button size="sm" variant="primary" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={onUpdate}>
            Check for update
          </Button>
        )}
      </div>
    </div>
  );
}
