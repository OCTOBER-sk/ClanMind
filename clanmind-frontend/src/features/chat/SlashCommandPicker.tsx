import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import {
  Sparkles,
  Lock,
  Video,
  Search,
  Bookmark,
  FolderKanban,
} from 'lucide-react';
import { cn } from '@/design-system/utils';
import type { ServerFeatureFlags } from '@/types';

export interface SlashCommand {
  id: string;
  command: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

export interface SlashCommandPickerHandle {
  selectNext: () => void;
  selectPrev: () => void;
  selectCurrent: () => void;
}

export interface SlashCommandPickerProps {
  query: string;
  featureFlags?: Partial<ServerFeatureFlags>;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

const BASE_COMMANDS: SlashCommand[] = [
  {
    id: 'cmd_odin',
    command: '/odin',
    name: 'Ask Odin',
    description: 'Ask the shared AI teammate a question or request an artifact',
    icon: <Sparkles className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />,
  },
  {
    id: 'cmd_private',
    command: '/private',
    name: 'Private',
    description: 'Start private scoped chat with teammate or Odin',
    icon: <Lock className="w-4 h-4" style={{ color: 'var(--color-info)' }} />,
  },
  {
    id: 'cmd_meeting',
    command: '/meeting',
    name: 'Meeting',
    description: 'Start first-class Meeting Mode with live notes and candidate tracking',
    icon: <Video className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />,
  },
  {
    id: 'cmd_research',
    command: '/research',
    name: 'Deep Research',
    description: 'Trigger multi-step web research with citations and project impact',
    icon: <Search className="w-4 h-4" style={{ color: 'var(--color-success)' }} />,
  },
  {
    id: 'cmd_memory',
    command: '/memory',
    name: 'Memory',
    description: 'Explicitly store a project decision, constraint, or convention',
    icon: <Bookmark className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />,
  },
  {
    id: 'cmd_project',
    command: '/project',
    name: 'Project',
    description: 'Switch working project context chip',
    icon: <FolderKanban className="w-4 h-4" style={{ color: 'var(--color-info)' }} />,
  },
];

// §165A.2: flags hide the entry point entirely, not grey it out
export const SlashCommandPickerWithKeyboard = forwardRef<
  SlashCommandPickerHandle,
  SlashCommandPickerProps
>(function SlashCommandPickerWithKeyboard(props, ref) {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { query, featureFlags = {}, onSelect, onClose } = props;

  const commands = useMemo(
    () =>
      BASE_COMMANDS.filter((cmd) => {
        if (cmd.command === '/meeting' && featureFlags.meeting_mode === false) return false;
        if (cmd.command === '/research' && featureFlags.deep_research === false) return false;
        return true;
      }),
    [featureFlags.meeting_mode, featureFlags.deep_research]
  );

  const filtered = commands.filter(
    (cmd) =>
      cmd.command.toLowerCase().includes(query.toLowerCase()) ||
      cmd.name.toLowerCase().includes(query.toLowerCase())
  );

  // Render-time clamp — selection stays valid as the list shrinks, no effect
  const clampedIndex = Math.min(selectedIndex, Math.max(filtered.length - 1, 0));

  useImperativeHandle(ref, () => ({
    selectNext: () => setSelectedIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0))),
    selectPrev: () => setSelectedIndex((i) => Math.max(i - 1, 0)),
    selectCurrent: () => {
      const cmd = filtered[clampedIndex];
      if (cmd) {
        onSelect(cmd);
        onClose();
      }
    },
  }));

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Slash commands"
      className="absolute bottom-full left-4 mb-2 z-50 w-80 rounded-xl border p-1.5 shadow-[var(--shadow-xl)] max-h-64 overflow-y-auto"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
    >
      <div
        className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        Slash Commands
      </div>
      {filtered.length === 0 ? (
        <div className="px-2.5 py-2 text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
          No commands found.
        </div>
      ) : (
        filtered.map((cmd, i) => (
          <button
            key={cmd.id}
            role="option"
            aria-selected={i === clampedIndex}
            onMouseEnter={() => setSelectedIndex(i)}
            onClick={() => {
              onSelect(cmd);
              onClose();
            }}
            className={cn(
              'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium text-left cursor-pointer transition-colors',
              i === clampedIndex && 'bg-[var(--color-surface-hover)]'
            )}
            style={{ color: 'var(--color-text)' }}
          >
            <div className="p-1.5 rounded-md shrink-0" style={{ background: 'var(--color-surface-hover)' }}>
              {cmd.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold flex items-center justify-between">
                <span>{cmd.name}</span>
                <span className="text-[11px] font-mono font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
                  {cmd.command}
                </span>
              </p>
              <p className="truncate text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                {cmd.description}
              </p>
            </div>
          </button>
        ))
      )}
    </div>
  );
});