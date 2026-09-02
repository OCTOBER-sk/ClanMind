import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../utils';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 300,
}: TooltipProps) {
  if (!content) return <>{children}</>;

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={4}
            className={cn(
              // §12.1 Tooltip: inverse-surface bg, inverse-on-surface text, corner-xs (rounded-xs), body-small
              'z-50 overflow-hidden rounded-xs bg-inverse-surface px-2.5 py-1 text-xs leading-none text-inverse-on-surface shadow-2',
              'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
              'max-w-xs select-none pointer-events-none',
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-inverse-surface" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
