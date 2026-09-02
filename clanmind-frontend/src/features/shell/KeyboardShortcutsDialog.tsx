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
      <div className="space-y-1">
        {SHORTCUTS.map((s) => (
          <div
            key={s.keys}
            className="flex items-center justify-between py-2 border-b border-outline-variant last:border-0"
          >
            <span className="text-label-medium text-on-surface-variant">
              {s.label}
            </span>
            <kbd className="font-mono text-[10px] px-2 py-1 rounded-full bg-surface-variant text-on-surface-variant border border-outline-variant">
              {s.keys}
            </kbd>
          </div>
        ))}
      </div>
    </Dialog>
  );
}