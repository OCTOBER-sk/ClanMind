import React from 'react';
import { Dialog } from '@/design-system/components/Dialog';

/** §63 keyboard shortcuts reference — opened via Ctrl/Cmd + / */
const SHORTCUTS: Array<{ keys: string; label: string }> = [
  { keys: 'Ctrl/Cmd + K', label: 'Search and commands' },
  { keys: 'Ctrl/Cmd + /', label: 'Shortcut help' },
  { keys: 'Ctrl/Cmd + Shift + P', label: 'Project switcher' },
  { keys: 'Enter', label: 'Send message' },
  { keys: 'Shift + Enter', label: 'New line in composer' },
  { keys: 'Esc', label: 'Close overlays' },
];

export interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Keyboard shortcuts" maxWidth="sm">
      <div className="space-y-2">
        {SHORTCUTS.map((s) => (
          <div
            key={s.keys}
            className="flex items-center justify-between py-1.5 border-b last:border-0"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {s.label}
            </span>
            <kbd
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--color-surface-hover)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              {s.keys}
            </kbd>
          </div>
        ))}
      </div>
    </Dialog>
  );
}