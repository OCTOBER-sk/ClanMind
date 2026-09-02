import React from 'react';
import { cn } from '../utils';

type M3Variant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'spectral';
type CompatVariant = M3Variant | 'primary' | 'secondary' | 'ghost' | 'outline' | 'text' | 'tonal' | 'filled' | 'circular' | 'elevated' | 'destructive';

const aliasMap: Record<string, M3Variant> = {
  neutral: 'neutral',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  spectral: 'spectral',
  // compat
  primary: 'neutral',
  secondary: 'neutral',
  ghost: 'neutral',
  outline: 'neutral',
  text: 'neutral',
  tonal: 'neutral',
  filled: 'neutral',
  circular: 'neutral',
  elevated: 'neutral',
  destructive: 'danger',
};

function normalize(v: string): M3Variant {
  return aliasMap[v] ?? 'neutral';
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: CompatVariant;
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'neutral',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const v = normalize(variant as string);

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[11px] leading-none rounded-full',
    md: 'px-2 py-0.5 text-xs leading-none rounded-full',
  };

  // §12.1 Badge — M3 tonal containers, §7 shape small pill = corner-full for status
  const variantClasses: Record<M3Variant, string> = {
    neutral: 'bg-surface-variant text-on-surface-variant border border-outline-variant',
    success: 'bg-success-container text-on-success-container border border-transparent',
    warning: 'bg-warning-container text-on-warning-container border border-transparent',
    danger: 'bg-error-container text-on-error-container border border-transparent',
    info: 'bg-tertiary-container text-on-tertiary-container border border-transparent',
    spectral: 'spectral-active text-white border border-transparent',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium select-none rounded-full',
        sizeClasses[size],
        variantClasses[v],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
