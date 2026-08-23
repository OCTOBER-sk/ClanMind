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
    <div className="flex items-center justify-between px-4 py-2 bg-rose-500 text-white shadow-md z-30 select-none">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-bold text-xs tracking-wider">
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
          <span>MEETING IN PROGRESS</span>
        </div>
        <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-rose-600/60">
          {formatTime(elapsedSeconds)}
        </span>
        {isPaused && (
          <span className="text-[10px] uppercase font-bold tracking-widest bg-yellow-400 text-yellow-950 px-1.5 py-0.5 rounded">
            PAUSED
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isPaused ? (
          <Button
            size="sm"
            variant="outline"
            className="text-white border-white/60 hover:bg-white/10"
            leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
            onClick={onResume}
          >
            Resume
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="text-white border-white/60 hover:bg-white/10"
            leftIcon={<Pause className="w-3.5 h-3.5" />}
            onClick={onPause}
          >
            Pause
          </Button>
        )}

        <Button
          size="sm"
          variant="secondary"
          className="bg-white text-rose-600 hover:bg-gray-100"
          leftIcon={<Square className="w-3.5 h-3.5 fill-current" />}
          onClick={onEnd}
        >
          End Meeting
        </Button>
      </div>
    </div>
  );
}
