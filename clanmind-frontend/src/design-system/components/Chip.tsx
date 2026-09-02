import React from 'react';
import { cn } from '../utils';
import { Check, X } from 'lucide-react';

type M3Variant = 'filter' | 'input' | 'assist' | 'suggestion';
type CompatVariant = M3Variant | 'neutral' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'warning' | 'info' | 'danger' | 'spectral' | 'tonal' | 'filled' | 'text' | 'circular';

const aliasMap: Record<string, M3Variant> = {
  filter: 'filter',
  input: 'input',
  assist: 'assist',
  suggestion: 'suggestion',
  neutral: 'filter',
  primary: 'assist',
  secondary: 'filter',
  outline: 'filter',
  ghost: 'filter',
  success: 'filter',
  warning: 'filter',
  info: 'filter',
  danger: 'filter',
  spectral: 'assist',
  tonal: 'filter',
  filled: 'assist',
  text: 'filter',
  circular: 'filter',
};

function normalize(v: string): M3Variant {
  return aliasMap[v] ?? 'filter';
}

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CompatVariant;
  selected?: boolean;
  disabled?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export function Chip({
  className,
  variant = 'filter',
  selected = false,
  disabled = false,
  leadingIcon,
  trailingIcon,
  onRemove,
  size = 'md',
  children,
  ...props
}: ChipProps) {
  const v = normalize(variant as string);

  // §9 Chip 32px height, §7 corner-small (8px -> rounded-sm)
  const sizeClasses = {
    sm: 'h-7 px-2.5 text-xs gap-1',
    md: 'h-8 px-3 text-xs gap-1.5',
  };

  const base =
    'inline-flex items-center justify-center font-medium select-none rounded-sm border transition-colors duration-micro ease-emphasized outline-none focus-visible:shadow-[var(--md-focus-ring)] disabled:pointer-events-none disabled:opacity-40 cursor-pointer relative isolate overflow-hidden before:absolute before:inset-0 before:rounded-sm before:opacity-0 before:transition-opacity before:duration-micro before:pointer-events-none';

  // Selected = secondary-container fill with leading check; unselected = outline border (§12.1)
  const variantClasses: Record<M3Variant, string> = {
    filter: selected
      ? 'bg-secondary-container text-on-secondary-container border-transparent hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-on-secondary-container)_8%,transparent)]'
      : 'bg-transparent border-outline text-on-surface-variant hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-on-surface-variant)_8%,transparent)]',
    input: selected
      ? 'bg-secondary-container text-on-secondary-container border-transparent'
      : 'bg-surface-container-low border-outline-variant text-on-surface-variant',
    assist:
      'bg-surface-container-high text-on-surface border border-transparent hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)]',
    suggestion:
      'bg-surface-container text-on-surface-variant border border-outline-variant hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-on-surface-variant)_8%,transparent)]',
  };

  // Compat: success/warning/info/danger/spectral override when original compat name was those — show tonal containers
  const compatColorOverride: Record<string, string> = {
    success: 'bg-success-container text-on-success-container border-transparent',
    warning: 'bg-warning-container text-on-warning-container border-transparent',
    info: 'bg-tertiary-container text-on-tertiary-container border-transparent',
    danger: 'bg-error-container text-on-error-container border-transparent',
    spectral: 'spectral-active text-white border-transparent',
  };
  const raw = variant as string;
  const compatOverride = !selected && (compatColorOverride[raw] ?? '');

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={v === 'filter' ? selected : undefined}
      className={cn(base, sizeClasses[size], compatOverride || variantClasses[v], className)}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-1.5">
        {selected && v === 'filter' ? (
          <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        ) : leadingIcon ? (
          <span className="inline-flex shrink-0" aria-hidden="true">
            {leadingIcon}
          </span>
        ) : null}
        {children && <span>{children}</span>}
        {trailingIcon && !onRemove && (
          <span className="inline-flex shrink-0" aria-hidden="true">
            {trailingIcon}
          </span>
        )}
        {onRemove && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }
            }}
            className="inline-flex shrink-0 rounded-full p-0.5 hover:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)]"
          >
            <X className="w-3 h-3" aria-hidden="true" />
          </span>
        )}
      </span>
    </button>
  );
}
