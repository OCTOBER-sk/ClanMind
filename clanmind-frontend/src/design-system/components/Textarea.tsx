import React, { forwardRef, useEffect, useRef, useCallback, useId } from 'react';
import { cn } from '../utils';

type M3Variant = 'outlined' | 'filled';
type CompatVariant = M3Variant | 'default';

const aliasMap: Record<string, M3Variant> = {
  outlined: 'outlined',
  filled: 'filled',
  default: 'outlined',
};

function normalize(v: string): M3Variant {
  return aliasMap[v] ?? 'outlined';
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoGrow?: boolean;
  minHeight?: number;
  maxHeight?: number;
  error?: string;
  helperText?: string;
  label?: React.ReactNode;
  variant?: CompatVariant;
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
      helperText,
      label,
      variant = 'outlined',
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
    const autoId = useId();
    const inputId = id ?? (label ? autoId : undefined);
    const hasLabel = !!label;
    const hasError = !!error;
    const desc = error ?? helperText;
    const helperId = desc ? `${inputId ?? autoId}-helper` : undefined;

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

    const variantClasses: Record<M3Variant, string> = {
      outlined: cn(
        'bg-transparent border',
        hasError
          ? 'border-error focus:border-error focus:border-2 placeholder:text-error/60 text-error'
          : 'border-outline text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:border-2',
      ),
      filled: cn(
        'border',
        hasError
          ? 'bg-error-container/40 border-error text-error focus:border-error focus:border-2 placeholder:text-error/60'
          : 'bg-surface-container-high border-transparent text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:border-2 focus:bg-surface-container',
      ),
    };

    return (
      <div className="w-full">
        <div className="relative w-full">
          <textarea
            ref={(node) => {
              internalRef.current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
            }}
            id={inputId}
            value={value}
            onChange={(e) => {
              onChange?.(e);
              adjustHeight();
            }}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={helperId}
            placeholder={hasLabel ? ' ' : placeholder}
            style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
            className={cn(
              'peer w-full px-3.5 py-3 text-sm rounded-xs outline-none resize-none select-text leading-relaxed transition-colors duration-micro ease-emphasized',
              'focus-visible:shadow-[var(--md-focus-ring)]',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:border-[color-mix(in_srgb,var(--md-outline)_12%,transparent)]',
              'read-only:bg-surface-container read-only:border-outline-variant read-only:cursor-default',
              hasLabel && 'placeholder-transparent pt-5',
              variantClasses[v],
              className,
            )}
            {...props}
          />
          {hasLabel && (
            <label
              htmlFor={inputId}
              className={cn(
                'absolute left-3.5 top-3 px-1 pointer-events-none select-none transition-all duration-micro ease-emphasized origin-left',
                'bg-surface peer-focus:bg-surface',
                'peer-placeholder-shown:top-5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-on-surface-variant',
                'peer-focus:-top-2 peer-focus:text-xs peer-focus:px-1',
                'peer-[&:not(:placeholder-shown)]:-top-2 peer-[&:not(:placeholder-shown)]:text-xs',
                hasError ? 'text-error peer-focus:text-error' : 'text-on-surface-variant peer-focus:text-primary',
                disabled && 'opacity-40',
              )}
            >
              {label}
              {required && <span className="ml-0.5 text-error" aria-hidden="true">*</span>}
            </label>
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

Textarea.displayName = 'Textarea';
