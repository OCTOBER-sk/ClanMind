import React, { forwardRef, useEffect, useRef, useCallback } from 'react';
import { cn } from '../utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoGrow?: boolean;
  minHeight?: number;
  maxHeight?: number;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      autoGrow = false,
      minHeight = 44,
      maxHeight = 260,
      value,
      onChange,
      error,
      disabled,
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    const adjustHeight = useCallback(() => {
      const textarea = internalRef.current;
      if (!textarea || !autoGrow) return;

      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [autoGrow, minHeight, maxHeight]);

    useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    return (
      <div className="w-full">
        <textarea
          ref={(node) => {
            internalRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
          }}
          value={value}
          onChange={(e) => {
            onChange?.(e);
            adjustHeight();
          }}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
          className={cn(
            'w-full px-3.5 py-2 text-sm bg-[var(--color-surface-raised)] border rounded-lg transition-colors placeholder:text-[var(--color-text-tertiary)] text-[var(--color-text)] outline-none resize-none select-text leading-relaxed',
            error
              ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]'
              : 'border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:shadow-[var(--focus-ring)]',
            disabled && 'opacity-50 cursor-not-allowed bg-[var(--color-surface-hover)]',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';