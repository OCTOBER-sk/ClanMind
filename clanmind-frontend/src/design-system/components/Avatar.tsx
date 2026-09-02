import React from 'react';
import * as RadixAvatar from '@radix-ui/react-avatar';
import { Bot } from 'lucide-react';
import { cn } from '../utils';
import type { PresenceState } from '@/types';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  presence?: PresenceState;
  isAi?: boolean;
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

const presenceConfig: Record<PresenceState, { className: string; label: string } | null> = {
  ONLINE: {
    className: 'bg-success ring-2 ring-background',
    label: 'Online',
  },
  IDLE: {
    className: 'bg-warning ring-2 ring-background',
    label: 'Idle',
  },
  AWAY: {
    className: 'bg-outline ring-2 ring-background',
    label: 'Away',
  },
  OFFLINE: null,
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
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
          // §7 corner-full for avatars
          'rounded-full overflow-hidden inline-flex items-center justify-center select-none shrink-0',
          // Odin active: spectral ring while active (§10), else tertiary at rest
          isAi && isAiActive && 'ring-2 ring-offset-1 ring-offset-background spectral-border',
          isAi && !isAiActive && 'ring-1 ring-outline-variant',
        )}
      >
        {isAi ? (
          src ? (
            <div
              className={cn(
                'w-full h-full flex items-center justify-center overflow-hidden',
                isAiActive && 'odin-working',
              )}
              aria-label={`${name} (AI)`}
            >
              <img src={src} alt={name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className={cn(
                'w-full h-full flex items-center justify-center',
                // §12.1 Avatar initials fallback on secondary-container for M3
                isAiActive ? 'odin-working' : 'bg-secondary-container text-on-secondary-container',
              )}
              aria-label={`${name} (AI)`}
            >
              <Bot
                className={cn(
                  sz.fallback === 'text-[9px]'
                    ? 'w-3 h-3'
                    : sz.fallback === 'text-[10px]'
                      ? 'w-3.5 h-3.5'
                      : 'w-4 h-4',
                  isAiActive ? 'text-white' : 'text-on-secondary-container',
                )}
                aria-hidden="true"
              />
            </div>
          )
        ) : (
          <>
            <RadixAvatar.Image src={src} alt={name} className="w-full h-full object-cover" />
            <RadixAvatar.Fallback
              delayMs={300}
              className={cn(
                'w-full h-full flex items-center justify-center font-medium tracking-tight rounded-full',
                sz.fallback,
                // §12.1 initials fallback on secondary-container
                'bg-secondary-container text-on-secondary-container',
              )}
              aria-label={name}
            >
              {getInitials(name)}
            </RadixAvatar.Fallback>
          </>
        )}
      </RadixAvatar.Root>

      {presenceDot && (
        <span
          aria-label={presenceDot.label}
          title={presenceDot.label}
          className={cn('absolute bottom-0 right-0 rounded-full shrink-0', sz.presence, presenceDot.className)}
        />
      )}
    </div>
  );
}
