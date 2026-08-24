import React, { useEffect } from 'react';
import { Command } from 'cmdk';
import {
  Search,
  FileCode,
  CheckSquare,
  Bookmark,
  FolderKanban,
  Video,
  MessageSquare,
  User,
  FileText,
} from 'lucide-react';
import type { Project, Artifact, Task, Decision, Message, GroupMember } from '@/types';
import { decisionOrdinals } from '@/features/decisions/decisionOrdinal';
import { cn } from '../utils';

// §310: CommandPalette is a design-system primitive.
// §61: sections — Messages, Files, Artifacts, Tasks, Decisions, People, Projects, Commands.

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  artifacts: Artifact[];
  tasks: Task[];
  decisions: Decision[];
  /** Optional — Messages section (§61) */
  messages?: Message[];
  /** Optional — People section (§61) */
  members?: GroupMember[];
  onSelectProject: (project: Project) => void;
  onSelectArtifact: (artifact: Artifact) => void;
  onSelectAction: (actionId: string) => void;
  /** Optional deep-link actions */
  onSelectMessage?: (message: Message) => void;
  onSelectMember?: (member: GroupMember) => void;
}

const itemClass =
  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] cursor-pointer';
const groupHeadingClass =
  'text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider px-2 py-1';

export function CommandPalette({
  open,
  onOpenChange,
  projects,
  artifacts,
  tasks,
  decisions,
  messages = [],
  members = [],
  onSelectProject,
  onSelectArtifact,
  onSelectAction,
  onSelectMessage,
  onSelectMember,
}: CommandPaletteProps) {

  // §120 numbering — one derivation shared with DecisionsView/Overview.
  const decisionLabels = React.useMemo(() => {
    const labels = new Map<string, string>();
    for (const [id, n] of decisionOrdinals(decisions)) labels.set(id, `Decision #${n}`);
    return labels;
  }, [decisions]);

  // §63: Ctrl/Cmd + K — search/commands entry
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  // §63: Esc closes overlays
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-24 animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl bg-[var(--color-surface-raised)] rounded-2xl shadow-[var(--shadow-xl)] border border-[var(--color-border)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
      >
        <Command label="ClanMind Command Palette" className="w-full">
          <div className="flex items-center px-4 py-3 border-b border-[var(--color-border)] gap-2.5">
            <Search className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
            <Command.Input
              placeholder="Search ClanMind projects, artifacts, tasks, decisions..."
              className="w-full text-sm bg-transparent outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]"
              autoFocus
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-xs text-[var(--color-text-tertiary)]">
              {/* §235: command no results copy */}
              No matches. Try a shorter phrase or another filter.
            </Command.Empty>

            {/* QUICK COMMANDS */}
            <Command.Group heading="Commands" className={groupHeadingClass}>
              <Command.Item
                onSelect={() => {
                  onSelectAction('start_meeting');
                  onOpenChange(false);
                }}
                className={itemClass}
              >
                <Video className="w-4 h-4 text-[var(--color-danger)]" aria-hidden="true" />
                <span>Start Meeting Mode</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onSelectAction('create_task');
                  onOpenChange(false);
                }}
                className={itemClass}
              >
                <CheckSquare className="w-4 h-4 text-[var(--color-info)]" aria-hidden="true" />
                <span>Create New Task</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onSelectAction('propose_decision');
                  onOpenChange(false);
                }}
                className={itemClass}
              >
                <Bookmark className="w-4 h-4 text-[var(--color-success)]" aria-hidden="true" />
                <span>Propose Architectural Decision</span>
              </Command.Item>
            </Command.Group>

            {/* MESSAGES (§61) */}
            {messages.length > 0 && onSelectMessage && (
              <Command.Group heading="Messages" className={groupHeadingClass}>
                {messages.slice(0, 6).map((msg) => (
                  <Command.Item
                    key={msg.id}
                    onSelect={() => {
                      onSelectMessage(msg);
                      onOpenChange(false);
                    }}
                    className={itemClass}
                  >
                    <MessageSquare className="w-4 h-4 text-[var(--color-text-tertiary)]" aria-hidden="true" />
                    <span className="truncate max-w-[30rem]">
                      {msg.sender_name}: {msg.body.slice(0, 60)}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* PEOPLE (§61) */}
            {members.length > 0 && onSelectMember && (
              <Command.Group heading="People" className={groupHeadingClass}>
                {members.map((m) => (
                  <Command.Item
                    key={m.user_id}
                    onSelect={() => {
                      onSelectMember(m);
                      onOpenChange(false);
                    }}
                    className={itemClass}
                  >
                    <User className="w-4 h-4 text-[var(--color-text-tertiary)]" aria-hidden="true" />
                    <span>{m.nickname || m.user.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* PROJECTS */}
            <Command.Group heading="Projects" className={groupHeadingClass}>
              {projects.map((proj) => (
                <Command.Item
                  key={proj.id}
                  onSelect={() => {
                    onSelectProject(proj);
                    onOpenChange(false);
                  }}
                  className={itemClass}
                >
                  <FolderKanban className="w-4 h-4 text-[var(--color-info)]" aria-hidden="true" />
                  <span>{proj.name}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* ARTIFACTS */}
            <Command.Group heading="Artifacts" className={groupHeadingClass}>
              {artifacts.map((art) => (
                <Command.Item
                  key={art.id}
                  onSelect={() => {
                    onSelectArtifact(art);
                    onOpenChange(false);
                  }}
                  className={itemClass}
                >
                  <FileCode className="w-4 h-4 text-[var(--color-warning)]" aria-hidden="true" />
                  <span>{art.title}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* FILES (§61) — populated when file indexing lands; kept minimal for now */}
            <Command.Group heading="Files" className={cn(groupHeadingClass, 'hidden')}>
              <Command.Item onSelect={() => {}} className={itemClass}>
                <FileText className="w-4 h-4 text-[var(--color-text-tertiary)]" aria-hidden="true" />
                <span>Local project files</span>
              </Command.Item>
            </Command.Group>

            {/* TASKS */}
            {tasks.length > 0 && (
              <Command.Group heading="Tasks" className={groupHeadingClass}>
                {tasks.map((t) => (
                  <Command.Item
                    key={t.id}
                    onSelect={() => {
                      onSelectAction(`view_task_${t.id}`);
                      onOpenChange(false);
                    }}
                    className={itemClass}
                  >
                    <CheckSquare className="w-4 h-4 text-[var(--color-info)]" aria-hidden="true" />
                    <span>{t.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* DECISIONS */}
            {decisions.length > 0 && (
              <Command.Group heading="Decisions" className={groupHeadingClass}>
                {decisions.map((d) => (
                  <Command.Item
                    key={d.id}
                    onSelect={() => {
                      onSelectAction(`view_decision_${d.id}`);
                      onOpenChange(false);
                    }}
                    className={itemClass}
                  >
                    <Bookmark className="w-4 h-4 text-[var(--color-success)]" aria-hidden="true" />
                    <span>
                      {decisionLabels.get(d.id) ?? 'Decision'}: {d.title}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}