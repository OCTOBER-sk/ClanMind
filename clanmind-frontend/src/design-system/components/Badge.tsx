import React from 'react';
import { cn } from '../utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'spectral';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'neutral',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px] font-medium leading-none rounded',
    md: 'px-2 py-0.5 text-xs font-medium rounded-md',
  };

  // §4 semantic tokens — no hard-coded palette
  const variantClasses = {
    neutral:
      'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)]',
    success:
      'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-border)]',
    warning:
      'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-border)]',
    danger:
      'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-border)]',
    info: 'bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-border)]',
    spectral: 'spectral-active text-white border border-transparent',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium select-none',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}