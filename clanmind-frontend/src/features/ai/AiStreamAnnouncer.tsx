/**
 * FE §218 — Accessibility of AI Streaming.
 *
 * Announces EXACTLY the run lifecycle: started / completed / failed (and
 * stopped, a meaningful aggregate state per §217). Never per-token text:
 * streamed content renders with no aria-live semantics anywhere near it.
 *
 * The announcement is synced from run state in an effect — the canonical
 * live-region pattern (each run+status pair announced once; the message
 * persists until the next lifecycle transition).
 */

import { useEffect, useRef, useState } from 'react';
import type { AiRun } from '@/types';

export interface AiStreamAnnouncerProps {
  aiName?: string;
  /** Live runs keyed by AI message id (§134A). */
  runsByMessage: Record<string, AiRun>;
}

type Lifecycle = 'started' | 'completed' | 'failed' | 'stopped';

function lifecycleOf(status: AiRun['status']): Lifecycle | null {
  switch (status) {
    case 'RUNNING':
    case 'WAITING_TOOL':
    case 'STREAMING':
      return 'started';
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
      return 'stopped';
    default:
      return null; // QUEUED is pre-announce; nothing to say yet
  }
}

function textFor(phase: Lifecycle, aiName: string): string {
  switch (phase) {
    case 'started':
      return `${aiName} started responding`;
    case 'completed':
      return `${aiName} completed the response`;
    case 'failed':
      return `${aiName} failed to respond`;
    case 'stopped':
      return `${aiName} stopped`;
  }
}

export function AiStreamAnnouncer({ aiName = 'Odin', runsByMessage }: AiStreamAnnouncerProps) {
  const [announcement, setAnnouncement] = useState('');
  /** One announcement per run+status pair — transitions never re-fire. */
  const seenRef = useRef(new Set<string>());

  useEffect(() => {
    for (const [messageId, run] of Object.entries(runsByMessage)) {
      if (!run) continue;
      // Prefer the server-assigned run id, but tolerate the local shell id
      // so announcements work before the first socket event binds a real id.
      const key = `${run.id || messageId}:${run.status}`;
      const phase = lifecycleOf(run.status);
      if (!phase || seenRef.current.has(key)) continue;
      seenRef.current.add(key);
      setAnnouncement(textFor(phase, aiName));
      return; // one message per pass keeps screen-reader output calm
    }
  }, [runsByMessage, aiName]);

  return (
    <span className="sr-only" role="status" aria-live="polite">
      {announcement}
    </span>
  );
}
