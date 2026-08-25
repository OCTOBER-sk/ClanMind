import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '../utils';

export interface ErrorStateProps {
  /** Override the default error icon */
  icon?: React.ReactNode;
  /** Error heading */
  title?: string;
  /** Human-readable error message */
  message: string;
  /** Optional retry action */
  onRetry?: () => void;
  /** Label for the retry button */
  retryLabel?: string;
  /** Optional secondary action */
  secondaryAction?: React.ReactNode;
  className?: string;
}

/**
 * §64 / §63: Error recovery — preserve content, show clear recovery path.
 * Never discard user input silently.
 */
export function ErrorState({
  icon,
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Retry',
  secondaryAction,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-10 px-6 text-center',
        className,
      )}
      role="alert"
    >
      <div className="mb-3 text-[var(--color-danger)]">
        {icon ?? <AlertCircle className="w-8 h-8" aria-hidden="true" />}
      </div>

      <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1.5">
        {title}
      </h3>

      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-xs mb-4">
        {message}
      </p>

      <div className="flex items-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              'inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-medium rounded-[var(--radius-md)]',
              'bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)]',
              'hover:bg-[var(--color-surface-pressed)] transition-colors cursor-pointer',
              'focus-visible:shadow-[var(--focus-ring)] outline-none',
            )}
          >
            {retryLabel}
          </button>
        )}
        {secondaryAction}
      </div>
    </div>
  );
}
