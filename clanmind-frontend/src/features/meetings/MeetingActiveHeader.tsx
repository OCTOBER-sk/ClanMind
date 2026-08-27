import React from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { Button } from '@/design-system/components/Button';

export interface MeetingActiveHeaderProps {
  elapsedSeconds: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}

export function MeetingActiveHeader({
  elapsedSeconds,
  isPaused,
  onPause,
  onResume,
  onEnd,
}: MeetingActiveHeaderProps) {
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-2 z-30 select-none"
      style={{
        background: 'var(--color-surface-elevated)',
        borderBottom: '1px solid var(--color-border-strong)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-bold text-xs tracking-wider">
          {/* §52 — active meeting indicator: spectral pulse for a first-class live state */}
          <span className="w-2.5 h-2.5 rounded-full spectral-active animate-pulse" aria-hidden="true" />
          <span style={{ color: 'var(--color-text)' }} aria-label="Meeting in progress">MEETING IN PROGRESS</span>
        </div>
        <span
          className="text-xs font-mono font-medium px-2 py-0.5 rounded"
          style={{
            color: 'var(--color-text-secondary)',
            background: 'var(--color-surface-hover)',
          }}
          aria-label={`Elapsed time: ${formatTime(elapsedSeconds)}`}
          role="timer"
        >
          {formatTime(elapsedSeconds)}
        </span>
        {isPaused && (
          <span
            className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded"
            style={{
              color: 'var(--color-warning)',
              background: 'var(--color-warning-bg)',
            }}
          >
            PAUSED
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isPaused ? (
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
            onClick={onResume}
            aria-label="Resume meeting timer"
          >
            Resume
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Pause className="w-3.5 h-3.5" />}
            onClick={onPause}
            aria-label="Pause meeting timer"
          >
            Pause
          </Button>
        )}

        <Button
          size="sm"
          variant="danger"
          leftIcon={<Square className="w-3.5 h-3.5 fill-current" />}
          onClick={onEnd}
          aria-label="End the current meeting"
        >
          End Meeting
        </Button>
      </div>
    </div>
  );
}
