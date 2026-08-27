import React, { useState } from 'react';
import {
  Video,
  X,
  AlertTriangle,
  HelpCircle,
  Check,
  Search,
  Milestone,
  Bookmark,
  CheckSquare,
  Undo2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { candidateTitle } from '@/api/endpoints/meetings';
import type { MeetingCandidate } from '@/types';

/**
 * §124 Meeting Panel + §124A candidate lifecycle (rows are BE §50A).
 *   DECISION         → Potential decisions
 *   TASK             → Action items
 *   OPEN_QUESTION    → Open questions
 *   CONTRADICTION    → inline distinct treatment (§124A.1)
 *   RESEARCH_NEED    → Odin suggestions + /research shortcut
 *   MILESTONE_CHANGE → Project Pulse-style inline note
 * Statuses: PENDING active · ACCEPTED compact confirmed row · REJECTED
 *           recoverable from "Dismissed" · MERGED subtle note · EXPIRED
 *           removed silently (§124A.2).
 */

export interface MeetingPanelProps {
  candidates: MeetingCandidate[];
  liveNotes: string[];
  aiName: string;
  /** §124A.2 — resolve (create decision/task) and only then mark ACCEPTED */
  onAcceptCandidate: (candidate: MeetingCandidate) => Promise<void>;
  /**
   * §124 "Edit" — persist the refinement as a NEW §50A candidate row (the
   * only honest write path: POST /meetings/:id/candidates); the original is
   * then marked MERGED client-side (§124A.2 subtle note).
   */
  onEditCandidate: (id: string, title: string) => Promise<void>;
  onDismissCandidate: (id: string) => void;
  onRestoreCandidate: (id: string) => void;
  onAddNote: (note: string) => void;
  /** §124A.1 — pre-fill the composer with a research request */
  onResearchShortcut: (topic: string) => void;
  /** §124A.2 — navigate to the promoted decision/task */
  onOpenPromoted: (type: 'decision' | 'task', id: string) => void;
  onClose: () => void;
}

const TYPE_LABEL: Record<MeetingCandidate['candidate_type'], string> = {
  DECISION: 'Potential decision',
  TASK: 'Action item',
  OPEN_QUESTION: 'Open question',
  CONTRADICTION: 'Contradiction',
  RESEARCH_NEED: 'Odin suggestion',
  MILESTONE_CHANGE: 'Milestone change',
};

export function MeetingPanel({
  candidates,
  liveNotes,
  aiName,
  onAcceptCandidate,
  onEditCandidate,
  onDismissCandidate,
  onRestoreCandidate,
  onAddNote,
  onResearchShortcut,
  onOpenPromoted,
  onClose,
}: MeetingPanelProps) {
  const [noteInput, setNoteInput] = useState('');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  // §124 Edit — inline refinement of a pending candidate's headline.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const active = candidates.filter((c) => c.status === 'PENDING');
  const accepted = candidates.filter((c) => c.status === 'ACCEPTED');
  const merged = candidates.filter((c) => c.status === 'MERGED');
  const dismissed = candidates.filter((c) => c.status === 'REJECTED');
  // EXPIRED (§124A.2): removed silently — never rendered anywhere.

  const decisions = active.filter((c) => c.candidate_type === 'DECISION');
  const tasks = active.filter((c) => c.candidate_type === 'TASK');
  const questions = active.filter((c) => c.candidate_type === 'OPEN_QUESTION');
  const contradictions = active.filter((c) => c.candidate_type === 'CONTRADICTION');
  const researchNeeds = active.filter((c) => c.candidate_type === 'RESEARCH_NEED');
  const milestoneChanges = active.filter((c) => c.candidate_type === 'MILESTONE_CHANGE');

  const handleAddNote = () => {
    if (!noteInput.trim()) return;
    onAddNote(noteInput.trim());
    setNoteInput('');
  };

  // §124A.2: wait for backend confirmation before showing ACCEPTED
  const handleAccept = async (cand: MeetingCandidate) => {
    setAcceptingId(cand.id);
    try {
      await onAcceptCandidate(cand);
    } finally {
      setAcceptingId(null);
    }
  };

  // §124 Edit — the replacement candidate is a real server row; the panel
  // re-renders from the store (original → MERGED, edited row → PENDING).
  const handleSaveEdit = async (cand: MeetingCandidate) => {
    const title = editDraft.trim();
    if (!title) return;
    setSavingEdit(true);
    try {
      await onEditCandidate(cand.id, title);
      setEditingId(null);
      setEditDraft('');
    } finally {
      setSavingEdit(false);
    }
  };

  const sectionTitle = (label: string, count: number) => (
    <h4
      className="font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {label} ({count})
    </h4>
  );

  const pendingActions = (cand: MeetingCandidate, acceptLabel: string) => (
    <div className="flex items-center justify-end gap-1.5 pt-1.5">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setEditingId(cand.id);
          setEditDraft(candidateTitle(cand.content));
        }}
        aria-label={`Edit ${candidateTitle(cand.content)}`}
      >
        Edit
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onDismissCandidate(cand.id)} aria-label={`Dismiss ${candidateTitle(cand.content)}`}>
        Dismiss
      </Button>
      <Button
        size="sm"
        variant="primary"
        loading={acceptingId === cand.id}
        leftIcon={acceptingId !== cand.id ? <Check className="w-3.5 h-3.5" /> : undefined}
        onClick={() => handleAccept(cand)}
        aria-label={`${acceptLabel}: ${candidateTitle(cand.content)}`}
      >
        {acceptLabel}
      </Button>
    </div>
  );

  // §124 Edit — inline editor replacing the card body while active.
  const editBody = (cand: MeetingCandidate) => (
    <div className="space-y-2 pt-1">
      <textarea
        value={editDraft}
        onChange={(e) => setEditDraft(e.target.value)}
        rows={2}
        aria-label={`Edit candidate: ${candidateTitle(cand.content)}`}
        className="w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none resize-none select-text"
        style={{
          borderColor: 'var(--color-border-strong)',
          background: 'var(--color-surface-raised)',
          color: 'var(--color-text)',
        }}
        autoFocus
      />
      <div className="flex items-center justify-end gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditingId(null);
            setEditDraft('');
          }}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          loading={savingEdit}
          disabled={!editDraft.trim()}
          onClick={() => void handleSaveEdit(cand)}
        >
          Save changes
        </Button>
      </div>
    </div>
  );

  // §124A.2 ACCEPTED → compact confirmed row pointing at the real object
  // (`promoted_to_type` is the BE §50A lowercase 'decision'|'task').
  const confirmedRow = (cand: MeetingCandidate) => (
    <div
      key={cand.id}
      className="p-2.5 rounded-lg border flex items-center gap-2"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-success-bg)' }}
    >
      <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-success)' }} aria-hidden="true" />
      <span className="flex-1 min-w-0 truncate text-xs" style={{ color: 'var(--color-text)' }}>
        {candidateTitle(cand.content)}
      </span>
      {cand.promoted_to_type && cand.promoted_to_id && (
        <button
          onClick={() => onOpenPromoted(cand.promoted_to_type as 'decision' | 'task', cand.promoted_to_id!)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold cursor-pointer hover:underline shrink-0"
          style={{ color: 'var(--color-info)' }}
        >
          <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
          {cand.promoted_to_type === 'task' ? 'View task' : 'View decision'}
        </button>
      )}
    </div>
  );

  const mergedNote = (cand: MeetingCandidate) => (
    <div
      key={cand.id}
      className="p-2 rounded-lg text-[10px] italic"
      style={{ color: 'var(--color-text-tertiary)' }}
    >
      Merged into another candidate.
    </div>
  );

  return (
    <div
      className="flex flex-col h-full border-l text-xs"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4" style={{ color: 'var(--color-danger)' }} aria-hidden="true" />
          <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
            Meeting Facilitation Panel
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close meeting panel"
          className="p-1 cursor-pointer hover:opacity-80"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Live Notes (§124) */}
        <div className="space-y-2">
          {sectionTitle('Live Notes', liveNotes.length)}
          <div className="space-y-1.5">
            {liveNotes.map((note, index) => (
              <div
                key={index}
                className="p-2 rounded text-xs"
                style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}
              >
                • {note}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddNote();
              }}
              placeholder="Add quick meeting note…"
              aria-label="Add a live meeting note"
              className="flex-1 px-3 py-1.5 rounded-lg border text-xs outline-none"
              style={{
                borderColor: 'var(--color-border-strong)',
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text)',
              }}
            />
            <Button size="sm" variant="secondary" onClick={handleAddNote} aria-label="Add meeting note">
              Add
            </Button>
          </div>
        </div>

        {/* §124A.1 Contradictions — distinct inline treatment */}
        {contradictions.length > 0 && (
          <div className="space-y-2">
            {sectionTitle('Contradictions Detected', contradictions.length)}
            {contradictions.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-lg border space-y-2"
                style={{
                  borderColor: 'var(--color-warning)',
                  background: 'var(--color-warning-bg)',
                }}
              >
                <div className="flex items-center gap-1.5" style={{ color: 'var(--color-warning)' }}>
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="font-semibold">Two statements conflict</span>
                </div>
                <p className="leading-relaxed" style={{ color: 'var(--color-text)' }}>
                  {candidateTitle(c.content)}
                </p>
                {editingId === c.id ? editBody(c) : pendingActions(c, 'Clarify in Chat')}
              </div>
            ))}
          </div>
        )}

        {/* Potential decisions */}
        {decisions.length > 0 && (
          <div className="space-y-2">
            {sectionTitle('Potential Decisions', decisions.length)}
            {decisions.map((cand) => (
              <div
                key={cand.id}
                className="p-3 rounded-lg border space-y-2"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {candidateTitle(cand.content)}
                  </span>
                </div>
                {editingId === cand.id ? editBody(cand) : pendingActions(cand, 'Accept Decision')}
              </div>
            ))}
          </div>
        )}

        {/* Action items */}
        {tasks.length > 0 && (
          <div className="space-y-2">
            {sectionTitle('Action Items', tasks.length)}
            {tasks.map((cand) => (
              <div
                key={cand.id}
                className="p-3 rounded-lg border space-y-2"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {candidateTitle(cand.content)}
                  </span>
                </div>
                {editingId === cand.id ? editBody(cand) : pendingActions(cand, 'Create Task')}
              </div>
            ))}
          </div>
        )}

        {/* Open questions */}
        {questions.length > 0 && (
          <div className="space-y-2">
            {sectionTitle('Open Questions', questions.length)}
            {questions.map((cand) => (
              <div
                key={cand.id}
                className="p-3 rounded-lg border space-y-2"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {candidateTitle(cand.content)}
                  </span>
                </div>
                {editingId === cand.id ? editBody(cand) : pendingActions(cand, 'Address in Meeting')}
              </div>
            ))}
          </div>
        )}

        {/* §124A.1 Odin suggestions (RESEARCH_NEED) with /research shortcut */}
        {researchNeeds.length > 0 && (
          <div className="space-y-2">
            {sectionTitle(`${aiName} Suggestions`, researchNeeds.length)}
            {researchNeeds.map((cand) => (
              <div
                key={cand.id}
                className="p-3 rounded-lg border space-y-2"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  <Search className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {candidateTitle(cand.content)}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => onDismissCandidate(cand.id)}>
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    onClick={() => onResearchShortcut(candidateTitle(cand.content))}
                    aria-label={`Research: ${candidateTitle(cand.content)}`}
                  >
                    /research
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* §124A.1 Milestone changes — Project Pulse-style inline note */}
        {milestoneChanges.length > 0 && (
          <div className="space-y-2">
            {sectionTitle('Milestone Notes', milestoneChanges.length)}
            {milestoneChanges.map((cand) => (
              <div
                key={cand.id}
                className="p-3 rounded-lg border"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-info-bg)' }}
              >
                <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--color-info)' }}>
                  <Milestone className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="font-semibold text-[10px] uppercase tracking-wide">
                    Project Pulse
                  </span>
                </div>
                <p className="leading-relaxed" style={{ color: 'var(--color-text)' }}>
                  {candidateTitle(cand.content)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* §124A.2 Accepted — compact confirmed rows */}
        {accepted.length > 0 && (
          <div className="space-y-1.5">
            {sectionTitle('Confirmed', accepted.length)}
            {accepted.map(confirmedRow)}
          </div>
        )}

        {/* §124A.2 Merged — subtle notes */}
        {merged.length > 0 && (
          <div className="space-y-1">{merged.map(mergedNote)}</div>
        )}

        {/* §124A.2 Dismissed sub-list — recoverable within the session */}
        {dismissed.length > 0 && (
          <div className="space-y-1.5">
            <button
              onClick={() => setShowDismissed((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer hover:opacity-80"
              style={{ color: 'var(--color-text-secondary)' }}
              aria-expanded={showDismissed}
            >
              {showDismissed ? (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              Dismissed ({dismissed.length})
            </button>
            {showDismissed &&
              dismissed.map((cand) => (
                <div
                  key={cand.id}
                  className="p-2.5 rounded-lg border flex items-center gap-2 opacity-80"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                >
                  <span className="flex-1 min-w-0 truncate text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {TYPE_LABEL[cand.candidate_type]}: {candidateTitle(cand.content)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<Undo2 className="w-3 h-3" />}
                    onClick={() => onRestoreCandidate(cand.id)}
                    aria-label={`Restore ${candidateTitle(cand.content)}`}
                  >
                    Restore
                  </Button>
                </div>
              ))}
          </div>
        )}

        {/* Empty active panel */}
        {active.length === 0 && (
          <div
            className="text-center py-10 space-y-1"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <p className="text-sm font-medium">No open candidates.</p>
            <p className="text-xs">{aiName} will surface decisions, tasks and questions here.</p>
          </div>
        )}
      </div>
    </div>
  );
}