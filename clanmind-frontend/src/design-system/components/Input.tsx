import React, { forwardRef } from 'react';
import { cn } from '../utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// §216 input states: default / focused / filled / invalid / valid / disabled / read-only / loading
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftIcon, rightIcon, disabled, ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            className={cn(
              'w-full min-h-[38px] px-3.5 py-2 text-sm bg-[var(--color-surface-raised)] border rounded-lg transition-colors placeholder:text-[var(--color-text-tertiary)] text-[var(--color-text)] outline-none select-text',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              error
                ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]'
                : 'border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:shadow-[var(--focus-ring)]',
              disabled && 'opacity-50 cursor-not-allowed bg-[var(--color-surface-hover)]',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center text-[var(--color-text-tertiary)]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';