import React, { forwardRef, useId } from 'react';
import { cn } from '../utils';

type M3Variant = 'outlined' | 'filled';
type CompatVariant = M3Variant | 'search' | 'default';

const aliasMap: Record<string, M3Variant> = {
  outlined: 'outlined',
  filled: 'filled',
  search: 'filled',
  default: 'outlined',
};

function normalize(v: string): M3Variant {
  return aliasMap[v] ?? 'outlined';
}

type InputSize = 'sm' | 'md' | 'lg';
type CompatSize = InputSize | 'small' | 'medium' | 'large' | 'default';

const sizeAlias: Record<string, InputSize> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  small: 'sm',
  medium: 'md',
  large: 'lg',
  default: 'md',
};

function normalizeSize(s: string): InputSize {
  return sizeAlias[s] ?? 'md';
}

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  error?: string;
  helperText?: string;
  label?: React.ReactNode;
  variant?: CompatVariant;
  size?: CompatSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// §12.1 Input — M3 outlined text field: label floats to notched position on focus/fill,
// focus = primary border 2px, invalid = error + helper text, corner-extra-small (rounded-xs).
// Filled variant for search uses surface-container-high.

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      error,
      helperText,
      label,
      variant = 'outlined',
      size = 'md',
      leftIcon,
      rightIcon,
      disabled,
      id,
      placeholder,
      required,
      readOnly,
      ...props
    },
    ref,
  ) => {
    const v = normalize(variant as string);
    const s = normalizeSize(size as string);
    const autoId = useId();
    const inputId = id ?? (label ? autoId : undefined);
    const hasLabel = !!label;
    const hasError = !!error;
    const desc = error ?? helperText;
    const helperId = desc ? `${inputId ?? autoId}-helper` : undefined;

    const sizeClasses: Record<InputSize, string> = {
      sm: 'h-8 min-h-8 text-xs',
      md: 'h-10 min-h-10 text-sm',
      lg: 'h-12 min-h-12 text-sm',
    };

    // Outlined: transparent bg, 1px outline border, focus 2px primary. Filled: surface-container-high.
    const variantClasses: Record<M3Variant, string> = {
      outlined: cn(
        'bg-transparent border',
        hasError
          ? 'border-error text-error focus:border-error focus:border-2 placeholder:text-error/60'
          : 'border-outline text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:border-2',
      ),
      filled: cn(
        'border',
        hasError
          ? 'bg-error-container/40 border-error text-error focus:border-error focus:border-b-2 focus:border-x-error focus:border-t-error placeholder:text-error/60'
          : 'bg-surface-container-high border-transparent text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:border-b-2 focus:bg-surface-container',
      ),
    };



    return (
      <div className="w-full">
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div
              className={cn(
                'absolute left-3 flex items-center pointer-events-none shrink-0',
                hasError ? 'text-error' : 'text-on-surface-variant',
              )}
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={helperId}
            placeholder={hasLabel ? ' ' : placeholder}
            className={cn(
              'peer w-full rounded-xs outline-none select-text transition-colors duration-micro ease-emphasized',
              'focus-visible:shadow-[var(--md-focus-ring)]',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:border-[color-mix(in_srgb,var(--md-outline)_12%,transparent)]',
              'read-only:bg-surface-container read-only:border-outline-variant read-only:cursor-default',
              sizeClasses[s],
              variantClasses[v],
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              !leftIcon && !hasLabel && 'pl-3.5',
              // when floating label present, ensure text doesn't overlap label
              hasLabel && (leftIcon ? 'pl-9 placeholder-transparent' : 'pl-3.5 placeholder-transparent'),
              hasError ? 'placeholder:text-error/60' : '',
              className,
            )}
            {...props}
          />

          {hasLabel && (
            <label
              htmlFor={inputId}
              className={cn(
                'absolute left-3.5 px-1 pointer-events-none select-none transition-all duration-micro ease-emphasized origin-left',
                'bg-surface peer-[.bg-surface-container-high]:bg-surface-container-high peer-focus:bg-surface peer-focus:peer-[.bg-surface-container-high]:bg-surface-container',
                // default floating position when placeholder not shown or focused or filled
                'peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-on-surface-variant',
                'peer-focus:-top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:px-1',
                'peer-[&:not(:placeholder-shown)]:-top-2 peer-[&:not(:placeholder-shown)]:translate-y-0 peer-[&:not(:placeholder-shown)]:text-xs',
                leftIcon && 'left-9 peer-focus:left-3.5 peer-[&:not(:placeholder-shown)]:left-3.5 peer-placeholder-shown:left-9',
                hasError
                  ? 'text-error peer-focus:text-error'
                  : 'text-on-surface-variant peer-focus:text-primary',
                disabled && 'opacity-40',
                // background cutout for notched outline
                'peer-focus:bg-surface',
              )}
            >
              {label}
              {required && <span className="ml-0.5 text-error" aria-hidden="true">*</span>}
            </label>
          )}

          {rightIcon && (
            <div
              className={cn(
                'absolute right-3 flex items-center shrink-0',
                hasError ? 'text-error' : 'text-on-surface-variant',
              )}
              aria-hidden="true"
            >
              {rightIcon}
            </div>
          )}
        </div>
        {desc && (
          <p
            id={helperId}
            role={hasError ? 'alert' : undefined}
            className={cn('mt-1.5 text-xs leading-none px-1', hasError ? 'text-error' : 'text-on-surface-variant')}
          >
            {desc}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
