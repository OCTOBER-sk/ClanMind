/**
 * Sheet — accessible slide-over panel (FE §30/§66/§8).
 * M3: corner-large leading edges, slide 360ms decel-in/accel-out, scrim 60%, surface-container-high.
 */
import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../utils';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: 'right' | 'left';
  title: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  className?: string;
}

const sideClasses: Record<'right' | 'left', string> = {
  right: 'right-0 top-0 h-full w-full max-w-[520px] border-l rounded-l-lg',
  left: 'left-0 top-0 h-full w-72 border-r rounded-r-lg',
};

export function Sheet({ open, onOpenChange, side = 'right', title, children, showCloseButton = true, className }: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim/60 backdrop-blur-[1px] sheet-overlay" />
        <DialogPrimitive.Content
          aria-label={title}
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden border-outline-variant bg-surface-container-high shadow-5 outline-none focus-visible:shadow-[var(--md-focus-ring)]',
            side === 'right' ? 'sheet-panel-right' : 'sheet-panel-left',
            sideClasses[side],
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              aria-label={`Close ${title}`}
              className="absolute right-3 top-3 z-10 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] hover:text-on-surface focus:outline-none focus-visible:shadow-[var(--md-focus-ring)] cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
