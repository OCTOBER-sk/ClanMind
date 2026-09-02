import React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '../utils';

export interface ScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  children: React.ReactNode;
  className?: string;
}

// §12.1 ScrollArea — M3: thin thumb outline-variant → outline on hover, track transparent.

export function ScrollArea({ children, className, ...props }: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root className={cn('relative overflow-hidden', className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] focus-visible:shadow-[var(--md-focus-ring)] outline-none">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className="flex touch-none select-none transition-colors p-0.5 bg-transparent w-2 hover:w-2"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-outline-variant hover:bg-outline transition-colors duration-micro" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Scrollbar
        orientation="horizontal"
        className="flex touch-none select-none transition-colors p-0.5 bg-transparent h-2 hover:h-2"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-outline-variant hover:bg-outline transition-colors duration-micro" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner className="bg-transparent" />
    </ScrollAreaPrimitive.Root>
  );
}
