import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Progress } from '@/design-system/components/Progress';
import type { Project } from '@/types';

export interface ProjectPulseProps {
  project: Project;
  onNavigateToDecisions?: () => void;
}

export function ProjectPulse({ project, onNavigateToDecisions }: ProjectPulseProps) {
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
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
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
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
            Current Focus
          </span>
          <p className="font-semibold text-[var(--color-text)]">
            {project.current_focus || 'Sensor Fusion Firmware'}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-1">
            Blocked On
          </span>
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            {project.blocked_reason || 'None'}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-1">
            Next Milestone
          </span>
          <p className="font-semibold text-blue-900 dark:text-blue-200">
            {project.next_step || 'SPI Telemetry Driver'}
          </p>
        </div>
      </div>

      {/* Odin Notice (§84) */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-hover)] text-xs">
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Odin: 1 open decision needs team review.</span>
        </div>
        <button
          onClick={onNavigateToDecisions}
          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          Review <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
