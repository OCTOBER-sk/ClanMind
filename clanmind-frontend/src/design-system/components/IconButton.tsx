import React, { forwardRef } from 'react';
import { cn } from '../utils';
import { Loader2 } from 'lucide-react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string; // Mandatory for accessibility (§64, §7)
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = 'ghost',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // WCAG 2.2 AA target size: >= 24px floor, 32-40px core (§221)
    const sizeClasses = {
      xs: 'w-6 h-6 p-1 rounded min-w-[24px] min-h-[24px]',
      sm: 'w-8 h-8 p-1.5 rounded-md min-w-[32px] min-h-[32px]',
      md: 'w-9 h-9 p-2 rounded-lg min-w-[36px] min-h-[36px]',
      lg: 'w-11 h-11 p-2.5 rounded-lg min-w-[44px] min-h-[44px]',
    };

    // §4 semantic tokens
    const variantClasses = {
      primary:
        'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 active:opacity-80',
      secondary:
        'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-pressed)] active:opacity-90',
      outline:
        'bg-transparent border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-pressed)]',
      ghost:
        'bg-transparent text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] active:bg-[var(--color-surface-pressed)]',
      danger:
        'bg-transparent text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] active:opacity-80',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center transition-all select-none outline-none focus-visible:shadow-[var(--focus-ring)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer shrink-0',
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';