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
  id?: string;
  className?: string;
}

/**
 * §15 / §216: Accessible select primitive.
 * Built on Radix Select — keyboard navigable, screen-reader announced,
 * focus-trapped in the popover dropdown.
 */
export function Select({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  error,
  id,
  className,
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        className={cn(
          'inline-flex items-center justify-between w-full min-h-[38px] px-3.5 py-2 text-sm gap-2',
          'bg-[var(--color-surface-raised)] border rounded-[var(--radius-md)] transition-colors',
          'outline-none cursor-pointer select-none',
          'placeholder:text-[var(--color-text-tertiary)]',
          error
            ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]'
            : 'border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:shadow-[var(--focus-ring)]',
          disabled && 'opacity-50 cursor-not-allowed bg-[var(--color-surface-hover)]',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-50 min-w-[180px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]',
            'bg-[var(--color-surface-elevated)] p-1 shadow-[var(--shadow-lg)]',
            'animate-in fade-in-80 zoom-in-95',
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className={cn(
                  'relative flex items-center rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm cursor-pointer select-none outline-none transition-colors',
                  'text-[var(--color-text-secondary)]',
                  'focus:bg-[var(--color-surface-hover)] focus:text-[var(--color-text)]',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                  'data-[highlighted]:bg-[var(--color-surface-hover)] data-[highlighted]:text-[var(--color-text)]',
                )}
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="ml-auto">
                  <Check className="w-3.5 h-3.5 text-[var(--color-text)]" aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>

      {error && (
        <p className="mt-1 text-xs text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
    </SelectPrimitive.Root>
  );
}
