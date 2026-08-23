import { useEffect } from 'react';
import { useUiStore } from '@/state/useUiStore';

/**
 * §63 Keyboard Shortcuts:
 *   Ctrl/Cmd + K        search/commands
 *   Ctrl/Cmd + /        shortcut help
 *   Ctrl/Cmd + Shift + P project switcher
 *   Esc                 close overlays
 * Enter/Shift+Enter are handled by the composer itself.
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + K — search/commands
      if (mod && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        e.preventDefault();
        const open = useUiStore.getState().isCommandPaletteOpen;
        useUiStore.getState().setCommandPaletteOpen(!open);
        return;
      }

      // Ctrl/Cmd + / — shortcut help
      if (mod && e.key === '/') {
        e.preventDefault();
        useUiStore.getState().setKeyboardHelpOpen(true);
        return;
      }

      // Ctrl/Cmd + Shift + P — project switcher (opens search scoped to projects)
      if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        useUiStore.getState().setCommandPaletteOpen(true);
        return;
      }

      // Esc — close overlays
      if (e.key === 'Escape') {
        const ui = useUiStore.getState();
        if (ui.isKeyboardHelpOpen) {
          ui.setKeyboardHelpOpen(false);
          return;
        }
        if (ui.isCommandPaletteOpen) {
          ui.setCommandPaletteOpen(false);
        }
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);
}