/**
 * Sheet — accessible slide-over panel (FE §30/§66/§8).
 *
 * Used when the viewport cannot afford a docked surface:
 *   - right work surface (thread/artifact/approvals/research/diff) < 1200px
 *   - left navigation off-canvas < 900px (FE §13)
 *
 * Built on Radix Dialog so focus is trapped on open, Escape closes, and
 * focus returns to the trigger (FE §30 "Escape closes and restores focus",
 * FE §66 dialog rules). Motion uses token durations via the sheet-* keyframes
 * in index.css; `prefers-reduced-motion` collapses them to instant state
 * changes (FE §6) while keeping all information.
 */
import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../utils';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which edge the sheet enters from. */
  side?: 'right' | 'left';
  /** Accessible name for the sheet (Radix requires a title). */
  title: string;
  children: React.ReactNode;
  /** Hide the built-in close button when the content provides its own. */
  showCloseButton?: boolean;
  className?: string;
}

const sideClasses: Record<'right' | 'left', string> = {
  right: 'right-0 top-0 h-full w-full max-w-[520px] border-l',
  left: 'left-0 top-0 h-full w-72 border-r',
};

export function Sheet({
  open,
  onOpenChange,
  side = 'right',
  title,
  children,
  showCloseButton = true,
  className,
}: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs sheet-overlay" />
        <DialogPrimitive.Content
          aria-label={title}
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-xl)] outline-none',
            side === 'right' ? 'sheet-panel-right' : 'sheet-panel-left',
            sideClasses[side],
            className,
          )}
        >
          {/* Visually hidden title keeps Radix's a11y contract without forcing
              a visible header onto feature panels that draw their own. */}
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              aria-label={`Close ${title}`}
              className="absolute right-3 top-3 z-10 rounded-md p-2 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] focus:outline-none focus-visible:shadow-[var(--focus-ring)] cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
