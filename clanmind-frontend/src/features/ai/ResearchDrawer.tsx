import React from 'react';
import { Globe, ExternalLink, Bot, AlertTriangle, X } from 'lucide-react';
import type { AiSourceCitation } from '@/types';
import { handleExternalLinkClick } from '@/tauri/externalLinkPolicy';

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
    <div className="flex flex-col h-full text-xs" style={{ background: 'var(--color-surface-raised)', borderLeft: '1px solid var(--color-border)' }}>
      {/* Header — §143: "Research · N sources" */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
          <div>
            <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
              Research
            </h3>
            <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {sources.length} source{sources.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close research drawer"
          className="p-1 cursor-pointer hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 leading-relaxed">
        {/* Research Topic */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Research Scope
          </span>
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
            {topic}
          </h2>
        </div>

        {/* Executive Summary */}
        <div className="p-3.5 rounded-lg border space-y-1.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--color-text-tertiary)' }}>
            Summary
          </span>
          <p style={{ color: 'var(--color-text)' }}>{summary}</p>
        </div>

        {/* PROJECT IMPACT (§147) — ClanMind Signature Experience — spectral accent for AI-generated insight */}
        <div
          className="p-4 rounded-lg border space-y-2"
          style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface)' }}
        >
          <div className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--color-text)' }}>
            <Bot className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
            <span>Impact on this Project</span>
          </div>
          <p className="leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {projectImpact}
          </p>
        </div>

        {/* Key Findings List */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--color-text-tertiary)' }}>
            Key Technical Findings
          </span>
          <div className="space-y-1.5">
            {findings.map((f, i) => (
              <div
                key={i}
                className="p-2.5 rounded-md flex items-start gap-2"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--color-text-tertiary)' }} />
                <p style={{ color: 'var(--color-text)' }}>{f}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sources Cards Grid (§144) — source card: title, domain, retrieved, Open */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--color-text-tertiary)' }}>
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
                className="block p-3 rounded-md hover:opacity-90 transition-opacity shadow-xs group"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>
                    {src.domain}
                  </span>
                  <ExternalLink className="w-3 h-3 transition-opacity" style={{ color: 'var(--color-text-tertiary)' }} />
                </div>
                <h4 className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                  {src.title}
                </h4>
                {src.snippet && (
                  <p className="text-[11px] line-clamp-2 mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {src.snippet}
                  </p>
                )}
              </a>
            ))}
          </div>
        </div>

        {/* Uncertainty & Limitations */}
        {uncertainty && (
          <div
            className="p-3 rounded-md text-[11px] flex items-start gap-2"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
            <p>{uncertainty}</p>
          </div>
        )}
      </div>
    </div>
  );
}
