import React from 'react';
import { cn } from '../utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'text';
}

// §12.1 Skeleton — M3: surface-container blocks with subtle shimmer (NOT spectral), for content loading.

export function Skeleton({ className, variant = 'rectangular', ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-surface-container isolate',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-[skeleton-shimmer_1500ms_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-[color-mix(in_srgb,var(--md-on-surface)_6%,transparent)] before:to-transparent',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'h-4 w-full rounded-xs',
        variant === 'rectangular' && 'rounded-xs',
        className,
      )}
      aria-busy="true"
      aria-live="polite"
      {...props}
    >
      <style>{`
        @keyframes skeleton-shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
