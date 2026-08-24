/**
 * Memory view (FE §116–§118). Three sections — Group Memory, Project
 * Memory, Your Private Memory — with typed cards showing source, created,
 * updated and scope (§116). Odin's uncertain candidates render the §117
 * Save/Dismiss banner; "Add memory" opens the §118 scope chooser that
 * defaults to Project inside a Project context.
 */

import React, { useMemo, useState } from 'react';
import { Check, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import { Dialog } from '@/design-system/components/Dialog';
import type { MemoryCandidate, MemoryCardType, MemoryEntry, MemoryScope } from '@/types';

export interface MemoryViewProps {
  memories: MemoryEntry[];
  memoryCandidates: MemoryCandidate[];
  /** Inside a Project → the §118 default scope is PROJECT. */
  inProject: boolean;
  aiName: string;
  isLoading?: boolean;
  error?: string | null;
  onSaveCandidate: (candidateId: string) => void;
  onDismissCandidate: (candidateId: string) => void;
  onAddMemory: (scope: MemoryScope, memoryType: MemoryCardType, content: string) => void;
}

type Section = Extract<'project' | 'group' | 'private', string>;

const SECTIONS: Array<{ key: Section; label: string; scope: MemoryScope }> = [
  { key: 'project', label: 'Project Memory', scope: 'PROJECT' },
  { key: 'group', label: 'Group Memory', scope: 'GROUP' },
  { key: 'private', label: 'Your Private Memory', scope: 'USER_PRIVATE' },
];

/** FE §116 card-type vocabulary; unknown backend types render verbatim. */
const CARD_TYPES: MemoryCardType[] = [
  'DECISION',
  'CONSTRAINT',
  'CONVENTION',
  'PREFERENCE',
  'FINDING',
  'LESSON',
];

export function MemoryView({
  memories,
  memoryCandidates,
  inProject,
  aiName,
  isLoading,
  error,
  onSaveCandidate,
  onDismissCandidate,
  onAddMemory,
}: MemoryViewProps) {
  const [activeSection, setActiveSection] = useState<Section>(inProject ? 'project' : 'group');
  const [isRememberOpen, setRememberOpen] = useState(false);

  // §116 sections are scope partitions; PROJECT rows shown only when a
  // project context exists.
  const sectionRows = useMemo(() => {
    const scope = SECTIONS.find((s) => s.key === activeSection)?.scope ?? 'PROJECT';
    return memories.filter((m) => m.scope_type === scope);
  }, [memories, activeSection]);

  const pendingCandidates = useMemo(
    () => memoryCandidates.filter((c) => c.status === 'PENDING'),
    [memoryCandidates],
  );

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-raised)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Memory</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Scoped, privacy-aware context {aiName} retains across sessions.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setRememberOpen(true)}
        >
          Add Memory
        </Button>
      </div>

      {/* §117 — Odin's uncertain candidates */}
      {pendingCandidates.length > 0 && (
        <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/60 text-xs">
          <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 mb-2">
            <Sparkles className="w-4 h-4 text-amber-500" aria-hidden="true" />
            <span>
              {aiName} noticed a possible project memory
            </span>
          </div>
          <div className="space-y-2">
            {pendingCandidates.map((cand) => (
              <div
                key={cand.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-raised)] border border-amber-200 dark:border-amber-800 shadow-2xs"
                data-testid="memory-candidate"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-medium text-[var(--color-text)]">“{cand.content}”</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                    {Math.round(cand.confidence * 100)}% confident · suggests{' '}
                    {cand.recommended_scope === 'USER_PRIVATE'
                      ? 'your private'
                      : cand.recommended_scope.toLowerCase()}{' '}
                    scope
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => onDismissCandidate(cand.id)}>
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                    onClick={() => onSaveCandidate(cand.id)}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* §116 tabs */}
      <div className="px-6 pt-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-4">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              aria-current={activeSection === s.key}
              data-testid={`memory-section-${s.key}`}
              className={`pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeSection === s.key
                  ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="px-6 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900"
        >
          {error}
        </div>
      )}

      {/* Memories list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3" aria-busy={isLoading}>
        {isLoading && sectionRows.length === 0 ? (
          <p className="text-center py-12 text-[var(--color-text-tertiary)] text-xs">Loading memories…</p>
        ) : sectionRows.length === 0 ? (
          <div className="text-center py-12 space-y-1" data-testid="memory-empty">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              No {SECTIONS.find((s) => s.key === activeSection)?.label.toLowerCase()} yet.
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto leading-relaxed">
              Memories keep decisions, constraints and conventions alive across sessions. Save one
              yourself or let {aiName} propose candidates from chat.
            </p>
          </div>
        ) : (
          sectionRows.map((mem) => <MemoryCardRow key={mem.id} memory={mem} />)
        )}
      </div>

      {/* §118 explicit-memory dialog — scope defaults to Project in-project */}
      <Dialog
        open={isRememberOpen}
        onOpenChange={setRememberOpen}
        title="Remember this"
        description={`Saved memories feed ${aiName}'s context for the chosen scope only.`}
      >
        <RememberForm
          inProject={inProject}
          onCancel={() => setRememberOpen(false)}
          onSubmit={(scope, type, content) => {
            onAddMemory(scope, type, content);
            setRememberOpen(false);
          }}
        />
      </Dialog>
    </div>
  );
}

function RememberForm({
  inProject,
  onSubmit,
  onCancel,
}: {
  inProject: boolean;
  onSubmit: (scope: MemoryScope, type: MemoryCardType, content: string) => void;
  onCancel: () => void;
}) {
  const [scope, setScope] = useState<MemoryScope>(inProject ? 'PROJECT' : 'GROUP'); // §118 default
  const [memoryType, setMemoryType] = useState<MemoryCardType>('CONVENTION');
  const [content, setContent] = useState('');

  return (
    <form
      className="space-y-3 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        if (!content.trim()) return;
        onSubmit(scope, memoryType, content.trim());
      }}
    >
      <div>
        <span className="block font-semibold mb-1 text-[var(--color-text-secondary)]">Remember in:</span>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Memory scope">
          {(inProject
            ? (['PROJECT', 'GROUP', 'USER_PRIVATE'] as const)
            : (['GROUP', 'USER_PRIVATE'] as const)
          ).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scope === s}
              onClick={() => setScope(s)}
              className={`px-2.5 py-1 rounded-lg border font-semibold cursor-pointer ${
                scope === s
                  ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                  : 'border-[var(--color-border-strong)] text-[var(--color-text-secondary)]'
              }`}
            >
              {s === 'PROJECT' ? 'Project' : s === 'GROUP' ? 'Group' : 'Private'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label
          htmlFor="memory-type"
          className="block font-semibold mb-1 text-[var(--color-text-secondary)]"
        >
          Type
        </label>
        <select
          id="memory-type"
          value={memoryType}
          onChange={(e) => setMemoryType(e.target.value as MemoryCardType)}
          className="w-full px-3 py-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] text-[var(--color-text)] outline-none"
        >
          {CARD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="memory-content"
          className="block font-semibold mb-1 text-[var(--color-text-secondary)]"
        >
          Content
        </label>
        <textarea
          id="memory-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="e.g. We will use PostgreSQL for all new services."
          className="w-full px-3 py-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] text-[var(--color-text)] outline-none"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button size="sm" variant="ghost" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" type="submit" disabled={!content.trim()}>
          Save memory
        </Button>
      </div>
    </form>
  );
}

/**
 * One §116 card — typed badge + content + provenance line
 * (source · scope · created · updated).
 */
function MemoryCardRow({ memory }: { memory: MemoryEntry }) {
  const isTypedVocabulary = CARD_TYPES.includes(memory.memory_type as MemoryCardType);
  const provenance = [
    `Source: ${sourceLabel(memory)}`,
    `Scope: ${memory.scope_type === 'USER_PRIVATE' ? 'Private' : memory.scope_type}`,
    `Created ${new Date(memory.created_at).toLocaleDateString()}`,
    `Updated ${new Date(memory.updated_at).toLocaleDateString()}`,
  ];

  return (
    <div
      data-testid="memory-card"
      className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-2xs space-y-2 text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <Badge variant="neutral" size="sm">
          {isTypedVocabulary ? memory.memory_type : memory.memory_type || 'FACT'}
        </Badge>
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">{memory.scope_type}</span>
      </div>
      <p className="text-[var(--color-text)] leading-relaxed">{memory.content}</p>
      <ul className="pt-1 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-tertiary)] flex flex-wrap gap-x-3 gap-y-0.5">
        {provenance.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function sourceLabel(memory: MemoryEntry): string {
  switch (memory.source_type) {
    case 'ai_research':
      return 'Odin research';
    case 'explicit':
      return 'You';
    case 'candidate_accepted':
      return 'Accepted candidate';
    case 'decision':
      return 'Approved decision';
    case 'conversation':
      return 'Team conversation';
    default:
      return memory.source_type || 'Unknown';
  }
}
