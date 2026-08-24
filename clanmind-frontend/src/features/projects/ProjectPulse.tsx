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
    <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">
          PROJECT PULSE
        </span>
        <span className="text-xs font-mono font-bold text-[var(--color-text)]">
          {project.pulse_progress}% Complete
        </span>
      </div>

      {/* Progress Line with Single Spectral Sweep Animation (§85) */}
      <div className="relative overflow-hidden rounded-full">
        <Progress value={project.pulse_progress} size="md" variant="neutral" />
        {animatePulse && (
          <div className="absolute inset-0 spectral-active opacity-70 animate-pulse pointer-events-none" />
        )}
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
        <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1">
            Current Focus
          </span>
          <p className="font-semibold text-[var(--color-text)]">
            {project.current_focus || 'Not set yet'}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-1">
            Blocked On
          </span>
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            {project.blocked_reason || 'Nothing blocked'}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-1">
            Next
          </span>
          <p className="font-semibold text-blue-900 dark:text-blue-200">
            {project.next_step || 'No next step captured'}
          </p>
        </div>
      </div>

      {/* §84 Odin notice — computed from the real decision log, never a
          hardcoded count. Hidden entirely when nothing needs review. */}
      {unresolvedDecisionCount > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-hover)] text-xs">
          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>
              {aiName}: {unresolvedDecisionCount} unresolved{' '}
              {unresolvedDecisionCount === 1 ? 'decision needs' : 'decisions need'} attention.
            </span>
          </div>
          <button
            onClick={onNavigateToDecisions}
            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            Review <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
