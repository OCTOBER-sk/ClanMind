import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../utils';

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  label?: React.ReactNode;
  id?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'outlined' | 'filled';
}

/**
 * §12.1 Select — M3 menu: surface-container-high, shadow-2, corner-xs container,
 * 40px items with leading icon slot + trailing check, state-layer rows, selected = secondary-container.
 * Trigger is M3 outlined text field (border-outline, focus primary 2px, corner-xs).
 */
export function Select({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  error,
  helperText,
  label,
  id,
  className,
  size = 'md',
  variant = 'outlined',
}: SelectProps) {
  const hasError = !!error;
  const desc = error ?? helperText;

  const sizeClasses = {
    sm: 'h-8 min-h-8 text-xs',
    md: 'h-10 min-h-10 text-sm',
    lg: 'h-12 min-h-12 text-sm',
  };

  const triggerVariant = variant === 'filled'
    ? cn('bg-surface-container-high border-transparent', hasError ? 'border-error text-error' : 'text-on-surface')
    : cn('bg-transparent border', hasError ? 'border-error text-error' : 'border-outline text-on-surface');

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className={cn('block mb-1.5 text-xs font-medium px-1', hasError ? 'text-error' : 'text-on-surface-variant')}>
          {label}
        </label>
      )}
      <SelectPrimitive.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          id={id}
          aria-invalid={hasError ? true : undefined}
          className={cn(
            'inline-flex items-center justify-between w-full px-3.5 gap-2 rounded-xs outline-none cursor-pointer select-none transition-colors duration-micro ease-emphasized',
            'focus-visible:shadow-[var(--md-focus-ring)] focus:border-primary focus:border-2',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:border-[color-mix(in_srgb,var(--md-outline)_12%,transparent)]',
            sizeClasses[size as keyof typeof sizeClasses],
            triggerVariant,
            hasError ? 'border-error focus:border-error' : 'focus:border-primary',
            className,
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} className="placeholder:text-on-surface-variant/60" />
          <SelectPrimitive.Icon>
            <ChevronDown className={cn('w-4 h-4 shrink-0', hasError ? 'text-error' : 'text-on-surface-variant')} aria-hidden="true" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className={cn(
              'z-50 min-w-[180px] overflow-hidden rounded-xs border border-outline-variant bg-surface-container-high shadow-2 p-1',
              'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            )}
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((opt) => (
                <SelectPrimitive.Item
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className={cn(
                    'relative flex items-center gap-2 h-10 min-h-10 px-3 text-sm cursor-pointer select-none outline-none rounded-xs transition-colors',
                    'text-on-surface-variant focus:text-on-surface',
                    'focus:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)]',
                    'data-[state=checked]:bg-secondary-container data-[state=checked]:text-on-secondary-container',
                    'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                    'focus-visible:shadow-[var(--md-focus-ring)]',
                  )}
                >
                  <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="ml-auto inline-flex">
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>

        {desc && (
          <p className={cn('mt-1.5 text-xs leading-none px-1', hasError ? 'text-error' : 'text-on-surface-variant')} role={hasError ? 'alert' : undefined}>
            {desc}
          </p>
        )}
      </SelectPrimitive.Root>
    </div>
  );
}
