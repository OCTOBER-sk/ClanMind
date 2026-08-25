import React from 'react';
import { cn } from '../utils';

export interface ClanMindLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'calm' | 'spectral';
  showWordmark?: boolean;
  className?: string;
}

export function ClanMindLogo({
  size = 'md',
  variant = 'calm',
  showWordmark = true,
  className,
}: ClanMindLogoProps) {
  const sizeMap = {
    sm: { icon: 20, text: 'text-xs', gap: 'gap-1.5' },
    md: { icon: 26, text: 'text-sm', gap: 'gap-2' },
    lg: { icon: 36, text: 'text-lg', gap: 'gap-2.5' },
    xl: { icon: 48, text: 'text-2xl', gap: 'gap-3' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={cn('inline-flex items-center select-none', currentSize.gap, className)}>
      {/* Crisp Minimalist Vector Logo Mark */}
      <svg
        width={currentSize.icon}
        height={currentSize.icon}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          'shrink-0 transition-all duration-300',
          variant === 'spectral' && 'drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]'
        )}
      >
        {/* Outer Minimalist Shield Nexus */}
        <rect
          x="3"
          y="3"
          width="26"
          height="26"
          rx="7"
          className="fill-gray-900 dark:fill-white transition-colors"
        />

        {/* Inner Interconnected Clan + Mind Neural Circuit */}
        {/* Top Node */}
        <circle cx="16" cy="10" r="2.5" className="fill-white dark:fill-gray-900" />
        {/* Bottom Left Node */}
        <circle cx="10.5" cy="20.5" r="2.5" className="fill-white dark:fill-gray-900" />
        {/* Bottom Right Node */}
        <circle cx="21.5" cy="20.5" r="2.5" className="fill-white dark:fill-gray-900" />

        {/* Connecting Synaptic Bridge Lines */}
        <line
          x1="16"
          y1="10"
          x2="10.5"
          y2="20.5"
          stroke="currentColor"
          className="text-white dark:text-gray-900"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1="16"
          y1="10"
          x2="21.5"
          y2="20.5"
          stroke="currentColor"
          className="text-white dark:text-gray-900"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1="10.5"
          y1="20.5"
          x2="21.5"
          y2="20.5"
          stroke="currentColor"
          className="text-white dark:text-gray-900"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        {/* Central Dynamic AI Core (§223) */}
        <circle
          cx="16"
          cy="17"
          r="1.8"
          className={cn(
            'transition-colors',
            variant === 'spectral'
              ? 'fill-amber-400 animate-pulse'
              : 'fill-gray-900 dark:fill-white'
          )}
        />
      </svg>

      {/* Wordmark */}
      {showWordmark && (
        <span className={cn('font-bold tracking-tight text-gray-900 dark:text-gray-100', currentSize.text)}>
          ClanMind
        </span>
      )}
    </div>
  );
}
