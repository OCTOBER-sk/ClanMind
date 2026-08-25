import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Avatar } from '@/design-system/components/Avatar';
import { Lock, Sparkles } from 'lucide-react';
import { cn } from '@/design-system/utils';
import type { GroupMember } from '@/types';

export interface PrivateRecipientItem {
  id: string;
  name: string;
  role?: string;
  isAi?: boolean;
}

export interface PrivateRecipientChooserHandle {
  selectNext: () => void;
  selectPrev: () => void;
  selectCurrent: () => void;
}

export interface PrivateRecipientChooserProps {
  members: GroupMember[];
  aiName: string;
  onSelect: (item: PrivateRecipientItem) => void;
  onClose: () => void;
}

/**
 * §55 — after `/private`, choose the recipient. Odin appears as a distinct
 * AI entry; every choice produces an unmistakably private composer state.
 * ↑ ↓ Enter Esc supported, mirroring the §34 mention picker contract.
 */
export const PrivateRecipientChooser = forwardRef<
  PrivateRecipientChooserHandle,
  PrivateRecipientChooserProps
>(function PrivateRecipientChooser({ members, aiName, onSelect, onClose }, ref) {
  const items: PrivateRecipientItem[] = [
    { id: 'odin_ai', name: aiName, role: 'Shared AI Teammate', isAi: true },
    ...members.map((m) => ({
      id: m.user_id,
      name: m.nickname || m.user.name,
      role: m.role,
      isAi: false,
    })),
  ];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const clampedIndex = Math.min(selectedIndex, Math.max(items.length - 1, 0));

  useImperativeHandle(ref, () => ({
    selectNext: () => setSelectedIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0))),
    selectPrev: () => setSelectedIndex((i) => Math.max(i - 1, 0)),
    selectCurrent: () => {
      const item = items[clampedIndex];
      if (item) {
        onSelect(item);
        onClose();
      }
    },
  }));

  return (
    <div
      data-testid="private-recipient-chooser"
      role="listbox"
      aria-label="Choose a private recipient"
      className="absolute bottom-full left-4 mb-2 z-50 w-72 rounded-xl border p-1 shadow-[var(--shadow-xl)] max-h-56 overflow-y-auto"
      style={{ borderColor: 'var(--color-info)', background: 'var(--color-surface-elevated)' }}
    >
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--color-info)' }}
      >
        <Lock className="w-3 h-3" aria-hidden="true" />
        Choose recipient — this conversation will be private
      </div>
      {items.map((item, i) => (
        <button
          key={item.id}
          role="option"
          aria-selected={i === clampedIndex}
          onMouseEnter={() => setSelectedIndex(i)}
          onClick={() => {
            onSelect(item);
            onClose();
          }}
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-75 text-left cursor-pointer',
            i === clampedIndex && 'bg-[var(--color-surface-hover)]'
          )}
          style={{ color: 'var(--color-text)' }}
        >
          {item.isAi ? (
            <Avatar name={item.name} size="sm" isAi={true} />
          ) : (
            <Avatar name={item.name} size="sm" />
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate font-semibold flex items-center gap-1">
              {item.name}
              {item.isAi && (
                <Sparkles className="w-2.5 h-2.5" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
              )}
            </p>
            {item.role && (
              <p className="truncate text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                {item.role}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
});
