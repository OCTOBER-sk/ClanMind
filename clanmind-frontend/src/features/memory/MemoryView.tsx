/**
 * Memory view (FE §116–§118). Three sections — Group Memory, Project
 * Memory, Your Private Memory — with typed cards showing source, created,
 * updated and scope (§116). Odin's uncertain candidates render the §117
 * Save/Dismiss banner; "Add memory" opens the §118 scope chooser that
 * defaults to Project inside a Project context.
 */

import React, { useMemo, useState } from 'react';
import { Check, Plus, Sparkles, Lock, Users, Folder } from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import { Dialog } from '@/design-system/components/Dialog';
import { EmptyState } from '@/design-system/components/EmptyState';
import { Skeleton } from '@/design-system/components/Skeleton';
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

const SECTIONS: Array<{ key: Section; label: string; scope: MemoryScope; icon: React.ReactNode }> = [
  { key: 'project', label: 'Project Memory', scope: 'PROJECT', icon: <Folder className="w-3 h-3" aria-hidden="true" /> },
  { key: 'group', label: 'Group Memory', scope: 'GROUP', icon: <Users className="w-3 h-3" aria-hidden="true" /> },
  { key: 'private', label: 'Your Private Memory', scope: 'USER_PRIVATE', icon: <Lock className="w-3 h-3" aria-hidden="true" /> },
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
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 border-b px-6 py-4"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div>
          <h1 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>
            Memory
          </h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            Scoped context {aiName} retains across sessions.
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
        <div
          className="px-6 py-3 border-b text-xs"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-2 font-bold mb-2" style={{ color: 'var(--color-text)' }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
            <span>{aiName} noticed a possible memory</span>
          </div>
          <div className="space-y-2">
            {pendingCandidates.map((cand) => (
              <div
                key={cand.id}
                className="flex items-center justify-between p-2.5 rounded-lg border"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
                data-testid="memory-candidate"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>&ldquo;{cand.content}&rdquo;</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
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

      {/* §116 tabs — icon + text for scope clarity */}
      <div
        className="px-6 pt-2 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-3">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              aria-current={activeSection === s.key}
              data-testid={`memory-section-${s.key}`}
              className="flex items-center gap-1.5 pb-2.5 text-[11px] font-semibold border-b-2 transition-colors cursor-pointer"
              style={{
                borderColor: activeSection === s.key ? 'var(--color-text)' : 'transparent',
                color: activeSection === s.key ? 'var(--color-text)' : 'var(--color-text-secondary)',
              }}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error — §64 */}
      {error && (
        <div
          role="alert"
          className="px-6 py-2.5 text-xs border-b"
          style={{ color: 'var(--color-danger)', background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          {error}
        </div>
      )}

      {/* Memories list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2" aria-busy={isLoading}>
        {/* §64 — skeleton loading */}
        {isLoading && sectionRows.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-lg border space-y-2"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
              >
                <div className="flex items-center gap-2">
                  <Skeleton variant="text" className="h-4 w-16 rounded-full" />
                  <Skeleton variant="text" className="h-3 w-12" />
                </div>
                <Skeleton variant="text" className="h-3 w-full" />
                <Skeleton variant="text" className="h-2.5 w-2/3" />
              </div>
            ))}
          </div>
        ) : sectionRows.length === 0 ? (
          <div data-testid="memory-empty" className="text-center py-12 space-y-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              No {SECTIONS.find((s) => s.key === activeSection)?.label.toLowerCase()} yet.
            </p>
            <p className="text-xs max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
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
        <span className="block font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Remember in:</span>
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
              className="px-2.5 py-1 rounded-md border font-semibold cursor-pointer transition-colors"
              style={{
                borderColor: scope === s ? 'var(--color-text)' : 'var(--color-border-strong)',
                background: scope === s ? 'var(--color-text)' : 'transparent',
                color: scope === s ? 'var(--color-background)' : 'var(--color-text-secondary)',
              }}
            >
              {s === 'PROJECT' ? 'Project' : s === 'GROUP' ? 'Group' : 'Private'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label
          htmlFor="memory-type"
          className="block font-semibold mb-1"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Type
        </label>
        <select
          id="memory-type"
          value={memoryType}
          onChange={(e) => setMemoryType(e.target.value as MemoryCardType)}
          className="w-full px-3 py-1.5 rounded-md border text-xs outline-none"
          style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface-raised)', color: 'var(--color-text)' }}
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
          className="block font-semibold mb-1"
          style={{ color: 'var(--color-text-secondary)' }}
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
          className="w-full px-3 py-1.5 rounded-md border text-xs outline-none resize-none"
          style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface-raised)', color: 'var(--color-text)' }}
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
  const scopeLabel = memory.scope_type === 'USER_PRIVATE' ? 'Private' : memory.scope_type;
  const provenance = [
    `Source: ${sourceLabel(memory)}`,
    `Scope: ${scopeLabel}`,
    `Created ${new Date(memory.created_at).toLocaleDateString()}`,
    `Updated ${new Date(memory.updated_at).toLocaleDateString()}`,
  ];

  return (
    <div
      data-testid="memory-card"
      className="p-3 rounded-lg border space-y-2 text-xs"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="neutral" size="sm">
            {isTypedVocabulary ? memory.memory_type : memory.memory_type || 'FACT'}
          </Badge>
          {/* §50 — scope icon + text, not color-only */}
          <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {memory.scope_type === 'USER_PRIVATE' && <Lock className="w-2.5 h-2.5" aria-hidden="true" />}
            {memory.scope_type === 'GROUP' && <Users className="w-2.5 h-2.5" aria-hidden="true" />}
            {memory.scope_type === 'PROJECT' && <Folder className="w-2.5 h-2.5" aria-hidden="true" />}
            {memory.scope_type === 'USER_PRIVATE' ? 'Private' : memory.scope_type}
          </span>
        </div>
      </div>
      <p style={{ color: 'var(--color-text)' }}>{memory.content}</p>
      <ul className="pt-1 border-t text-[10px] flex flex-wrap gap-x-3 gap-y-0.5" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}>
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
