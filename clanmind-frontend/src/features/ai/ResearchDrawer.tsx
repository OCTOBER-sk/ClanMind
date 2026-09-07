import React from 'react';
import { Globe, ExternalLink, Bot, AlertTriangle, X } from 'lucide-react';
import type { AiSourceCitation } from '@/types';
import { handleExternalLinkClick } from '@/tauri/externalLinkPolicy';

export interface ResearchDrawerProps {
  aiName?: string;
  topic: string;
  /** Derived from the AI run's tool-call outputs; absent when not yet synthesized. */
  summary?: string;
  findings?: string[];
  projectImpact?: string;
  uncertainty?: string;
  sources: AiSourceCitation[];
  onClose: () => void;
}

export function ResearchDrawer({
  aiName = 'AI',
  topic,
  summary,
  findings,
  projectImpact,
  uncertainty,
  sources,
  onClose,
}: ResearchDrawerProps) {
  return (
    <div className="flex flex-col h-full text-xs bg-surface border-l border-outline-variant motion-reduce:transition-none">
      {/* Header — §143: "Research · N sources" — sticky tonal */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant bg-surface-container-high sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-on-surface-variant" aria-hidden="true" />
          <div>
            <h3 className="font-bold text-on-surface text-[13px] leading-none">Research</h3>
            <span className="text-[10px] text-on-surface-variant">
              {sources.length} source{sources.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close research drawer"
          className="p-1.5 rounded-full cursor-pointer outline-none focus-visible:shadow-[var(--md-focus-ring)] relative isolate overflow-hidden before:absolute before:inset-0 before:bg-current before:opacity-0 hover:before:opacity-[0.08] active:before:opacity-[0.10] before:transition-opacity before:duration-micro motion-reduce:before:transition-none motion-reduce:transition-none text-on-surface-variant transition-colors duration-micro ease-emphasized"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 leading-relaxed bg-surface">
        {/* Research Topic */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-on-surface-variant">Research Scope</span>
          <h2 className="text-sm font-bold text-on-surface">{topic}</h2>
        </div>

        {/* Executive Summary — neutral M3 surface (renders only when the run produced one) */}
        {summary && (
          <div className="p-3.5 rounded-md border border-outline-variant bg-surface-container-low space-y-1.5 motion-reduce:transition-none">
            <span className="text-[10px] font-bold uppercase tracking-wider block text-on-surface-variant">Summary</span>
            <p className="text-on-surface leading-relaxed">{summary}</p>
          </div>
        )}

        {/* PROJECT IMPACT (§147) — neutral tonal container, NOT spectral fill; left tertiary accent for AI insight */}
        {projectImpact && (
          <div className="p-4 rounded-md border border-outline-variant bg-surface-container-low border-l-[3px] border-l-tertiary space-y-2 motion-reduce:transition-none">
            <div className="flex items-center gap-1.5 font-bold text-on-surface">
              <Bot className="w-4 h-4 text-tertiary" aria-hidden="true" />
              <span>Impact on this Project</span>
            </div>
            <p className="leading-relaxed text-on-surface-variant">{projectImpact}</p>
          </div>
        )}

        {/* Key Findings List — tonal rows with state-layer hover */}
        {findings && findings.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider block text-on-surface-variant">Key Technical Findings</span>
            <div className="space-y-1.5">
              {findings.map((f, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-md flex items-start gap-2 border border-outline-variant bg-surface-container-lowest relative isolate overflow-hidden before:absolute before:inset-0 before:bg-[var(--md-on-surface)] before:opacity-0 hover:before:opacity-[0.08] before:transition-opacity before:duration-micro motion-reduce:before:transition-none motion-reduce:transition-none transition-colors duration-micro ease-emphasized"
                >
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-outline" aria-hidden="true" />
                  <p className="text-on-surface relative">{f}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sources Cards Grid (§144) — tonal container with state-layer hover */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider block text-on-surface-variant">
            Verified External Sources ({sources.length})
          </span>
          <div className="space-y-2">
            {sources.map((src) => (
              <a
                key={src.id}
                href={src.url}
                target="_blank"
                rel="noreferrer noopener"
                onClick={handleExternalLinkClick}
                className="block p-3 rounded-md border border-outline-variant bg-surface-container-lowest relative isolate overflow-hidden before:absolute before:inset-0 before:bg-[var(--md-on-surface)] before:opacity-0 hover:before:opacity-[0.08] active:before:opacity-[0.10] focus-visible:before:opacity-[0.10] before:transition-opacity before:duration-micro motion-reduce:before:transition-none focus-visible:shadow-[var(--md-focus-ring)] outline-none transition-colors duration-micro ease-emphasized motion-reduce:transition-none group"
              >
                <div className="flex items-center justify-between mb-1 relative">
                  <span className="text-[10px] font-mono font-semibold text-on-surface-variant">{src.domain}</span>
                  <ExternalLink className="w-3 h-3 text-on-surface-variant group-hover:text-on-surface transition-colors duration-micro motion-reduce:transition-none" aria-hidden="true" />
                </div>
                <h4 className="font-semibold truncate text-on-surface relative">{src.title}</h4>
                {src.snippet && (
                  <p className="text-[11px] line-clamp-2 mt-1 text-on-surface-variant relative">{src.snippet}</p>
                )}
              </a>
            ))}
          </div>
        </div>

        {/* Uncertainty & Limitations — subtle tonal, no alarm fill */}
        {uncertainty && (
          <div className="p-3 rounded-md text-[11px] flex items-start gap-2 border border-outline-variant bg-surface-container-low text-on-surface-variant motion-reduce:transition-none">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning" aria-hidden="true" />
            <p>{uncertainty}</p>
          </div>
        )}
      </div>
    </div>
  );
}
