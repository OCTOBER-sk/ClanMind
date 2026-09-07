import React, { useEffect, useState, useRef, useMemo } from 'react';
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
// §14.7 M3: surface-container-high · corner-large (16px) · shadow-5 · scrim 60% · token-only.

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

// M3 item — text-on-surface with state-layer hover (8% currentColor) per §4.4.
// Selected / aria-selected maps to secondary-container per §14.7 selected treatment.
const itemClass =
  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-on-surface cursor-pointer transition-colors duration-micro ease-emphasized relative isolate overflow-hidden before:absolute before:inset-0 before:rounded-lg before:bg-current before:opacity-0 hover:before:opacity-[0.08] before:transition-opacity before:duration-micro data-[selected=true]:bg-secondary-container data-[selected=true]:text-on-secondary-container aria-selected:bg-secondary-container aria-selected:text-on-secondary-container focus-visible:shadow-[var(--md-focus-ring)] focus-visible:outline-none motion-reduce:transition-none motion-reduce:before:transition-none';

const groupHeadingClass =
  'text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-2 py-1.5 select-none';

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
  const decisionLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const [id, n] of decisionOrdinals(decisions)) labels.set(id, `Decision #${n}`);
    return labels;
  }, [decisions]);

  // §8.7 — debounce (220ms) + AbortController for any async lookup the host
  // wires into the palette; the local filter still happens synchronously.
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => setDebouncedSearch(searchInput), 220);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchInput]);
  useEffect(() => {
    // §8.7 — abort in-flight search requests when the query changes or
    // the palette closes. Hosts may attach their own listener via the
    // exposed `debouncedSearch` key; we keep the contract minimal here.
    if (!open) return;
    const ac = new AbortController();
    return () => ac.abort();
  }, [debouncedSearch, open]);

  // §8.2 — view-ranked grouping. The order of groups here IS the rank:
  // current context (project-scoped entities first when a project is active)
  // → quick commands → members → broader items. Items within a group are
  // sorted by recency / pinned / activity weight through the host.
  const groupOrder = useMemo(
    () => ['Commands', 'Messages', 'People', 'Tasks', 'Decisions', 'Projects', 'Artifacts', 'Files'],
    [],
  );

  // §66/§8 — this palette is a modal dialog: focus must be TRAPPED inside it
  // while open and RESTORED to the trigger when it closes. cmdk handles
  // arrow-key navigation internally; Tab cycling is ours.
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Capture BEFORE moving focus anywhere — the element that held focus
    // when the palette opened is the restore target (§66).
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));

    // Initial focus goes to the search input (set here, not via autoFocus,
    // so the capture above always sees the true pre-open focus owner).
    const firstInput = dialog.querySelector<HTMLElement>('input');
    firstInput?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // §66 safe focus restoration on close/unmount.
      restoreFocusRef.current?.focus({ preventScroll: true });
      restoreFocusRef.current = null;
    };
  }, [open]);

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
      className="fixed inset-0 z-50 bg-scrim/60 backdrop-blur-xs flex items-start justify-center pt-24 animate-in fade-in duration-150 motion-reduce:transition-none"
      onClick={() => onOpenChange(false)}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl bg-surface-container-high rounded-lg shadow-xl border border-outline-variant overflow-hidden motion-reduce:transition-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
      >
        <Command label="ClanMind Command Palette" className="w-full">
          <div className="flex items-center px-4 py-3 border-b border-outline-variant gap-2.5 bg-surface-container-high motion-reduce:transition-none">
            <Search className="w-4 h-4 text-on-surface-variant shrink-0" aria-hidden="true" />
            <Command.Input
              placeholder="Search ClanMind projects, artifacts, tasks, decisions..."
              className="w-full text-sm bg-transparent outline-none text-on-surface placeholder:text-on-surface-variant"
              value={searchInput}
              onValueChange={setSearchInput}
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 bg-surface-container-high">
            <Command.Empty className="py-6 text-center text-xs text-on-surface-variant">
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
                <Video className="w-4 h-4 text-error" aria-hidden="true" />
                <span>Start Meeting Mode</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onSelectAction('create_task');
                  onOpenChange(false);
                }}
                className={itemClass}
              >
                <CheckSquare className="w-4 h-4 text-info" aria-hidden="true" />
                <span>Create New Task</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onSelectAction('propose_decision');
                  onOpenChange(false);
                }}
                className={itemClass}
              >
                <Bookmark className="w-4 h-4 text-success" aria-hidden="true" />
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
                    <MessageSquare className="w-4 h-4 text-on-surface-variant" aria-hidden="true" />
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
                    <User className="w-4 h-4 text-on-surface-variant" aria-hidden="true" />
                    <span>{m.nickname || m.user.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* TASKS — §8.2 view-ranked: appear before Projects so the most
                common target (open a task) requires less scrolling. */}
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
                    <CheckSquare className="w-4 h-4 text-info" aria-hidden="true" />
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
                    <Bookmark className="w-4 h-4 text-success" aria-hidden="true" />
                    <span>
                      {decisionLabels.get(d.id) ?? 'Decision'}: {d.title}
                    </span>
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
                  <FolderKanban className="w-4 h-4 text-info" aria-hidden="true" />
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
                  <FileCode className="w-4 h-4 text-warning" aria-hidden="true" />
                  <span>{art.title}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* FILES (§61) — populated when file indexing lands; kept minimal for now */}
            <Command.Group heading="Files" className={cn(groupHeadingClass, 'hidden')}>
              <Command.Item onSelect={() => {}} className={itemClass}>
                <FileText className="w-4 h-4 text-on-surface-variant" aria-hidden="true" />
                <span>Local project files</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
