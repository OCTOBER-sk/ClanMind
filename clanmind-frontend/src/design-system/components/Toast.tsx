import React, { createContext, useContext, useCallback, useMemo, useRef } from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cn } from '../utils';

// ─── Toast types ───

export type ToastVariant = 'success' | 'error' | 'info' | 'warning' | 'default';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((opts: ToastOptions) => {
    const id = `toast_${++idRef.current}`;
    setToasts((prev) => [...prev, { ...opts, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const contextValue = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={contextValue}>
      <RadixToast.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastItem key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
        <RadixToast.Viewport
          className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 outline-none max-w-sm w-full"
          aria-label="Notifications"
        />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

// §12.1 Toast/Snackbar — M3: inverse-surface bg, inverse-on-surface text, single line + optional action, corner-xs (rounded-xs), shadow-3.

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { variant = 'default', title, description, duration = 4000, action } = item;

  // variant only affects optional icon/action tint; background stays inverse-surface per M3.
  const actionColor =
    variant === 'error'
      ? 'text-inverse-primary'
      : variant === 'success'
        ? 'text-inverse-primary'
        : 'text-inverse-primary';

  return (
    <RadixToast.Root
      duration={duration === 0 ? Infinity : duration}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-center gap-3 rounded-xs bg-inverse-surface text-inverse-on-surface shadow-3 px-4 py-3',
        'data-[state=open]:animate-[toast-slide-in_200ms_ease-out] data-[state=closed]:animate-[toast-slide-out_150ms_ease-in]',
        'min-h-12 max-w-sm',
      )}
    >
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <RadixToast.Title className="text-sm font-medium leading-none truncate">
            {title}
          </RadixToast.Title>
          {description && (
            <RadixToast.Description className="text-xs text-inverse-on-surface/80 mt-0.5 truncate">
              {description}
            </RadixToast.Description>
          )}
        </div>
      </div>

      {action && (
        <RadixToast.Action asChild altText={action.label}>
          <button
            onClick={action.onClick}
            className={cn(
              'shrink-0 text-xs font-medium uppercase tracking-wide hover:underline cursor-pointer focus-visible:shadow-[var(--md-focus-ring)] rounded-xs px-2 py-1',
              actionColor,
            )}
          >
            {action.label}
          </button>
        </RadixToast.Action>
      )}

      <RadixToast.Close asChild>
        <button
          aria-label="Dismiss notification"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-full hover:bg-[color-mix(in_srgb,var(--md-inverse-on-surface)_10%,transparent)] text-inverse-on-surface/70 hover:text-inverse-on-surface cursor-pointer focus-visible:shadow-[var(--md-focus-ring)]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </RadixToast.Close>
    </RadixToast.Root>
  );
}
