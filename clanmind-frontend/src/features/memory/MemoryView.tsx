import React, { useState } from 'react';
import { Sparkles, Check, Plus } from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import type { MemoryEntry } from '@/types';

export interface MemoryViewProps {
  memories: MemoryEntry[];
  memoryCandidates: Array<{ id: string; content: string; scope: string }>;
  onSaveCandidate: (candidateId: string) => void;
  onDismissCandidate: (candidateId: string) => void;
  onAddMemory: () => void;
}

export function MemoryView({
  memories,
  memoryCandidates,
  onSaveCandidate,
  onDismissCandidate,
  onAddMemory,
}: MemoryViewProps) {
  const [activeTab, setActiveTab] = useState<'project' | 'group' | 'private'>('project');

  const filteredMemories = memories.filter((m) => {
    if (activeTab === 'project') return m.scope === 'PROJECT';
    if (activeTab === 'group') return m.scope === 'GROUP';
    return m.scope === 'USER_PRIVATE';
  });

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-raised)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Project & Team Memory</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Persistent context, technical conventions, constraints, and lessons retained across sessions.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={onAddMemory}
        >
          Add Memory
        </Button>
      </div>

      {/* Odin Memory Candidates Notice (Â§117) */}
      {memoryCandidates.length > 0 && (
        <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/60 text-xs">
          <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 mb-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Odin noticed potential memories from recent conversation</span>
          </div>

          <div className="space-y-2">
            {memoryCandidates.map((cand) => (
              <div
                key={cand.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-raised)] border border-amber-200 dark:border-amber-800 shadow-2xs"
              >
                <p className="font-medium text-[var(--color-text)] pr-2">
                  â€œ{cand.content}â€
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDismissCandidate(cand.id)}
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                    onClick={() => onSaveCandidate(cand.id)}
                  >
                    Save Memory
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-6 pt-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-4">
          {(['project', 'group', 'private'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-xs font-semibold capitalize border-b-2 transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {tab} Memory
            </button>
          ))}
        </div>
      </div>

      {/* Memories List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {filteredMemories.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs">
            No memories in this scope yet.
          </div>
        ) : (
          filteredMemories.map((mem) => (
            <div
              key={mem.id}
              className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-2xs space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--color-text)]">
                  {mem.title}
                </span>
                <Badge variant="neutral" size="sm">
                  {mem.entry_type}
                </Badge>
              </div>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                {mem.content}
              </p>
              {mem.source && (
                <div className="text-[10px] text-gray-400 pt-1">
                  Source: {mem.source}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
