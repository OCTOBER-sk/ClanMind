import React, { useState } from 'react';
import { Dialog } from '@/design-system/components/Dialog';
import { Button } from '@/design-system/components/Button';
import { useMeetingStore } from '@/state/useMeetingStore';
import { useGroupStore } from '@/state/useGroupStore';
import { getDemoRuntime } from '@/mocks/runtime';
import type { MeetingCandidate } from '@/types';

/**
 * §126 — Start Meeting Mode confirmation.
 * Group/project context comes from the active selection (§11: no fixture IDs
 * in runtime code). Optional props let callers pin a specific scope.
 */
export function MeetingStartDialog({ groupId, projectId }: { groupId?: string; projectId?: string }) {
  const { isStartDialogOpen, setStartDialogOpen, startMeeting } = useMeetingStore();
  const storeGroupId = useGroupStore((s) => s.activeGroup?.id);
  const storeProjectId = useGroupStore((s) => s.activeProject?.id);

  // §124A demo richness hook lives in the runtime seam; production builds get
  // a null registry here (see mocks/runtime.ts).
  const handleStart = () => {
    const gid = groupId ?? storeGroupId;
    if (!gid) return;
    startMeeting(gid, projectId ?? storeProjectId ?? '');
    const sessionId = useMeetingStore.getState().currentSession?.id;
    if (sessionId) getDemoRuntime()?.seedMeeting(sessionId);
  };

  return (
    <Dialog
      open={isStartDialogOpen}
      onOpenChange={setStartDialogOpen}
      title="Start Meeting Mode?"
      description="Odin will actively facilitate decisions, tasks, questions and contradictions."
      maxWidth="sm"
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={() => setStartDialogOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={handleStart}>
            Start meeting
          </Button>
        </>
      }
    >
      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {`You can pause or end the meeting anytime. Nothing is saved until you review it.`}
      </p>
    </Dialog>
  );
}

export interface MeetingEndSummaryProps {
  onAcceptCandidate: (candidate: MeetingCandidate) => Promise<void>;
  onSaveSummary: () => void;
}

/**
 * §127/§128 Meeting end summary + §124A.3 review.
 * PENDING candidates are reviewed here — only explicit skips become EXPIRED.
 */
export function MeetingEndSummaryDialog({ onAcceptCandidate, onSaveSummary }: MeetingEndSummaryProps) {
  const {
    isEndSummaryDialogOpen,
    setEndSummaryDialogOpen,
    currentSession,
    updateCandidateStatus,
  } = useMeetingStore();

  const [savingId, setSavingId] = useState<string | null>(null);

  const pending = currentSession?.candidates.filter((c) => c.status === 'PENDING') ?? [];
  const accepted = currentSession?.candidates.filter((c) => c.status === 'ACCEPTED') ?? [];
  const dismissed = currentSession?.candidates.filter((c) => c.status === 'REJECTED') ?? [];

  const counts = {
    decisions: accepted.filter((c) => c.candidate_type === 'DECISION').length + pending.filter((c) => c.candidate_type === 'DECISION').length,
    tasks: accepted.filter((c) => c.candidate_type === 'TASK').length + pending.filter((c) => c.candidate_type === 'TASK').length,
    questions: pending.filter((c) => c.candidate_type === 'OPEN_QUESTION').length,
    research: pending.filter((c) => c.candidate_type === 'RESEARCH_NEED').length,
  };

  const handleSaveCandidate = async (cand: MeetingCandidate) => {
    setSavingId(cand.id);
    try {
      await onAcceptCandidate(cand);
    } finally {
      setSavingId(null);
    }
  };

  // §124A.3: explicit skip → EXPIRED
  const handleSkip = (id: string) => updateCandidateStatus(id, 'EXPIRED');

  return (
    <Dialog
      open={isEndSummaryDialogOpen}
      onOpenChange={setEndSummaryDialogOpen}
      title="Meeting summary"
      maxWidth="lg"
      footer={
        <>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              onSaveSummary();
              setEndSummaryDialogOpen(false);
            }}
          >
            Review &amp; Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* §127 summary counts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ['Decisions', counts.decisions],
            ['Tasks', counts.tasks],
            ['Questions', counts.questions],
            ['Research', counts.research],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="p-3 rounded-lg border text-center"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
            >
              <div className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                {value as number}
              </div>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                {label as string}
              </div>
            </div>
          ))}
        </div>

        {/* §124A.3 review — nothing silently expires */}
        {pending.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
              Review open candidates ({pending.length})
            </p>
            {pending.map((cand) => (
              <div
                key={cand.id}
                className="p-2.5 rounded-lg border flex items-center gap-2"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <span className="flex-1 min-w-0 text-xs truncate" style={{ color: 'var(--color-text)' }}>
                  {cand.content}
                </span>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => handleSkip(cand.id)}>
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    loading={savingId === cand.id}
                    onClick={() => handleSaveCandidate(cand)}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {dismissed.length > 0 && (
          <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {dismissed.length} candidate{dismissed.length === 1 ? '' : 's'} were dismissed during
            the meeting and will expire unless restored.
          </p>
        )}
      </div>
    </Dialog>
  );
}