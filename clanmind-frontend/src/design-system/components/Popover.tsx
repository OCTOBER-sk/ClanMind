import React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '../utils';

export interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

// §12.1 Popover — M3: surface-container-high, corner-xs, shadow-2, border outline-variant.

export function Popover({ trigger, children, open, onOpenChange, align = 'center', side = 'bottom', className }: PopoverProps) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 rounded-xs border border-outline-variant bg-surface-container-high p-3 shadow-2 outline-none',
            'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'focus-visible:shadow-[var(--md-focus-ring)]',
            className,
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
