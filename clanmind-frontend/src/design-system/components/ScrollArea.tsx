import React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '../utils';

export interface ScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  children: React.ReactNode;
  className?: string;
}

export function ScrollArea({ children, className, ...props }: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className="flex touch-none select-none transition-colors p-0.5 bg-transparent hover:bg-[var(--color-surface-hover)] w-2"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-[var(--color-border-strong)]" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Scrollbar
        orientation="horizontal"
        className="flex touch-none select-none transition-colors p-0.5 bg-transparent hover:bg-[var(--color-surface-hover)] h-2"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-[var(--color-border-strong)]" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}