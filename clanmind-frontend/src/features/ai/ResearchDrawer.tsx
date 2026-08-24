import React from 'react';
import {
  Globe,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { AiSourceCitation } from '@/types';

export interface ResearchDrawerProps {
  topic: string;
  summary: string;
  findings: string[];
  projectImpact: string;
  uncertainty?: string;
  sources: AiSourceCitation[];
  onClose: () => void;
}

export function ResearchDrawer({
  topic,
  summary,
  findings,
  projectImpact,
  uncertainty,
  sources,
  onClose,
}: ResearchDrawerProps) {
  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-raised)] border-l border-[var(--color-border)] text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-gray-50/50 dark:bg-gray-800/40">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-purple-500" />
          <div>
            <h3 className="font-bold text-[var(--color-text)]">
              Web Research Report
            </h3>
            <span className="text-[10px] text-[var(--color-text-tertiary)]">{sources.length} sources verified</span>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close research drawer"
          className="p-1 cursor-pointer hover:opacity-80"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 leading-relaxed">
        {/* Research Topic */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1">
            Research Scope
          </span>
          <h2 className="text-sm font-bold text-[var(--color-text)]">
            {topic}
          </h2>
        </div>

        {/* Executive Summary */}
        <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-gray-50/60 dark:bg-gray-800/40 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
            Summary
          </span>
          <p className="text-[var(--color-text)]">{summary}</p>
        </div>

        {/* PROJECT IMPACT (§147) - ClanMind Signature Experience */}
        <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-purple-900 dark:text-purple-300">
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Impact on this Project</span>
          </div>
          <p className="text-purple-950 dark:text-purple-200 leading-relaxed">
            {projectImpact}
          </p>
        </div>

        {/* Key Findings List */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
            Key Technical Findings
          </span>
          <div className="space-y-1.5">
            {findings.map((f, i) => (
              <div
                key={i}
                className="p-2.5 rounded-lg border border-[var(--color-border)] bg-white dark:bg-gray-950 flex items-start gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                <p className="text-[var(--color-text)]">{f}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sources Cards Grid (§144) */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
            Verified External Sources ({sources.length})
          </span>
          <div className="space-y-2">
            {sources.map((src) => (
              <a
                key={src.id}
                href={src.url}
                target="_blank"
                rel="noreferrer"
                className="block p-3 rounded-lg border border-[var(--color-border)] bg-white dark:bg-gray-950 hover:border-purple-400 dark:hover:border-purple-600 transition-colors shadow-2xs group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-semibold">
                    {src.domain}
                  </span>
                  <ExternalLink className="w-3 h-3 text-[var(--color-text-tertiary)] group-hover:text-purple-500 transition-colors" />
                </div>
                <h4 className="font-semibold text-[var(--color-text)] group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors truncate">
                  {src.title}
                </h4>
                {src.snippet && (
                  <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2 mt-1">
                    {src.snippet}
                  </p>
                )}
              </a>
            ))}
          </div>
        </div>

        {/* Uncertainty & Limitations */}
        {uncertainty && (
          <div className="p-3 rounded-lg border border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p>{uncertainty}</p>
          </div>
        )}
      </div>
    </div>
  );
}
