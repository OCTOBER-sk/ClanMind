import React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { Check } from 'lucide-react';
import { cn } from '../utils';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  withCheck?: boolean;
  'aria-label'?: string;
}

// §12.1 Switch — M3 track+handle, handle grows when on (16→24→28), optional check icon.
// Track 52x32, rounded-full, primary when on, surface-variant+outline when off. Focus-ring token.

export function Switch({ checked, onCheckedChange, disabled, id, className, withCheck = false, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors duration-micro ease-emphasized outline-none',
        'h-8 w-[52px] min-h-8 min-w-[52px] p-0.5',
        'focus-visible:shadow-[var(--md-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40',
        // on / off track colors §4 roles
        'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
        'data-[state=unchecked]:bg-surface-variant data-[state=unchecked]:border-outline',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none flex items-center justify-center rounded-full shadow-1 transition-all duration-micro ease-emphasized bg-white',
          // handle colors per state
          'data-[state=unchecked]:bg-on-surface-variant data-[state=checked]:bg-on-primary',
          // size and position — grows when on
          'h-4 w-4 data-[state=checked]:h-6 data-[state=checked]:w-6',
          'data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-6',
          // when withCheck, keep icon visible; handle size remains 24, but check icon centered
        )}
      >
        {withCheck && checked && <Check className="h-3 w-3 text-primary stroke-[3]" aria-hidden="true" />}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}
