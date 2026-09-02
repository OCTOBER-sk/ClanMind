import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../utils';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  tabs: TabItem[];
  variant?: 'underline' | 'pills' | 'enclosed' | 'primary';
  className?: string;
}

const aliasMap: Record<string, 'underline' | 'pills' | 'enclosed'> = {
  underline: 'underline',
  pills: 'pills',
  enclosed: 'enclosed',
  primary: 'underline',
};

function normalize(v: string): 'underline' | 'pills' | 'enclosed' {
  return aliasMap[v] ?? 'underline';
}

// §12.1 Tabs — M3 primary tabs: title-small labels (14/20 +0.10 500), active indicator 3px primary sliding with ease-emphasized, state-layer hover.

export function Tabs({ defaultValue, value, onValueChange, tabs, variant = 'underline', className }: TabsProps) {
  const initialValue = defaultValue || tabs[0]?.id;
  const v = normalize(variant as string);

  const listVariantClasses = {
    underline: 'border-b border-outline-variant gap-1',
    pills: 'bg-surface-container p-1 rounded-full gap-1',
    enclosed: 'border-b border-outline-variant gap-2',
  };

  const triggerBase =
    'relative isolate inline-flex items-center gap-1.5 px-3 py-2.5 text-[14px] leading-[20px] tracking-[0.10px] font-medium transition-colors duration-micro ease-emphasized outline-none cursor-pointer select-none overflow-hidden rounded-xs focus-visible:shadow-[var(--md-focus-ring)] before:absolute before:inset-0 before:rounded-xs before:opacity-0 before:transition-opacity before:duration-micro before:pointer-events-none';

  const triggerVariantClasses = {
    underline: cn(
      triggerBase,
      'text-on-surface-variant hover:text-on-surface hover:before:opacity-100 hover:before:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)]',
      'data-[state=active]:text-primary data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-1 data-[state=active]:after:right-1 data-[state=active]:after:h-[3px] data-[state=active]:after:bg-primary data-[state=active]:after:rounded-full data-[state=active]:after:transition-all data-[state=active]:after:duration-standard data-[state=active]:after:ease-emphasized',
      'disabled:opacity-40 disabled:pointer-events-none',
    ),
    pills: cn(
      triggerBase,
      'py-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:before:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] hover:before:opacity-100',
      'data-[state=active]:bg-secondary-container data-[state=active]:text-on-secondary-container data-[state=active]:shadow-none',
    ),
    enclosed: cn(
      triggerBase,
      'rounded-t-xs border border-transparent data-[state=active]:border-outline-variant data-[state=active]:border-b-surface data-[state=active]:bg-surface text-on-surface-variant data-[state=active]:text-on-surface',
    ),
  };

  return (
    <TabsPrimitive.Root
      defaultValue={initialValue}
      value={value}
      onValueChange={onValueChange}
      className={cn('flex flex-col w-full', className)}
    >
      <TabsPrimitive.List className={cn('flex items-center', listVariantClasses[v])}>
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            className={cn(triggerVariantClasses[v])}
          >
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {tab.icon && <span className="w-4 h-4 shrink-0 inline-flex" aria-hidden="true">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge && <span className="ml-1 inline-flex">{tab.badge}</span>}
            </span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {tabs.map((tab) => (
        <TabsPrimitive.Content
          key={tab.id}
          value={tab.id}
          className="mt-3 outline-none focus-visible:shadow-[var(--md-focus-ring)] rounded-xs"
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
