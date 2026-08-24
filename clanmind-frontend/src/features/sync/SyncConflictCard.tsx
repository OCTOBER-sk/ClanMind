import React, { useState } from 'react';
import { AlertTriangle, GitCompare, RotateCcw, Trash2, GitMerge } from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import type { SyncConflict, SyncResolutionStrategy } from '@/types';

export interface SyncConflictCardProps {
  conflict: SyncConflict;
  onResolve: (conflictId: string, strategy: SyncResolutionStrategy) => void;
}

/** §186A.3 — conflict_type drives different copy, not one generic message */
export function SyncConflictCard({ conflict, onResolve }: SyncConflictCardProps) {
  const [showDiff, setShowDiff] = useState(false);

  const getConflictCopy = () => {
    switch (conflict.conflict_type) {
      case 'version_mismatch':
        return {
          title: 'Version Mismatch',
          description: 'This was updated by someone else while you were offline.',
        };
      case 'concurrent_edit':
        return {
          title: 'Concurrent Edit',
          description: 'You and someone else both changed this.',
        };
      case 'deleted_upstream':
        return {
          title: 'Deleted Upstream',
          description: 'This was deleted by someone else while you were offline.',
        };
    }
  };

  const { title, description } = getConflictCopy();

  return (
    <div
      className="p-4 rounded-xl border text-xs space-y-3 shadow-[var(--shadow-sm)]"
      style={{ borderColor: 'var(--color-warning)', background: 'var(--color-warning-bg)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--color-warning)' }}>
          <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          <span>{title}</span>
        </div>
        <span
          className="text-[10px] uppercase font-mono px-2 py-0.5 rounded"
          style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
        >
          {conflict.entity_type}
        </span>
      </div>

      <p className="leading-relaxed" style={{ color: 'var(--color-text)' }}>
        {description}
      </p>

      {/* §186: Your version / Remote version comparison */}
      {showDiff && (
        <div
          className="grid grid-cols-2 gap-2 p-3 rounded-lg border font-mono text-[10px]"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
        >
          <div>
            <span className="font-sans font-bold block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Your Version (Local)
            </span>
            <pre
              className="overflow-x-auto p-2 rounded"
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}
            >
              {JSON.stringify(conflict.local_payload, null, 2)}
            </pre>
          </div>
          <div>
            <span className="font-sans font-bold block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Remote Version (Server)
            </span>
            <pre
              className="overflow-x-auto p-2 rounded"
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}
            >
              {JSON.stringify(conflict.server_payload, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* §186A.3/4 — narrower action set for deleted_upstream; merged strategy for edits */}
      <div
        className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t"
        style={{ borderColor: 'var(--color-warning)' }}
      >
        {conflict.conflict_type === 'deleted_upstream' ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => onResolve(conflict.id, 'server_wins')}
            >
              Discard mine
            </Button>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => onResolve(conflict.id, 'manual')}
            >
              Restore mine as new
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<GitCompare className="w-3.5 h-3.5" />}
              onClick={() => setShowDiff(!showDiff)}
            >
              {showDiff ? 'Hide Compare' : 'Compare'}
            </Button>
            {/* §186A.4: Compare → manual merge where the type supports it */}
            {showDiff && (
              <Button
                size="sm"
                variant="outline"
                leftIcon={<GitMerge className="w-3.5 h-3.5" />}
                onClick={() => onResolve(conflict.id, 'merged')}
              >
                Merge manually
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onResolve(conflict.id, 'client_wins')}
            >
              Keep mine
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => onResolve(conflict.id, 'server_wins')}
            >
              Use remote
            </Button>
          </>
        )}
      </div>
    </div>
  );
}