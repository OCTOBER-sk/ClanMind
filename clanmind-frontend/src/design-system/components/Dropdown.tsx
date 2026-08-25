import React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '../utils';

export interface DropdownMenuItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick?: () => void;
  divider?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: (DropdownMenuItem | { divider: true; id: string })[];
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function Dropdown({
  trigger,
  items,
  align = 'end',
  side = 'bottom',
  className,
}: DropdownProps) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          side={side}
          sideOffset={5}
          className={cn(
            'z-50 min-w-[180px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1 shadow-[var(--shadow-lg)] animate-in fade-in-80 zoom-in-95',
            className
          )}
        >
          {items.map((item) => {
            if ('divider' in item && item.divider && !('label' in item)) {
              return (
                <DropdownMenuPrimitive.Separator
                  key={item.id}
                  className="my-1 h-px bg-[var(--color-border)]"
                />
              );
            }

            const menuItem = item as DropdownMenuItem;
            return (
              <DropdownMenuPrimitive.Item
                key={menuItem.id}
                disabled={menuItem.disabled}
                onClick={menuItem.onClick}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 text-xs font-medium outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                  menuItem.destructive
                    ? 'text-[var(--color-danger)] focus:bg-[var(--color-danger-bg)] focus:text-[var(--color-danger)]'
                    : 'text-[var(--color-text-secondary)] focus:bg-[var(--color-surface-hover)] focus:text-[var(--color-text)]'
                )}
              >
                {menuItem.icon && <span className="mr-2 h-4 w-4 shrink-0">{menuItem.icon}</span>}
                <span className="flex-1">{menuItem.label}</span>
                {menuItem.shortcut && (
                  <span className="ml-auto text-[10px] tracking-widest text-[var(--color-text-tertiary)]">
                    {menuItem.shortcut}
                  </span>
                )}
              </DropdownMenuPrimitive.Item>
            );
          })}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}