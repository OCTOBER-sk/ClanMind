import React, { forwardRef } from 'react';
import { cn } from '../utils';
import { Loader2, Check } from 'lucide-react';

// §12.1 M3 variants + full compat alias map for features (ghost 64, primary 42, outline 22, text 15, neutral 12, danger 12, spectral 8, success/warning/secondary/info/circular)
type M3Variant = 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated' | 'destructive' | 'spectral';
type CompatVariant = M3Variant | 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'neutral' | 'success' | 'warning' | 'info' | 'circular';

const aliasMap: Record<string, M3Variant> = {
  // new
  filled: 'filled',
  tonal: 'tonal',
  outlined: 'outlined',
  text: 'text',
  elevated: 'elevated',
  destructive: 'destructive',
  spectral: 'spectral',
  // compat
  primary: 'filled',
  secondary: 'tonal',
  outline: 'outlined',
  ghost: 'text',
  danger: 'destructive',
  neutral: 'tonal',
  success: 'tonal',
  warning: 'tonal',
  info: 'tonal',
  circular: 'filled',
};

function normalize(v: string): M3Variant {
  return aliasMap[v] ?? 'tonal';
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CompatVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  /** @deprecated use loading */
  isLoading?: boolean;
  success?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'tonal',
      size = 'md',
      loading = false,
      isLoading = false,
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
    const v = normalize(variant as string);

    // §9 density heights via spacing tokens (32/40/48) + §7 corner-full pill + §6 label type
    const sizeClasses = {
      sm: 'h-8 min-h-8 px-3 py-1 text-xs gap-1.5 rounded-full min-w-8',
      md: 'h-10 min-h-10 px-4 py-2 text-sm gap-2 rounded-full min-w-10',
      lg: 'h-12 min-h-12 px-6 py-2.5 text-sm gap-2.5 rounded-full min-w-12',
    };

    // Shared state-layer scaffold — §4.4 via color-mix overlay pseudo-element, §8 durations
    const baseState =
      'relative isolate overflow-hidden transition-colors duration-micro ease-emphasized before:absolute before:inset-0 before:rounded-full before:opacity-0 before:transition-opacity before:duration-micro before:pointer-events-none';

    // §4.4 state-layer per variant uses content color at 8%/10%; disabled 38%/12%
    const variantClasses: Record<M3Variant, string> = {
      filled:
        cn(
          'bg-primary text-on-primary border border-transparent shadow-none',
          'hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-on-primary)_8%,transparent)]',
          'active:before:opacity-100 active:before:bg-[color-mix(in_srgb,var(--md-on-primary)_10%,transparent)]',
          'focus-visible:before:opacity-100 focus-visible:before:bg-[color-mix(in_srgb,var(--md-on-primary)_10%,transparent)]',
          'disabled:bg-[color-mix(in_srgb,var(--md-primary)_12%,transparent)] disabled:text-on-surface/40 disabled:shadow-none',
        ),
      tonal:
        cn(
          'bg-secondary-container text-on-secondary-container border border-transparent',
          'hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-on-secondary-container)_8%,transparent)]',
          'active:before:opacity-100 active:before:bg-[color-mix(in_srgb,var(--md-on-secondary-container)_10%,transparent)]',
          'focus-visible:before:opacity-100 focus-visible:before:bg-[color-mix(in_srgb,var(--md-on-secondary-container)_10%,transparent)]',
          'disabled:bg-[color-mix(in_srgb,var(--md-secondary-container)_12%,transparent)] disabled:text-on-surface/40',
        ),
      outlined:
        cn(
          'bg-transparent border border-outline text-primary',
          'hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-primary)_8%,transparent)]',
          'active:before:opacity-100 active:before:bg-[color-mix(in_srgb,var(--md-primary)_10%,transparent)]',
          'focus-visible:before:opacity-100 focus-visible:before:bg-[color-mix(in_srgb,var(--md-primary)_10%,transparent)]',
          'disabled:border-[color-mix(in_srgb,var(--md-outline)_12%,transparent)] disabled:text-on-surface/40',
        ),
      text:
        cn(
          'bg-transparent border border-transparent text-primary',
          'hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-primary)_8%,transparent)]',
          'active:before:opacity-100 active:before:bg-[color-mix(in_srgb,var(--md-primary)_10%,transparent)]',
          'focus-visible:before:opacity-100 focus-visible:before:bg-[color-mix(in_srgb,var(--md-primary)_10%,transparent)]',
          'disabled:text-on-surface/40',
        ),
      elevated:
        cn(
          'bg-surface-container-low text-primary border border-transparent shadow-1',
          'hover:shadow-2 hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-primary)_8%,transparent)]',
          'active:shadow-1 active:before:opacity-100 active:before:bg-[color-mix(in_srgb,var(--md-primary)_10%,transparent)]',
          'focus-visible:before:opacity-100 focus-visible:before:bg-[color-mix(in_srgb,var(--md-primary)_10%,transparent)]',
          'disabled:bg-[color-mix(in_srgb,var(--md-surface-container-low)_12%,transparent)] disabled:text-on-surface/40 disabled:shadow-none',
        ),
      destructive:
        cn(
          'bg-error text-on-error border border-transparent shadow-none',
          'hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-on-error)_8%,transparent)]',
          'active:before:opacity-100 active:before:bg-[color-mix(in_srgb,var(--md-on-error)_10%,transparent)]',
          'focus-visible:before:opacity-100 focus-visible:before:bg-[color-mix(in_srgb,var(--md-on-error)_10%,transparent)]',
          'disabled:bg-[color-mix(in_srgb,var(--md-error)_12%,transparent)] disabled:text-on-surface/40',
        ),
      spectral:
        cn(
          'spectral-active text-white border border-transparent shadow-1',
          'hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,white_8%,transparent)]',
          'active:before:opacity-100 active:before:bg-[color-mix(in_srgb,white_10%,transparent)]',
          'focus-visible:before:opacity-100 focus-visible:before:bg-[color-mix(in_srgb,white_10%,transparent)]',
          'disabled:opacity-40',
        ),
    };

    const successClasses = success
      ? 'bg-success text-on-success border-transparent hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-on-success)_8%,transparent)]'
      : '';

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={showLoading}
        aria-disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-medium select-none outline-none',
          'focus-visible:shadow-[var(--md-focus-ring)] focus-visible:outline-none',
          'disabled:pointer-events-none cursor-pointer shrink-0',
          // ensure state layer behind content
          baseState,
          sizeClasses[size],
          success ? successClasses : variantClasses[v],
          className,
        )}
        {...props}
      >
        {/* content above state layer */}
        <span className="relative z-10 inline-flex items-center justify-center gap-inherit">
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
              {leftIcon && (
                <span className="inline-flex shrink-0" aria-hidden="true">
                  {leftIcon}
                </span>
              )}
              {children !== undefined && <span>{children}</span>}
              {rightIcon && (
                <span className="inline-flex shrink-0" aria-hidden="true">
                  {rightIcon}
                </span>
              )}
            </>
          )}
        </span>
      </button>
    );
  },
);

Button.displayName = 'Button';
