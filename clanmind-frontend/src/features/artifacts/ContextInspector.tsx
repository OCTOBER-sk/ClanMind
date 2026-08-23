import React from 'react';
import { Sparkles, FileText, Bookmark, Globe, X } from 'lucide-react';

export interface ContextInspectorProps {
  onClose: () => void;
}

export function ContextInspector({ onClose }: ContextInspectorProps) {
  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-raised)] border-l border-[var(--color-border)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold text-[var(--color-text)]">
            Odin Context Inspector
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close context inspector"
          className="p-1 rounded-lg cursor-pointer hover:opacity-80"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto">
        <p className="text-xs text-[var(--color-text-secondary)]">
          Provenance and references actively utilized by Odin for the latest project run:
        </p>

        {/* Item 1 */}
        <div className="p-3 rounded-lg border border-[var(--color-border)] bg-gray-50/60 dark:bg-gray-800/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text)] mb-1">
            <Bookmark className="w-3.5 h-3.5 text-blue-500" />
            <span>Decision #1: Use SPI with DMA</span>
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            Approved by Arun Kumar Â· Scoped under Flight Controller
          </p>
        </div>

        {/* Item 2 */}
        <div className="p-3 rounded-lg border border-[var(--color-border)] bg-gray-50/60 dark:bg-gray-800/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text)] mb-1">
            <FileText className="w-3.5 h-3.5 text-emerald-500" />
            <span>ICM-42688P Hardware Datasheet Rev 1.2</span>
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            Indexed PDF Â· 48 pages Â· 24 MHz max clock constraint
          </p>
        </div>

        {/* Item 3 */}
        <div className="p-3 rounded-lg border border-[var(--color-border)] bg-gray-50/60 dark:bg-gray-800/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text)] mb-1">
            <Globe className="w-3.5 h-3.5 text-purple-500" />
            <span>Web Research: STM32 DMA double-buffering latency</span>
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            6 verified sources retrieved on 2026-08-22
          </p>
        </div>
      </div>
    </div>
  );
}
