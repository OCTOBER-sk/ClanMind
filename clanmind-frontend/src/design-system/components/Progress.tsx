import React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '../utils';

export interface ProgressProps {
  value: number; // 0..100
  variant?: 'neutral' | 'spectral' | 'success' | 'wavy';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// §12.1 Progress — M3 linear + wavy determinate variant. Surface container track, primary indicator.

export function Progress({ value, variant = 'neutral', size = 'md', className }: ProgressProps) {
  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  };

  const indicatorVariantClasses = {
    neutral: 'bg-primary',
    spectral: 'spectral-active',
    success: 'bg-success',
    wavy: 'bg-primary',
  };

  const clampedValue = Math.min(Math.max(value, 0), 100);
  const isWavy = variant === 'wavy';

  return (
    <ProgressPrimitive.Root
      value={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedValue}
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-surface-container',
        sizeClasses[size],
        className,
      )}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full w-full flex-1 transition-all duration-standard ease-emphasized',
          indicatorVariantClasses[variant],
          isWavy && 'relative after:absolute after:inset-0 after:bg-[repeating-linear-gradient(90deg,transparent_0_6px,var(--md-on-primary)_6px_12px)] after:opacity-20 after:animate-[spectral-sweep_800ms_ease-out_1] motion-reduce:after:animate-none',
        )}
        style={{ transform: `translateX(-${100 - clampedValue}%)` }}
      />
      {isWavy && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `repeating-linear-gradient(90deg, transparent 0 8px, color-mix(in srgb, var(--md-primary) 20%, transparent) 8px 10px)`,
            clipPath: `inset(0 ${100 - clampedValue}% 0 0)`,
          }}
          aria-hidden="true"
        />
      )}
    </ProgressPrimitive.Root>
  );
}

export interface CircularProgressProps {
  value?: number; // 0..100, undefined = indeterminate
  size?: number;
  strokeWidth?: number;
  variant?: 'neutral' | 'spectral' | 'success';
  className?: string;
  'aria-label'?: string;
}

// M3 circular progress — indeterminate spins, determinate shows arc.

export function CircularProgress({
  value,
  size = 36,
  strokeWidth = 3.5,
  variant = 'neutral',
  className,
  'aria-label': ariaLabel,
}: CircularProgressProps) {
  const isIndeterminate = value === undefined || value === null;
  const clamped = isIndeterminate ? 0 : Math.min(Math.max(value!, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    variant === 'spectral'
      ? 'stroke-[var(--md-primary)]'
      : variant === 'success'
        ? 'stroke-success'
        : 'stroke-primary';

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={isIndeterminate ? undefined : clamped}
      aria-label={ariaLabel ?? (isIndeterminate ? 'Loading' : `${clamped}%`)}
      className={cn('inline-flex items-center justify-center', isIndeterminate && 'animate-spin', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-container-high"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={isIndeterminate ? circumference * 0.75 : offset}
          className={cn('transition-all duration-standard ease-emphasized', strokeColor)}
        />
      </svg>
    </div>
  );
}

// M3 Expressive shape-morph loading indicator — exported for Phase 4 (Odin working state).
// Morphs between circle → squircle → diamond via border-radius animation, 220ms emphasized.

export interface MorphingSpinnerProps {
  size?: number;
  className?: string;
  'aria-label'?: string;
}

export function MorphingSpinner({ size = 32, className, 'aria-label': ariaLabel = 'Loading' }: MorphingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <div
        className="w-full h-full bg-primary animate-[morphing-spinner_1200ms_var(--ease-emphasized)_infinite]"
        style={{
          borderRadius: '50%',
        }}
      />
      <style>{`
        @keyframes morphing-spinner {
          0% { border-radius: 50%; transform: scale(1) rotate(0deg); }
          25% { border-radius: 28% 72% 72% 28% / 28% 28% 72% 72%; transform: scale(0.95) rotate(90deg); }
          50% { border-radius: 16px; transform: scale(1) rotate(180deg); }
          75% { border-radius: 72% 28% 28% 72% / 72% 72% 28% 28%; transform: scale(0.95) rotate(270deg); }
          100% { border-radius: 50%; transform: scale(1) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Back-compat alias
export const Spinner = CircularProgress;
