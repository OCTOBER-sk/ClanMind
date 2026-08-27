import React from 'react';
import { Sparkles, FileText, Bookmark, Globe, X } from 'lucide-react';

export interface ContextInspectorProps {
  onClose: () => void;
}

export function ContextInspector({ onClose }: ContextInspectorProps) {
  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-raised)] border-l border-[var(--color-border)]" role="complementary" aria-label="Odin context inspector">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" aria-hidden="true" />
          <h3 className="text-xs font-bold text-[var(--color-text)]">
            Odin Context Inspector
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close context inspector"
          className="p-1 rounded-lg cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-tertiary)]"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto">
        <p className="text-xs text-[var(--color-text-secondary)]">
          Provenance and references actively utilized by Odin for the latest project run:
        </p>

        {/* Item 1 */}
        <article className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text)] mb-1">
            <Bookmark className="w-3.5 h-3.5 text-[var(--color-info)]" aria-hidden="true" />
            <span>Decision #1: Use SPI with DMA</span>
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            Approved by Arun Kumar · Scoped under Flight Controller
          </p>
        </article>

        {/* Item 2 */}
        <article className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text)] mb-1">
            <FileText className="w-3.5 h-3.5 text-[var(--color-success)]" aria-hidden="true" />
            <span>ICM-42688P Hardware Datasheet Rev 1.2</span>
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            Indexed PDF · 48 pages · 24 MHz max clock constraint
          </p>
        </article>

        {/* Item 3 */}
        <article className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text)] mb-1">
            <Globe className="w-3.5 h-3.5 text-purple-500" aria-hidden="true" />
            <span>Web Research: STM32 DMA double-buffering latency</span>
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            6 verified sources retrieved on 2026-08-22
          </p>
        </article>
      </div>
    </div>
  );
}
