import React from 'react';
import * as RadixAvatar from '@radix-ui/react-avatar';
import { Sparkles } from 'lucide-react';
import { cn } from '../utils';
import type { PresenceState } from '@/types';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Show presence dot — §19 */
  presence?: PresenceState;
  /** Is this the Odin AI avatar */
  isAi?: boolean;
  /** Odin is currently working — adds subtle spectral ring */
  isAiActive?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: { root: 'w-5 h-5', fallback: 'text-[9px]', presence: 'w-1.5 h-1.5' },
  sm: { root: 'w-7 h-7', fallback: 'text-[10px]', presence: 'w-2 h-2' },
  md: { root: 'w-8 h-8', fallback: 'text-xs', presence: 'w-2 h-2' },
  lg: { root: 'w-10 h-10', fallback: 'text-sm', presence: 'w-2.5 h-2.5' },
  xl: { root: 'w-12 h-12', fallback: 'text-base', presence: 'w-3 h-3' },
};

/** §19: Subtle presence states — no excessive colored dots */
const presenceConfig: Record<
  PresenceState,
  { className: string; label: string } | null
> = {
  ONLINE: {
    className: 'bg-[var(--color-success)] ring-2 ring-[var(--color-background)]',
    label: 'Online',
  },
  IDLE: {
    className: 'bg-[var(--color-warning)] ring-2 ring-[var(--color-background)]',
    label: 'Idle',
  },
  AWAY: {
    className: 'bg-[var(--color-text-tertiary)] ring-2 ring-[var(--color-background)]',
    label: 'Away',
  },
  OFFLINE: null, // Don't show a dot for offline — just absence of dot
};

/** Generate initials from name */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Deterministic background color from name */
function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
}

export function Avatar({
  name,
  src,
  size = 'md',
  presence,
  isAi = false,
  isAiActive = false,
  className,
}: AvatarProps) {
  const sz = sizeClasses[size];
  const presenceDot = presence ? presenceConfig[presence] : null;

  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      <RadixAvatar.Root
        className={cn(
          sz.root,
          'rounded-full overflow-hidden inline-flex items-center justify-center select-none shrink-0',
          // Odin active: subtle spectral ring — §130, §223
          isAi && isAiActive && 'ring-2 ring-offset-1 ring-violet-400/60',
          // AI base style
          isAi && !isAiActive && 'ring-1 ring-[var(--color-border)]',
        )}
      >
        {isAi ? (
          // Odin identity — §129, §131, §275
          <div
            className={cn(
              'w-full h-full flex items-center justify-center',
              isAiActive
                ? 'odin-working'
                : 'bg-[var(--color-surface-hover)]',
            )}
            aria-label={`${name} (AI)`}
          >
            <Sparkles
              className={cn(
                sz.fallback === 'text-[9px]' ? 'w-3 h-3' : sz.fallback === 'text-[10px]' ? 'w-3.5 h-3.5' : 'w-4 h-4',
                isAiActive ? 'text-white' : 'text-[var(--color-text-tertiary)]',
              )}
              aria-hidden="true"
            />
          </div>
        ) : (
          <>
            <RadixAvatar.Image
              src={src}
              alt={name}
              className="w-full h-full object-cover"
            />
            <RadixAvatar.Fallback
              delayMs={300}
              className={cn(
                'w-full h-full flex items-center justify-center font-semibold tracking-tight',
                sz.fallback,
                getAvatarColor(name),
              )}
              aria-label={name}
            >
              {getInitials(name)}
            </RadixAvatar.Fallback>
          </>
        )}
      </RadixAvatar.Root>

      {/* Presence dot — §19: subtle, not overused */}
      {presenceDot && (
        <span
          aria-label={presenceDot.label}
          title={presenceDot.label}
          className={cn(
            'absolute bottom-0 right-0 rounded-full shrink-0',
            sz.presence,
            presenceDot.className,
          )}
        />
      )}
    </div>
  );
}
