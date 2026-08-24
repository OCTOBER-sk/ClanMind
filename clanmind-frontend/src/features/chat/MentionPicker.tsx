import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Avatar } from '@/design-system/components/Avatar';
import { Sparkles } from 'lucide-react';
import { cn } from '@/design-system/utils';
import type { GroupMember } from '@/types';

export interface MentionItem {
  id: string;
  name: string;
  role?: string;
  isAi?: boolean;
}

export interface MentionPickerHandle {
  selectNext: () => void;
  selectPrev: () => void;
  selectCurrent: () => void;
}

export interface MentionPickerProps {
  query: string;
  members: GroupMember[];
  aiName: string;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
  /**
   * §60 — viewport-space placement computed by the composer from the live
   * caret position. When absent the picker falls back to its static
   * anchor above the composer.
   */
  placement?: { left: number; top: number } | null;
}

/** §34: typing @ opens this popover — ↑ ↓ Enter Esc supported (§34) */
export const MentionPicker = forwardRef<MentionPickerHandle, MentionPickerProps>(
  function MentionPicker({ query, members, aiName, onSelect, onClose, placement }, ref) {
    const items: MentionItem[] = [
      {
        id: 'odin_ai',
        name: aiName,
        role: 'Shared AI Teammate',
        isAi: true,
      },
      ...members.map((m) => ({
        id: m.user_id,
        name: m.nickname || m.user.name,
        role: m.role,
        isAi: false,
      })),
    ];

    const filtered = items.filter((item) =>
      item.name.toLowerCase().includes(query.toLowerCase())
    );

    const [selectedIndex, setSelectedIndex] = useState(0);

    // Render-time clamp — selection stays valid as the list shrinks
    const clampedIndex = Math.min(selectedIndex, Math.max(filtered.length - 1, 0));

    useImperativeHandle(ref, () => ({
      selectNext: () => setSelectedIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0))),
      selectPrev: () => setSelectedIndex((i) => Math.max(i - 1, 0)),
      selectCurrent: () => {
        const item = filtered[clampedIndex];
        if (item) {
          onSelect(item);
          onClose();
        }
      },
    }));

    return (
      <div
        role="listbox"
        aria-label="Mention a teammate"
        className={cn(
          'z-50 w-72 rounded-xl border p-1.5 shadow-[var(--shadow-xl)] max-h-56 overflow-y-auto',
          placement ? 'fixed' : 'absolute bottom-full left-4 mb-2'
        )}
        style={
          placement
            ? {
                left: placement.left,
                top: placement.top,
                borderColor: 'var(--color-border)',
                background: 'var(--color-surface-raised)',
              }
            : { borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }
        }
      >
        <div
          className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          Mention Teammate
        </div>
        {filtered.length === 0 ? (
          // §234 mention no results
          <div className="px-2.5 py-2 text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            No teammate found.
          </div>
        ) : (
          filtered.map((item, i) => (
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
                'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer',
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
          ))
        )}
      </div>
    );
  }
);