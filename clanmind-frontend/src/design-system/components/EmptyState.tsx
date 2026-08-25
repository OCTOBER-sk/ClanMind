import React from 'react';
import { cn } from '../utils';

export interface EmptyStateProps {
  /** Icon rendered at the top of the empty state */
  icon?: React.ReactNode;
  /** Primary heading text */
  title: string;
  /** Descriptive body text */
  description?: string;
  /** Optional action(s) — button(s) or links */
  actions?: React.ReactNode;
  /** Constrain max width for readability */
  maxWidth?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * §63: Every major surface needs intentional empty states.
 * Invites action without feeling like marketing.
 */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  maxWidth = 'md',
  className,
}: EmptyStateProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-6 text-center',
        maxWidthClasses[maxWidth],
        className,
      )}
    >
      {icon && (
        <div className="mb-4 text-[var(--color-text-tertiary)]">
          {icon}
        </div>
      )}

      <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1.5">
        {title}
      </h3>

      {description && (
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-xs">
          {description}
        </p>
      )}

      {actions && (
        <div className="mt-4 flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
