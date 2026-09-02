import React, { forwardRef } from 'react';
import { cn } from '../utils';

type FabVariant = 'primary' | 'secondary' | 'tertiary' | 'surface';
type FabSize = 'small' | 'medium' | 'large' | 'extended';

export interface FabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: FabVariant | string;
  size?: FabSize | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

const aliasMap: Record<string, FabVariant> = {
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'tertiary',
  surface: 'surface',
  tonal: 'secondary',
  filled: 'primary',
  neutral: 'surface',
};

function normalizeVariant(v: string): FabVariant {
  return aliasMap[v] ?? 'primary';
}

function normalizeSize(s: string): FabSize {
  if (s === 'sm') return 'small';
  if (s === 'md') return 'medium';
  if (s === 'lg') return 'large';
  return s as FabSize;
}

export const Fab = forwardRef<HTMLButtonElement, FabProps>(
  ({ className, variant = 'primary', size = 'medium', icon, children, ...props }, ref) => {
    const v = normalizeVariant(variant as string);
    const sz = normalizeSize(size as string);

    const sizeClasses: Record<FabSize, string> = {
      small: 'h-10 min-h-10 px-4 gap-2 rounded-xl text-sm',
      medium: 'h-14 min-h-14 px-5 gap-2 rounded-xl text-sm',
      large: 'h-24 w-24 min-h-24 min-w-24 rounded-xl text-base flex-col gap-1',
      extended: 'h-14 min-h-14 px-6 gap-2 rounded-full text-sm',
    };

    const base =
      'inline-flex items-center justify-center font-medium select-none shadow-3 hover:shadow-4 transition-all duration-standard ease-emphasized outline-none focus-visible:shadow-[var(--md-focus-ring)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer relative isolate overflow-hidden before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-micro before:pointer-events-none';

    const variantClasses: Record<FabVariant, string> = {
      primary:
        'bg-primary-container text-on-primary-container before:bg-[color-mix(in_srgb,var(--md-on-primary-container)_8%,transparent)] hover:before:opacity-100 active:before:opacity-100 active:before:bg-[color-mix(in_srgb,var(--md-on-primary-container)_10%,transparent)]',
      secondary:
        'bg-secondary-container text-on-secondary-container before:bg-[color-mix(in_srgb,var(--md-on-secondary-container)_8%,transparent)] hover:before:opacity-100 active:before:opacity-100 active:before:bg-[color-mix(in_srgb,var(--md-on-secondary-container)_10%,transparent)]',
      tertiary:
        'bg-tertiary-container text-on-tertiary-container before:bg-[color-mix(in_srgb,var(--md-on-tertiary-container)_8%,transparent)] hover:before:opacity-100 active:before:opacity-100 active:before:bg-[color-mix(in_srgb,var(--md-on-tertiary-container)_10%,transparent)]',
      surface:
        'bg-surface-container-high text-primary border border-outline-variant shadow-2 before:bg-[color-mix(in_srgb,var(--md-primary)_8%,transparent)] hover:before:opacity-100',
    };

    const roundedOverride = sz === 'extended' ? 'rounded-full before:rounded-full' : 'rounded-xl before:rounded-xl';

    return (
      <button
        ref={ref}
        className={cn(base, roundedOverride, sizeClasses[sz], variantClasses[v], className)}
        {...props}
      >
        <span className="relative z-10 inline-flex items-center justify-center gap-2">
          {icon && <span className="inline-flex shrink-0 [&_svg]:w-6 [&_svg]:h-6" aria-hidden="true">{icon}</span>}
          {children && <span>{children}</span>}
        </span>
      </button>
    );
  },
);

Fab.displayName = 'Fab';

// Extended FAB alias for consumers expecting <ExtendedFab>
export const ExtendedFab = Fab;
