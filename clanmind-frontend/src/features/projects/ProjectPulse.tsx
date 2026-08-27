/**
 * Project Pulse (FE §84, §22) — progress bar + status grid + activity timeline.
 *
 * §22: Activity timeline. Who did what, when. AI actions, human actions. Filterable.
 * §84: Focus / Blocked / Next + Odin unresolved-decisions notice.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, ArrowRight, User, Bot, Settings } from 'lucide-react';
import { Progress } from '@/design-system/components/Progress';
import { cn } from '@/design-system/utils';
import type { Project, ActivityEvent } from '@/types';

export interface ProjectPulseProps {
  project: Project;
  aiName: string;
  /** §84 "Odin: N unresolved decisions need attention." */
  unresolvedDecisionCount: number;
  onNavigateToDecisions?: () => void;
  /** §22 activity timeline — who did what, when. */
  activityEvents?: ActivityEvent[];
}

type ActorFilter = 'all' | 'USER' | 'AI' | 'SYSTEM';

const ACTOR_FILTERS: Array<{ key: ActorFilter; label: string; icon: React.ReactNode }> = [
  { key: 'all', label: 'All', icon: null },
  { key: 'USER', label: 'Humans', icon: <User className="w-3 h-3" aria-hidden="true" /> },
  { key: 'AI', label: 'AI', icon: <Bot className="w-3 h-3" aria-hidden="true" /> },
  { key: 'SYSTEM', label: 'System', icon: <Settings className="w-3 h-3" aria-hidden="true" /> },
];

function actorIcon(actorType: string): React.ReactNode {
  switch (actorType) {
    case 'AI':
      return <Bot className="w-3 h-3" aria-hidden="true" />;
    case 'SYSTEM':
      return <Settings className="w-3 h-3" aria-hidden="true" />;
    default:
      return <User className="w-3 h-3" aria-hidden="true" />;
  }
}

function relativeEventTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

export function ProjectPulse({
  project,
  aiName,
  unresolvedDecisionCount,
  onNavigateToDecisions,
  activityEvents = [],
}: ProjectPulseProps) {
  const [animatePulse, setAnimatePulse] = useState(false);
  const [actorFilter, setActorFilter] = useState<ActorFilter>('all');

  useEffect(() => {
    const tStart = setTimeout(() => setAnimatePulse(true), 10);
    const tEnd = setTimeout(() => setAnimatePulse(false), 1200);
    return () => {
      clearTimeout(tStart);
      clearTimeout(tEnd);
    };
  }, [project.pulse_progress]);

  // §22 filterable activity timeline
  const filteredEvents = useMemo(() => {
    if (actorFilter === 'all') return activityEvents;
    return activityEvents.filter((e) => e.actor_type === actorFilter);
  }, [activityEvents, actorFilter]);

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
            aria-label="Review unresolved decisions"
          >
            Review <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* §22 Activity Timeline — who did what, when. Filterable. */}
      {activityEvents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
              ACTIVITY
            </span>
            <div className="flex items-center gap-1" role="group" aria-label="Filter activity by actor">
              {ACTOR_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActorFilter(f.key)}
                  aria-pressed={actorFilter === f.key}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer',
                    actorFilter === f.key
                      ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                      : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)]',
                  )}
                >
                  {f.icon}
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 max-h-40 overflow-y-auto" role="feed" aria-label="Activity timeline">
            {filteredEvents.length === 0 ? (
              <p className="text-[11px] py-2" style={{ color: 'var(--color-text-tertiary)' }}>
                No {actorFilter === 'all' ? '' : actorFilter.toLowerCase()} activity yet.
              </p>
            ) : (
              filteredEvents.slice(0, 8).map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2 py-1.5 px-2 rounded-md text-[11px]"
                  style={{ background: 'var(--color-surface-hover)' }}
                  role="article"
                  aria-label={`${event.actor_type} activity: ${event.summary}`}
                >
                  <span
                    className="mt-0.5 shrink-0"
                    style={{ color: event.actor_type === 'AI' ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}
                  >
                    {actorIcon(event.actor_type)}
                  </span>
                  <span className="flex-1 min-w-0" style={{ color: 'var(--color-text-secondary)' }}>
                    {event.summary}
                  </span>
                  <span className="text-[10px] shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                    {relativeEventTime(event.occurred_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
