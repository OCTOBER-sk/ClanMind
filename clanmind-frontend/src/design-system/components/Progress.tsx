import React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '../utils';

export interface ProgressProps {
  value: number; // 0..100
  variant?: 'neutral' | 'spectral' | 'success';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Progress({
  value,
  variant = 'neutral',
  size = 'md',
  className,
}: ProgressProps) {
  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  };

  // §4 semantic tokens; spectral reserved for meaningful progress (§3.3)
  const indicatorVariantClasses = {
    neutral: 'bg-[var(--color-primary)]',
    spectral: 'spectral-active',
    success: 'bg-[var(--color-success)]',
  };

  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <ProgressPrimitive.Root
      value={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedValue}
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-[var(--color-surface-hover)]',
        sizeClasses[size],
        className
      )}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full w-full flex-1 transition-all duration-300 ease-in-out',
          indicatorVariantClasses[variant]
        )}
        style={{ transform: `translateX(-${100 - clampedValue}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}