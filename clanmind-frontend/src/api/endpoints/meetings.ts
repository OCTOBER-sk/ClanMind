/**
 * Meetings endpoint module — the ONLY REST site for the BE §112 meeting
 * surface plus the §50A candidate intake/acceptance extras (FE §9 layer
 * boundary). Shapes mirror apps/worker handlers/intel.ts exactly:
 *
 *   POST /api/v1/projects/:projectId/meetings                    → 201 MeetingSession   (§50)
 *   GET  /api/v1/meetings/:meetingId                             → { session, candidates }
 *   POST /api/v1/meetings/:meetingId/end {summary_text}          → { ok: true }         (§73)
 *   POST /api/v1/meetings/:meetingId/candidates                  → 201 MeetingCandidate (§50A detect)
 *        {candidate_type, content, confidence, source_message_id?}
 *   POST /api/v1/meetings/:meetingId/candidates/:cid/accept      → 201 { promoted_id }
 *        {promote: 'task' | 'decision'}                                                 (§124A.2)
 *
 * §124A.2: acceptance promotes SERVER-side (the Worker creates the real
 * decision/task row and stamps `promoted_to_type`/`promoted_to_id`); the FE
 * must wait for `{promoted_id}` before rendering the card as ACCEPTED —
 * never optimistically collapse.
 */

import { z } from 'zod';
import { api } from '@/api/client';
import {
  MeetingCandidateSchema,
  MeetingDetailSchema,
  MeetingSessionSchema,
} from '@/api/schemas';
import type { MeetingCandidate, MeetingCandidateType, MeetingSession } from '@/types';

function mapSession(raw: unknown): MeetingSession {
  const parsed = MeetingSessionSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Meeting session response failed schema validation.');
  const row = parsed.data;
  return {
    id: row.id,
    group_id: row.group_id,
    project_id: row.project_id ?? null,
    started_by: row.started_by,
    started_at: row.started_at,
    ended_at: row.ended_at ?? null,
    status: row.status === 'ENDED' ? 'ENDED' : 'ACTIVE',
    summary_artifact_id: row.summary_artifact_id ?? null,
  };
}

function mapCandidate(raw: unknown): MeetingCandidate {
  const parsed = MeetingCandidateSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Meeting candidate response failed schema validation.');
  const row = parsed.data;
  return {
    id: row.id,
    meeting_session_id: row.meeting_session_id,
    candidate_type: row.candidate_type as MeetingCandidate['candidate_type'],
    content: row.content,
    confidence: row.confidence,
    source_message_id: row.source_message_id ?? null,
    status: row.status as MeetingCandidate['status'],
    promoted_to_type: row.promoted_to_type ?? null,
    promoted_to_id: row.promoted_to_id ?? null,
    created_at: row.created_at,
    resolved_at: row.resolved_at ?? null,
  };
}

/** BE §112 — start a meeting session scoped to a Project. Body is `{}`. */
export async function startProjectMeeting(projectId: string): Promise<MeetingSession> {
  const raw = await api.post(`/projects/${encodeURIComponent(projectId)}/meetings`, {});
  return mapSession(raw);
}

/** BE §112 — fetch one session with its full candidate trail (§50A audit). */
export async function fetchMeeting(
  meetingId: string,
): Promise<{ session: MeetingSession; candidates: MeetingCandidate[] }> {
  const raw = await api.get(`/meetings/${encodeURIComponent(meetingId)}`);
  const parsed = MeetingDetailSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Meeting detail response failed schema validation.');
  return {
    session: mapSession(parsed.data.session),
    candidates: (parsed.data.candidates ?? []).map(mapCandidate),
  };
}

/**
 * BE §112/§73 — end the session with a human-confirmed summary_text.
 * The server expires any candidate still PENDING afterwards (§50A); the FE's
 * §124A.3 review flow runs BEFORE this call so skips are explicit.
 */
export async function endMeeting(meetingId: string, summaryText: string): Promise<void> {
  await api.post(`/meetings/${encodeURIComponent(meetingId)}/end`, {
    summary_text: summaryText,
  });
}

export interface DetectCandidateInput {
  candidate_type: MeetingCandidateType;
  content: Record<string, unknown>;
  /** 0..1 detector confidence (BE numeric(4,3) domain). */
  confidence: number;
  source_message_id?: string | null;
}

/** BE §50A extra — detection intake for an ACTIVE session (409 otherwise). */
export async function detectMeetingCandidate(
  meetingId: string,
  input: DetectCandidateInput,
): Promise<MeetingCandidate> {
  const raw = await api.post(`/meetings/${encodeURIComponent(meetingId)}/candidates`, {
    candidate_type: input.candidate_type,
    content: input.content,
    confidence: input.confidence,
    ...(input.source_message_id ? { source_message_id: input.source_message_id } : {}),
  });
  return mapCandidate(raw);
}

/**
 * BE §50A extra — accept a DECISION/TASK candidate; the backend creates the
 * real object and answers `{promoted_id}`. `promote` is lowercase on the
 * wire ('task' | 'decision') exactly as z.enum in acceptCandidateBody.
 */
export const AcceptPromoteSchema = z.enum(['task', 'decision']);

export async function acceptMeetingCandidate(
  meetingId: string,
  candidateId: string,
  promote: 'task' | 'decision',
): Promise<{ promoted_id: string }> {
  const bodyParsed = AcceptPromoteSchema.safeParse(promote);
  if (!bodyParsed.success) throw new Error('promote must be "task" or "decision".');
  const raw = await api.post(
    `/meetings/${encodeURIComponent(meetingId)}/candidates/${encodeURIComponent(candidateId)}/accept`,
    { promote: bodyParsed.data },
  );
  const parsed = z.object({ promoted_id: z.string().min(1) }).safeParse(raw);
  if (!parsed.success) throw new Error('Accept response failed schema validation.');
  return parsed.data;
}

/**
 * FE render helper — the headline of a §124 panel card from the §50A jsonb
 * content. The promote callback reads `title` (+ description/context), so
 * title wins; other detector payloads fall back through common keys and
 * finally to a JSON rendering rather than `[object Object]`.
 */
export function candidateTitle(content: Record<string, unknown>): string {
  for (const key of ['title', 'text', 'summary', 'question', 'description', 'context']) {
    const v = content[key];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  const firstString = Object.values(content).find((v) => typeof v === 'string');
  if (typeof firstString === 'string' && firstString.trim().length > 0) return firstString;
  try {
    return JSON.stringify(content);
  } catch {
    return 'Untitled candidate';
  }
}
