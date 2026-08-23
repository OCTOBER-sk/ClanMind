import React, { forwardRef } from 'react';
import { cn } from '../utils';
import { Loader2, Check } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'spectral';
  size?: 'sm' | 'md' | 'lg';
  /** Show spinner and disable button */
  loading?: boolean;
  /** @deprecated use loading */
  isLoading?: boolean;
  /** Brief success state — e.g. after copy */
  success?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      loading = false,
      isLoading = false, // backwards compat
      success = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading || isLoading;
    const showLoading = loading || isLoading;

    // §221: Minimum 32px touch target at sm, 38px at md, 46px at lg
    const sizeClasses = {
      sm: 'min-h-[32px] px-3 py-1 text-xs gap-1.5 rounded-[var(--radius-md)] min-w-[32px]',
      md: 'min-h-[38px] px-4 py-2 text-sm gap-2 rounded-[var(--radius-lg)] min-w-[38px]',
      lg: 'min-h-[46px] px-5 py-2.5 text-[0.9375rem] gap-2.5 rounded-[var(--radius-lg)] min-w-[46px]',
    };

    // §215: All 8 button states — default, hover, focus, pressed, loading, disabled, success, destructive
    // Uses semantic CSS variables, not hard-coded Tailwind palette classes
    const variantClasses = {
      primary:
        'bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:opacity-90 active:opacity-80 shadow-[var(--shadow-sm)] border border-transparent',
      secondary:
        'bg-[var(--color-surface-hover)] text-[var(--color-text)] hover:bg-[var(--color-surface-pressed)] active:opacity-90 border border-[var(--color-border)]',
      outline:
        'bg-transparent border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-pressed)]',
      ghost:
        'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-pressed)] border border-transparent',
      danger:
        'bg-[var(--color-danger)] text-white hover:opacity-90 active:opacity-80 shadow-[var(--shadow-sm)] border border-transparent',
      spectral:
        'spectral-active text-white font-medium shadow-[var(--shadow-sm)] hover:opacity-95 active:opacity-90 border border-transparent',
    };

    const successClasses = success
      ? 'bg-[var(--color-success)] text-white border-transparent hover:opacity-90'
      : '';

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={showLoading}
        aria-disabled={isDisabled}
        className={cn(
          // Base
          'inline-flex items-center justify-center font-medium transition-all select-none',
          'outline-none focus-visible:shadow-[var(--focus-ring)] focus-visible:rounded-[var(--radius-md)]',
          'disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
          sizeClasses[size],
          success ? successClasses : variantClasses[variant],
          className,
        )}
        {...props}
      >
        {showLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
            {children && <span className="opacity-70">{children}</span>}
          </>
        ) : success ? (
          <>
            <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
            {children && <span>{children}</span>}
          </>
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0" aria-hidden="true">{leftIcon}</span>}
            {children !== undefined && <span>{children}</span>}
            {rightIcon && <span className="inline-flex shrink-0" aria-hidden="true">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
