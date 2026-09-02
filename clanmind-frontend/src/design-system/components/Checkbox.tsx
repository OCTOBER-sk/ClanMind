import React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '../utils';

export interface CheckboxProps {
  checked: boolean | 'indeterminate';
  onCheckedChange: (checked: boolean | 'indeterminate') => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
  required?: boolean;
}

// §12.1 Checkbox — M3 corner-xs (rounded-xs 4px) with primary fill when checked. State layers via color-mix.
// Size 18px per M3, with focus-ring token.

export function Checkbox({ checked, onCheckedChange, disabled, id, className, ...props }: CheckboxProps) {
  const isIndeterminate = checked === 'indeterminate';

  return (
    <CheckboxPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'peer relative inline-flex shrink-0 items-center justify-center rounded-xs border-2 outline-none transition-colors duration-micro ease-emphasized',
        'w-[18px] h-[18px] min-w-[18px] min-h-[18px]',
        'focus-visible:shadow-[var(--md-focus-ring)]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        // unchecked
        'bg-transparent border-outline',
        'hover:border-on-surface hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)]',
        // checked / indeterminate -> primary fill
        'data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-on-primary',
        'data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-on-primary',
        // state layer overlay via before for checked hover? use bg mix already
        'data-[state=checked]:hover:bg-[color-mix(in_srgb,var(--md-primary)_92%,var(--md-on-primary))]',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        {isIndeterminate ? <Minus className="h-3 w-3 stroke-[3]" /> : <Check className="h-3 w-3 stroke-[3]" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
