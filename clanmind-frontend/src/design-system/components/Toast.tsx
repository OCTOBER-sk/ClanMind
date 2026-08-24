import React, { createContext, useContext, useCallback, useRef } from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import { X, Check, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { cn } from '../utils';

// ─── Toast types ───

export type ToastVariant = 'success' | 'error' | 'info' | 'warning' | 'default';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss duration in ms. Default 3000. Use 0 to disable. */
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastItem extends ToastOptions {
  id: string;
}

// ─── Context ───

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

// ─── Provider ───

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

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      <RadixToast.Provider swipeDirection="right">
        {children}

        {/* Toast list — positioned bottom-right, matches spec §65 */}
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

// ─── Individual toast item ───

const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; className: string }
> = {
  success: {
    icon: <Check className="w-4 h-4 text-[var(--color-success)]" />,
    className: 'border-l-4 border-l-[var(--color-success)]',
  },
  error: {
    icon: <AlertCircle className="w-4 h-4 text-[var(--color-danger)]" />,
    className: 'border-l-4 border-l-[var(--color-danger)]',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 text-[var(--color-warning)]" />,
    className: 'border-l-4 border-l-[var(--color-warning)]',
  },
  info: {
    icon: <Info className="w-4 h-4 text-[var(--color-info)]" />,
    className: 'border-l-4 border-l-[var(--color-info)]',
  },
  default: {
    icon: null,
    className: '',
  },
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { variant = 'default', title, description, duration = 3000, action } = item;
  const config = variantConfig[variant];

  return (
    <RadixToast.Root
      duration={duration === 0 ? Infinity : duration}
      onOpenChange={(open) => { if (!open) onDismiss(); }}
      // §7 status announcements — errors announce assertively (role="alert");
      // everything else is an explicit polite live region. Radix does not set
      // a role on Toast.Root by default, so both are declared here.
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]',
        'px-4 py-3 shadow-[var(--shadow-lg)]',
        'data-[state=open]:animate-[toast-slide-in_200ms_ease-out]',
        'data-[state=closed]:animate-[toast-slide-out_150ms_ease-in]',
        config.className,
      )}
    >
      {config.icon && (
        <div className="shrink-0 mt-0.5">{config.icon}</div>
      )}

      <div className="flex-1 min-w-0">
        <RadixToast.Title className="text-xs font-semibold text-[var(--color-text)] leading-snug">
          {title}
        </RadixToast.Title>
        {description && (
          <RadixToast.Description className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
            {description}
          </RadixToast.Description>
        )}
        {action && (
          <RadixToast.Action asChild altText={action.label}>
            <button
              onClick={action.onClick}
              className="mt-1.5 text-xs font-semibold text-[var(--color-info)] hover:underline cursor-pointer focus-ring rounded"
            >
              {action.label}
            </button>
          </RadixToast.Action>
        )}
      </div>

      <RadixToast.Close asChild>
        <button
          aria-label="Dismiss notification"
          onClick={onDismiss}
          className="shrink-0 p-0.5 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] cursor-pointer focus-ring"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </RadixToast.Close>
    </RadixToast.Root>
  );
}
