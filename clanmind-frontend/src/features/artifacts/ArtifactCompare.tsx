import React from 'react';
import { GitCompare } from 'lucide-react';
import type { ArtifactVersion } from '@/types';

export interface ArtifactCompareProps {
  versionA: ArtifactVersion;
  versionB: ArtifactVersion;
  onClose: () => void;
}

export function ArtifactCompare({
  versionA,
  versionB,
  onClose,
}: ArtifactCompareProps) {
  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-raised)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-gray-50/50 dark:bg-gray-800/40">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-blue-500" />
          <h3 className="text-xs font-bold text-[var(--color-text)]">
            Comparing Version {versionA.version_number} vs Version {versionB.version_number}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
        >
          Exit Compare
        </button>
      </div>

      <div className="flex-1 grid grid-cols-2 divide-x divide-[var(--color-border)] overflow-y-auto">
        {/* Version A */}
        <div className="p-4 overflow-x-auto text-xs font-mono select-text bg-red-50/20 dark:bg-red-950/10">
          <div className="pb-2 mb-3 border-b border-[var(--color-border)] text-[11px] font-sans font-semibold text-gray-500">
            Version {versionA.version_number} Â· By {versionA.created_by_name}
          </div>
          <pre className="whitespace-pre-wrap leading-relaxed text-[var(--color-text)]">
            {versionA.content}
          </pre>
        </div>

        {/* Version B */}
        <div className="p-4 overflow-x-auto text-xs font-mono select-text bg-emerald-50/20 dark:bg-emerald-950/10">
          <div className="pb-2 mb-3 border-b border-[var(--color-border)] text-[11px] font-sans font-semibold text-gray-500">
            Version {versionB.version_number} Â· By {versionB.created_by_name}
          </div>
          <pre className="whitespace-pre-wrap leading-relaxed text-[var(--color-text)]">
            {versionB.content}
          </pre>
        </div>
      </div>
    </div>
  );
}
