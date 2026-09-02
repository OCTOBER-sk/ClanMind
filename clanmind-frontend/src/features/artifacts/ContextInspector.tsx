import React from 'react';
import { Sparkles, FileText, Bookmark, Globe, X } from 'lucide-react';

export interface ContextInspectorProps {
  onClose: () => void;
}

export function ContextInspector({ onClose }: ContextInspectorProps) {
  return (
    <div className="flex flex-col h-full bg-surface-container-low border-l border-outline-variant rounded-l-lg overflow-hidden motion-reduce:transition-none" role="complementary" aria-label="Odin context inspector">
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant bg-surface-container-low">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-tertiary" aria-hidden="true" />
          <h3 className="text-xs font-bold text-on-surface">
            Odin Context Inspector
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close context inspector"
          className="p-1 rounded-full cursor-pointer text-on-surface-variant relative isolate overflow-hidden before:absolute before:inset-0 before:bg-current before:opacity-0 hover:before:opacity-[0.08] active:before:opacity-[0.10] before:transition-opacity before:duration-micro motion-reduce:before:transition-none focus-visible:shadow-[var(--md-focus-ring)] focus-visible:outline-none transition-colors duration-micro ease-emphasized motion-reduce:transition-none"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto bg-surface-container-low">
        <p className="text-xs text-on-surface-variant">
          Provenance and references actively utilized by Odin for the latest project run:
        </p>

        {/* Item 1 */}
        <article className="p-3 rounded-md border border-outline-variant bg-surface-container relative isolate overflow-hidden before:absolute before:inset-0 before:bg-current before:opacity-0 hover:before:opacity-[0.08] before:transition-opacity before:duration-micro motion-reduce:before:transition-none motion-reduce:transition-none transition-colors duration-micro ease-emphasized">
          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface mb-1">
            <Bookmark className="w-3.5 h-3.5 text-tertiary" aria-hidden="true" />
            <span>Decision #1: Use SPI with DMA</span>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            Approved by Arun Kumar · Scoped under Flight Controller
          </p>
        </article>

        {/* Item 2 */}
        <article className="p-3 rounded-md border border-outline-variant bg-surface-container relative isolate overflow-hidden before:absolute before:inset-0 before:bg-current before:opacity-0 hover:before:opacity-[0.08] before:transition-opacity before:duration-micro motion-reduce:before:transition-none motion-reduce:transition-none transition-colors duration-micro ease-emphasized">
          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface mb-1">
            <FileText className="w-3.5 h-3.5 text-success" aria-hidden="true" />
            <span>ICM-42688P Hardware Datasheet Rev 1.2</span>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            Indexed PDF · 48 pages · 24 MHz max clock constraint
          </p>
        </article>

        {/* Item 3 */}
        <article className="p-3 rounded-md border border-outline-variant bg-surface-container relative isolate overflow-hidden before:absolute before:inset-0 before:bg-current before:opacity-0 hover:before:opacity-[0.08] before:transition-opacity before:duration-micro motion-reduce:before:transition-none motion-reduce:transition-none transition-colors duration-micro ease-emphasized">
          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface mb-1">
            <Globe className="w-3.5 h-3.5 text-tertiary" aria-hidden="true" />
            <span>Web Research: STM32 DMA double-buffering latency</span>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            6 verified sources retrieved on 2026-08-22
          </p>
        </article>
      </div>
    </div>
  );
}
