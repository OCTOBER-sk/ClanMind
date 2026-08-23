import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../utils';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  content: React.ReactNode;
}

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  tabs: TabItem[];
  variant?: 'underline' | 'pills' | 'enclosed';
  className?: string;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  tabs,
  variant = 'underline',
  className,
}: TabsProps) {
  const initialValue = defaultValue || tabs[0]?.id;

  // §4 semantic tokens
  const listVariantClasses = {
    underline: 'border-b border-[var(--color-border)] gap-6',
    pills: 'bg-[var(--color-surface-hover)] p-1 rounded-lg gap-1',
    enclosed: 'border-b border-[var(--color-border)] gap-2',
  };

  const triggerVariantClasses = {
    underline:
      'pb-2.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border-b-2 border-transparent data-[state=active]:border-[var(--color-primary)] data-[state=active]:text-[var(--color-text)] rounded-none',
    pills:
      'px-3 py-1.5 text-xs font-medium rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] data-[state=active]:bg-[var(--color-surface-raised)] data-[state=active]:text-[var(--color-text)] data-[state=active]:shadow-[var(--shadow-sm)]',
    enclosed:
      'px-3 py-2 text-xs font-medium rounded-t-lg border border-transparent data-[state=active]:border-[var(--color-border)] data-[state=active]:border-b-[var(--color-surface-raised)] data-[state=active]:bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] data-[state=active]:text-[var(--color-text)]',
  };

  return (
    <TabsPrimitive.Root
      defaultValue={initialValue}
      value={value}
      onValueChange={onValueChange}
      className={cn('flex flex-col w-full', className)}
    >
      <TabsPrimitive.List className={cn('flex items-center', listVariantClasses[variant])}>
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            className={cn(
              'inline-flex items-center gap-1.5 transition-all outline-none cursor-pointer select-none focus-visible:shadow-[var(--focus-ring)]',
              triggerVariantClasses[variant]
            )}
          >
            {tab.icon && <span className="w-4 h-4 shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge && <span className="ml-1">{tab.badge}</span>}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {tabs.map((tab) => (
        <TabsPrimitive.Content
          key={tab.id}
          value={tab.id}
          className="mt-3 outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}