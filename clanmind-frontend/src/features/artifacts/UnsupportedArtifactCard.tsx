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
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs space-y-4 bg-surface-container-low motion-reduce:transition-none" role="status" aria-label="Unsupported artifact">
      <div className="p-3 rounded-full bg-surface-container border border-outline-variant">
        <AlertCircle className="w-8 h-8 text-on-surface-variant" aria-hidden="true" />
      </div>

      <div className="max-w-sm space-y-1">
        <h3 className="font-bold text-sm text-on-surface">
          This artifact was created by a newer ClanMind version.
        </h3>
        <p className="text-on-surface-variant">
          Update to view it here — or open the raw source below. Everything else in
          ClanMind keeps working.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {onViewRaw && (
          <Button size="sm" variant="ghost" leftIcon={<FileJson className="w-3.5 h-3.5" />} onClick={onViewRaw} aria-label="View raw artifact content">
            View raw
          </Button>
        )}
        {onExportRaw && (
          <Button size="sm" variant="outline" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={onExportRaw} aria-label="Export artifact as JSON">
            Export JSON
          </Button>
        )}
        {onUpdate && (
          <Button size="sm" variant="primary" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={onUpdate} aria-label="Check for ClanMind update">
            Check for update
          </Button>
        )}
      </div>
    </div>
  );
}
