import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../utils';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showCloseButton?: boolean;
}

// §12.1 Dialog — M3: surface-container-high, corner-large (16px), shadow-5, scrim 60%, scale-in 220ms emphasized.
// Focus trap via Radix, Esc to close, title title-large, actions bottom-right.

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  showCloseButton = true,
}: DialogProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim/60 backdrop-blur-[1px] data-[state=open]:animate-[fade-in_150ms_ease-out] data-[state=closed]:animate-[fade-in_150ms_ease-out_reverse]" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border border-outline-variant bg-surface-container-high p-6 shadow-5 rounded-lg outline-none',
            'data-[state=open]:animate-[scale-in_220ms_var(--ease-emphasized)] data-[state=closed]:animate-[scale-in_150ms_var(--ease-emphasized-accelerate)_reverse]',
            'focus-visible:shadow-[var(--md-focus-ring)]',
            maxWidthClasses[maxWidth],
          )}
        >
          {(title || description) && (
            <div className="flex flex-col space-y-1.5 text-left">
              {title && (
                <DialogPrimitive.Title className="text-[22px] leading-[28px] font-normal tracking-normal text-on-surface">
                  {title}
                </DialogPrimitive.Title>
              )}
              {description && (
                <DialogPrimitive.Description className="text-sm text-on-surface-variant leading-relaxed">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
          )}

          <div className="py-2 text-sm text-on-surface">{children}</div>

          {footer && <div className="flex justify-end gap-2.5 pt-2">{footer}</div>}

          {showCloseButton && (
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] focus:outline-none focus-visible:shadow-[var(--md-focus-ring)] cursor-pointer">
              <X className="h-4 w-4 text-on-surface-variant" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
