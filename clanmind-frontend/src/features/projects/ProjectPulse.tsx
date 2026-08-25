import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Progress } from '@/design-system/components/Progress';
import type { Project } from '@/types';

export interface ProjectPulseProps {
  project: Project;
  aiName: string;
  /** §84 "Odin: N unresolved decisions need attention." */
  unresolvedDecisionCount: number;
  onNavigateToDecisions?: () => void;
}

export function ProjectPulse({
  project,
  aiName,
  unresolvedDecisionCount,
  onNavigateToDecisions,
}: ProjectPulseProps) {
  const [animatePulse, setAnimatePulse] = useState(false);

  useEffect(() => {
    const tStart = setTimeout(() => setAnimatePulse(true), 10);
    const tEnd = setTimeout(() => setAnimatePulse(false), 1200);
    return () => {
      clearTimeout(tStart);
      clearTimeout(tEnd);
    };
  }, [project.pulse_progress]);

  return (
    <div
      className="p-4 rounded-lg border space-y-3"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
          PROJECT PULSE
        </span>
        <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text)' }}>
          {project.pulse_progress}%
        </span>
      </div>

      {/* Progress Line with Single Spectral Sweep Animation (§85) */}
      <div className="relative overflow-hidden rounded-full">
        <Progress value={project.pulse_progress} size="md" variant="neutral" />
        {animatePulse && (
          <div className="absolute inset-0 spectral-active opacity-70 animate-pulse pointer-events-none" />
        )}
      </div>

      {/* Status Grid — compact, semantic colors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div
          className="p-2.5 rounded-md"
          style={{ background: 'var(--color-surface-hover)' }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Focus
          </span>
          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
            {project.current_focus || 'Not set yet'}
          </p>
        </div>

        <div
          className="p-2.5 rounded-md"
          style={{ background: 'var(--color-surface-hover)' }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Blocked
          </span>
          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
            {project.blocked_reason || 'Nothing blocked'}
          </p>
        </div>

        <div
          className="p-2.5 rounded-md"
          style={{ background: 'var(--color-surface-hover)' }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Next
          </span>
          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
            {project.next_step || 'No next step captured'}
          </p>
        </div>
      </div>

      {/* §84 Odin notice — computed from the real decision log, never a
          hardcoded count. Hidden entirely when nothing needs review. */}
      {unresolvedDecisionCount > 0 && (
        <div
          className="flex items-center justify-between p-2.5 rounded-md text-xs"
          style={{ background: 'var(--color-surface-hover)' }}
        >
          <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
            <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
            <span>
              {aiName}: {unresolvedDecisionCount} unresolved{' '}
              {unresolvedDecisionCount === 1 ? 'decision needs' : 'decisions need'} attention.
            </span>
          </div>
          <button
            onClick={onNavigateToDecisions}
            className="font-semibold hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            style={{ color: 'var(--color-text)' }}
          >
            Review <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
