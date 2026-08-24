import React, { useMemo, useState } from 'react';
import { Dialog } from '@/design-system/components/Dialog';
import { Button } from '@/design-system/components/Button';
import { Textarea } from '@/design-system/components/Textarea';
import { Checkbox } from '@/design-system/components/Checkbox';
import { useToast } from '@/design-system/components/Toast';
import { useMeetingStore } from '@/state/useMeetingStore';
import { useGroupStore } from '@/state/useGroupStore';
import { errorMessageOf } from '@/features/github/useGithubConnection';
import { candidateTitle, startProjectMeeting } from '@/api/endpoints/meetings';
import { getDemoRuntime } from '@/mocks/runtime';
import type { MeetingCandidate } from '@/types';

/**
 * §126 — Start Meeting Mode confirmation.
 * Starting hits the REAL §112 endpoint (`POST /projects/:projectId/meetings`,
 * body `{}`) — a meeting without an active Project context cannot start,
 * because every §112 session is project-scoped server-side. Group/project
 * context comes from the active selection (§11: no fixture IDs in runtime
 * code); optional props let callers pin a specific scope.
 */
export function MeetingStartDialog({ projectId }: { projectId?: string }) {
  const { isStartDialogOpen, setStartDialogOpen, setSession } = useMeetingStore();
  const storeProjectId = useGroupStore((s) => s.activeProject?.id);
  const { toast } = useToast();
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    const pid = projectId ?? storeProjectId;
    if (!pid) {
      toast({
        title: 'Open a project context first',
        description: 'Meetings are scoped to a Project.',
      });
      return;
    }
    setStarting(true);
    try {
      // BE §112 — the server row is authoritative; the client derives the
      // timer presentation from its own clock after this confirms.
      const session = await startProjectMeeting(pid);
      setSession(session);
      // §124A demo richness hook lives in the runtime seam (null registry in
      // production); it feeds candidates through the SAME §50A detect route.
      getDemoRuntime()?.seedMeeting(session.id);
    } catch (err) {
      toast({ title: 'Could not start the meeting', description: errorMessageOf(err) });
    } finally {
      setStarting(false);
    }
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
          <Button size="sm" variant="primary" loading={starting} onClick={() => void handleStart()}>
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
  /** §124A.2 — promote a DECISION/TASK candidate through the real endpoint. */
  onAcceptCandidate: (candidate: MeetingCandidate) => Promise<void>;
  /**
   * §112/§73 — POST /meetings/:id/end with the confirmed summary_text.
   * `saveArtifact` is the §128 "becomes a Garage artifact if chosen" choice.
   * Resolve = session ended server-side; reject/throw keeps the review open.
   */
  onEndMeeting: (summaryText: string, saveArtifact: boolean) => Promise<boolean>;
}

/**
 * §127/§128 Meeting end summary + §124A.3 review.
 * The session stays ACTIVE until "Review & Save" posts `end`; PENDING
 * candidates are reviewed here first — only explicit skips become EXPIRED
 * client-side before the server retires the rest.
 */
export function MeetingEndSummaryDialog({ onAcceptCandidate, onEndMeeting }: MeetingEndSummaryProps) {
  const {
    isEndSummaryDialogOpen,
    setEndSummaryDialogOpen,
    currentSession,
    candidates,
    patchCandidate,
  } = useMeetingStore();
  const { toast } = useToast();

  const [savingId, setSavingId] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const pending = candidates.filter((c) => c.status === 'PENDING');
  const accepted = candidates.filter((c) => c.status === 'ACCEPTED');
  const dismissedCount = candidates.filter((c) => c.status === 'REJECTED').length;

  // §127 counts — what the meeting produced (confirmed + still-open).
  const counts = useMemo(() => {
    const tally = (type: MeetingCandidate['candidate_type']) =>
      [...accepted, ...pending].filter((c) => c.candidate_type === type).length;
    return [
      ['Decisions', tally('DECISION')],
      ['Tasks', tally('TASK')],
      ['Questions', tally('OPEN_QUESTION')],
      ['Research', tally('RESEARCH_NEED')],
    ] as const;
  }, [accepted, pending]);

  // Deterministic draft — never fabricated content: titles + live notes only.
  const defaultSummary = useMemo(() => {
    const lines: string[] = [];
    if (accepted.length > 0) {
      lines.push(
        ...accepted.map(
          (c) => `${c.candidate_type === 'TASK' ? 'Task' : c.candidate_type === 'DECISION' ? 'Decision' : 'Item'} confirmed: ${candidateTitle(c.content)}`,
        ),
      );
    }
    if (pending.length > 0) {
      lines.push(`${pending.length} open item${pending.length === 1 ? '' : 's'} left unresolved.`);
    }
    return lines.join('\n');
  }, [accepted, pending]);

  const [summaryText, setSummaryText] = useState('');
  // §128 — "should become a Garage artifact if chosen": the choice is the
  // user's, defaulting to saved.
  const [saveArtifact, setSaveArtifact] = useState(true);

  const handleSaveCandidate = async (cand: MeetingCandidate) => {
    setSavingId(cand.id);
    try {
      await onAcceptCandidate(cand);
    } finally {
      setSavingId(null);
    }
  };

  // §124A.3: explicit skip → EXPIRED (the server expires the rest at end).
  const handleSkip = (id: string) =>
    patchCandidate(id, { status: 'EXPIRED', resolved_at: new Date().toISOString() });

  const handleReviewAndSave = async () => {
    const text = summaryText.trim() || defaultSummary.trim();
    if (!currentSession || !text) {
      toast({ title: 'Add a short summary before saving.' });
      return;
    }
    setEnding(true);
    try {
      const done = await onEndMeeting(text, saveArtifact);
      if (done) setEndSummaryDialogOpen(false);
    } finally {
      setEnding(false);
    }
  };

  return (
    <Dialog
      open={isEndSummaryDialogOpen}
      onOpenChange={(open) => {
        // Closing without saving keeps the meeting ACTIVE (§213) — ending is
        // only real once POST /end confirms.
        if (!ending) setEndSummaryDialogOpen(open);
      }}
      title="Meeting summary"
      maxWidth="lg"
      footer={
        <>
          <Button
            size="sm"
            variant="primary"
            loading={ending}
            onClick={() => void handleReviewAndSave()}
          >
            Review &amp; Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* §127 summary counts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {counts.map(([label, value]) => (
            <div
              key={label}
              className="p-3 rounded-lg border text-center"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
            >
              <div className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                {value}
              </div>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                {label}
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
                  {candidateTitle(cand.content)}
                </span>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => handleSkip(cand.id)}>
                    Skip
                  </Button>
                  {(cand.candidate_type === 'DECISION' || cand.candidate_type === 'TASK') && (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={savingId === cand.id}
                      onClick={() => void handleSaveCandidate(cand)}
                    >
                      Save
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* §128 — human-confirmed summary text (BE endMeetingBody.summary_text) */}
        <div className="space-y-1.5">
          <label
            htmlFor="meeting-summary-text"
            className="text-xs font-semibold block"
            style={{ color: 'var(--color-text)' }}
          >
            Summary
          </label>
          <Textarea
            id="meeting-summary-text"
            rows={5}
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            placeholder={defaultSummary || 'What did the group decide and take on?'}
            className="text-xs w-full"
          />
          <label
            htmlFor="meeting-save-artifact"
            className="flex items-center gap-2 text-xs cursor-pointer select-none"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Checkbox
              id="meeting-save-artifact"
              checked={saveArtifact}
              onCheckedChange={(v) => setSaveArtifact(v === true)}
            />
            Save summary to Garage as an artifact
          </label>
        </div>

        {dismissedCount > 0 && (
          <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {dismissedCount} candidate{dismissedCount === 1 ? '' : 's'} were dismissed during
            the meeting and will not be included.
          </p>
        )}
      </div>
    </Dialog>
  );
}
