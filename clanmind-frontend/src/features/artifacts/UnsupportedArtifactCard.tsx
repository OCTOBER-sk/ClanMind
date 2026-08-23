import React from 'react';
import { AlertCircle, Download, RotateCcw } from 'lucide-react';
import { Button } from '@/design-system/components/Button';

export interface UnsupportedArtifactCardProps {
  onExportRaw?: () => void;
}

export function UnsupportedArtifactCard({ onExportRaw }: UnsupportedArtifactCardProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs space-y-4 bg-[var(--color-surface-raised)]">
      <div className="p-3 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
        <AlertCircle className="w-8 h-8 text-amber-500" />
      </div>

      <div className="max-w-sm space-y-1">
        <h3 className="font-bold text-sm text-[var(--color-text)]">
          This artifact was created by a newer ClanMind version.
        </h3>
        <p className="text-[var(--color-text-secondary)] text-xs">
          Update the ClanMind desktop app to view and interact with this artifact type, or export the raw source.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Download className="w-3.5 h-3.5" />}
          onClick={onExportRaw}
        >
          Export Raw Source
        </Button>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          onClick={() => alert('Checking for desktop updatesâ€¦')}
        >
          Check for Update
        </Button>
      </div>
    </div>
  );
}
