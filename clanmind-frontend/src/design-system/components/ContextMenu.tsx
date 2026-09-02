import React from 'react';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { cn } from '../utils';

export interface ContextMenuItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export interface ContextMenuProps {
  trigger: React.ReactNode;
  items: (ContextMenuItem | { divider: true; id: string })[];
  className?: string;
}

// §12.1 ContextMenu — M3 menu mirror of Dropdown: surface-container-high, shadow-2, corner-xs, 40px items, state-layer rows.

export function ContextMenu({ trigger, items, className }: ContextMenuProps) {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>{trigger}</ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content
          className={cn(
            'z-50 min-w-[180px] overflow-hidden rounded-xs border border-outline-variant bg-surface-container-high p-1 shadow-2 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            className,
          )}
        >
          {items.map((item) => {
            if ('divider' in item && (item as { divider: true }).divider && !('label' in item)) {
              return (
                <ContextMenuPrimitive.Separator
                  key={(item as { id: string }).id}
                  className="my-1 h-px bg-outline-variant"
                />
              );
            }
            const menuItem = item as ContextMenuItem;
            return (
              <ContextMenuPrimitive.Item
                key={menuItem.id}
                disabled={menuItem.disabled}
                onSelect={(e) => {
                  e.preventDefault();
                  menuItem.onClick?.();
                }}
                data-selected={menuItem.selected ? true : undefined}
                className={cn(
                  'relative flex cursor-pointer select-none items-center gap-2 h-10 min-h-10 rounded-xs px-3 text-sm outline-none transition-colors',
                  'text-on-surface-variant focus:text-on-surface',
                  'focus:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)]',
                  'data-[selected]:bg-secondary-container data-[selected]:text-on-secondary-container',
                  'focus-visible:shadow-[var(--md-focus-ring)] data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                  menuItem.destructive
                    ? 'text-error focus:text-error focus:bg-[color-mix(in_srgb,var(--md-error)_8%,transparent)]'
                    : '',
                )}
              >
                {menuItem.icon && <span className="h-4 w-4 shrink-0 inline-flex items-center justify-center" aria-hidden="true">{menuItem.icon}</span>}
                <span className="flex-1 truncate">{menuItem.label}</span>
                {menuItem.shortcut && (
                  <span className="ml-auto text-[11px] tracking-widest text-on-surface-variant shrink-0">
                    {menuItem.shortcut}
                  </span>
                )}
              </ContextMenuPrimitive.Item>
            );
          })}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
}

// Re-export Radix primitives for advanced usage if needed
export const ContextMenuRoot = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuContent = ContextMenuPrimitive.Content;
export const ContextMenuItemPrimitive = ContextMenuPrimitive.Item;
