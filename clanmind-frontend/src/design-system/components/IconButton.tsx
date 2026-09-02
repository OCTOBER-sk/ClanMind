import React, { forwardRef } from 'react';
import { cn } from '../utils';
import { Loader2 } from 'lucide-react';

type M3Variant = 'standard' | 'filled' | 'tonal' | 'outlined';
type CompatVariant = M3Variant | 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'destructive' | 'text' | 'neutral' | 'spectral';

const aliasMap: Record<string, M3Variant> = {
  standard: 'standard',
  filled: 'filled',
  tonal: 'tonal',
  outlined: 'outlined',
  // compat
  primary: 'filled',
  secondary: 'tonal',
  ghost: 'standard',
  outline: 'outlined',
  danger: 'standard',
  destructive: 'standard',
  text: 'standard',
  neutral: 'standard',
  spectral: 'filled',
};

function normalize(v: string): M3Variant {
  return aliasMap[v] ?? 'standard';
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: CompatVariant;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = 'standard',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const v = normalize(variant as string);

    // §9 IconButton 40px hit area; visual glyph 20-24 padded to 40. xs keeps 24 floor, md is canonical 40.
    const sizeClasses = {
      xs: 'w-6 h-6 min-w-6 min-h-6 p-1 rounded-full',
      sm: 'w-8 h-8 min-w-8 min-h-8 p-1.5 rounded-full',
      md: 'w-10 h-10 min-w-10 min-h-10 p-2 rounded-full',
      lg: 'w-12 h-12 min-w-12 min-h-12 p-3 rounded-full',
    };

    const baseState =
      'relative isolate overflow-hidden transition-colors duration-micro ease-emphasized before:absolute before:inset-0 before:rounded-full before:opacity-0 before:transition-opacity before:duration-micro before:pointer-events-none';

    const variantClasses: Record<M3Variant, string> = {
      standard: cn(
        'bg-transparent text-on-surface-variant border border-transparent',
        'hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-on-surface-variant)_8%,transparent)]',
        'active:before:opacity-100 active:before:bg-[color-mix(in_srgb,var(--md-on-surface-variant)_10%,transparent)]',
        'focus-visible:before:opacity-100 focus-visible:before:bg-[color-mix(in_srgb,var(--md-on-surface-variant)_10%,transparent)]',
        'disabled:text-on-surface/40',
      ),
      filled: cn(
        'bg-primary text-on-primary border border-transparent',
        'hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-on-primary)_8%,transparent)]',
        'active:before:opacity-100 active:before:bg-[color-mix(in_srgb,var(--md-on-primary)_10%,transparent)]',
        'focus-visible:before:opacity-100 focus-visible:before:bg-[color-mix(in_srgb,var(--md-on-primary)_10%,transparent)]',
        'disabled:bg-[color-mix(in_srgb,var(--md-primary)_12%,transparent)] disabled:text-on-surface/40',
      ),
      tonal: cn(
        'bg-secondary-container text-on-secondary-container border border-transparent',
        'hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-on-secondary-container)_8%,transparent)]',
        'active:before:opacity-100 active:before:bg-[color-mix(in_srgb,var(--md-on-secondary-container)_10%,transparent)]',
        'focus-visible:before:opacity-100 focus-visible:before:bg-[color-mix(in_srgb,var(--md-on-secondary-container)_10%,transparent)]',
        'disabled:bg-[color-mix(in_srgb,var(--md-secondary-container)_12%,transparent)] disabled:text-on-surface/40',
      ),
      outlined: cn(
        'bg-transparent border border-outline text-on-surface-variant',
        'hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-on-surface-variant)_8%,transparent)]',
        'active:before:opacity-100 active:before:bg-[color-mix(in_srgb,var(--md-on-surface-variant)_10%,transparent)]',
        'focus-visible:before:opacity-100 focus-visible:before:bg-[color-mix(in_srgb,var(--md-on-surface-variant)_10%,transparent)]',
        'disabled:border-[color-mix(in_srgb,var(--md-outline)_12%,transparent)] disabled:text-on-surface/40',
      ),
    };

    // danger compat handled via extra class when original was danger/destructive — use error tint
    const isDangerCompat = (variant as string) === 'danger' || (variant as string) === 'destructive';
    const dangerOverride = isDangerCompat
      ? 'text-error hover:before:bg-[color-mix(in_srgb,var(--md-error)_8%,transparent)] active:before:bg-[color-mix(in_srgb,var(--md-error)_10%,transparent)]'
      : '';

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center select-none outline-none cursor-pointer shrink-0',
          'focus-visible:shadow-[var(--md-focus-ring)] focus-visible:outline-none disabled:pointer-events-none',
          baseState,
          sizeClasses[size],
          variantClasses[v],
          dangerOverride,
          className,
        )}
        {...props}
      >
        <span className="relative z-10 inline-flex items-center justify-center">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : children}
        </span>
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
