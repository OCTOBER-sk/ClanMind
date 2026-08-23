import React from 'react';
import { Bookmark, Plus } from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import type { Decision } from '@/types';

export interface DecisionsViewProps {
  decisions: Decision[];
  onAddDecision: () => void;
}

export function DecisionsView({ decisions, onAddDecision }: DecisionsViewProps) {
  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-raised)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Project Decisions</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Immutable architectural and engineering decisions recorded by the team and Odin.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={onAddDecision}
        >
          Propose Decision
        </Button>
      </div>

      {/* Decisions List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {decisions.map((dec) => (
          <div
            key={dec.id}
            className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-xs space-y-3 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-bold text-sm text-[var(--color-text)]">
                  Decision #{dec.decision_number}: {dec.title}
                </span>
              </div>
              <Badge
                variant={dec.status === 'APPROVED' ? 'success' : 'warning'}
                size="sm"
              >
                {dec.status}
              </Badge>
            </div>

            {dec.context && (
              <div>
                <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">
                  Context & Problem
                </span>
                <p className="text-[var(--color-text-secondary)] leading-relaxed">
                  {dec.context}
                </p>
              </div>
            )}

            {dec.reason && (
              <div>
                <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">
                  Rationale
                </span>
                <p className="text-[var(--color-text-secondary)] leading-relaxed font-medium">
                  {dec.reason}
                </p>
              </div>
            )}

            {dec.sources && dec.sources.length > 0 && (
              <div className="pt-2 border-t border-[var(--color-border)] text-[10px] text-gray-400">
                <span>Sources: {dec.sources.join(' â€¢ ')}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
              <span>Approved by {dec.approved_by_name || 'Admin'}</span>
              <span>{new Date(dec.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
