/**
 * Decisions endpoint module — the ONLY REST site for the BE §110 decision
 * surface (FE §9 layer boundary):
 *
 *   GET  /api/v1/projects/:projectId/decisions  → { items: Decision[] }
 *   POST /api/v1/projects/:projectId/decisions  → 201 Decision {title, context?}
 *   GET  /api/v1/decisions/:decisionId          → Decision
 *   POST /api/v1/decisions/:decisionId/approve  → Decision {expected_version}   (§21.2 CAS)
 *   POST /api/v1/decisions/:decisionId/reject   → {ok}      {expected_version}
 *
 * Approve is a PROPOSED→APPROVED transition bound to `expected_version`;
 * a stale version answers 409 CONFLICT ("Decision changed; reload and
 * retry."). Server-side, approving also supersedes the Project's other
 * APPROVED decisions and promotes the row to a high-priority memory
 * candidate (BE §134) — the client refetches to see either effect.
 */

import { z } from 'zod';
import { api } from '@/api/client';
import { DecisionListSchema, DecisionSchema } from '@/api/schemas';
import type { Decision } from '@/types';

type DecisionRow = z.infer<typeof DecisionSchema>;

/** Map a validated §47 row into the canonical FE Decision. */
export function mapDecisionRow(row: DecisionRow): Decision {
  return {
    id: row.id,
    project_id: row.project_id,
    title: row.title,
    context: row.context ?? null,
    options: row.options ?? null,
    selected_option: row.selected_option ?? null,
    rationale: row.rationale ?? null,
    status: row.status as Decision['status'],
    version: row.version,
    proposed_by: row.proposed_by ?? null,
    approved_by: row.approved_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    approved_at: row.approved_at ?? null,
    sources:
      Array.isArray((row as Record<string, unknown>).sources) &&
      ((row as Record<string, unknown>).sources as unknown[]).every((s) => typeof s === 'string')
        ? ((row as Record<string, unknown>).sources as string[])
        : undefined,
  };
}

function mapList(raw: unknown): Decision[] {
  const page = DecisionListSchema.safeParse(raw);
  if (!page.success) return [];
  return (page.data.items ?? []).flatMap((row) => {
    const parsed = DecisionSchema.safeParse(row);
    return parsed.success ? [mapDecisionRow(parsed.data)] : [];
  });
}

function mapOne(raw: unknown): Decision {
  const parsed = DecisionSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Decision response failed schema validation.');
  return mapDecisionRow(parsed.data);
}

/** BE §110 — list a Project's decision log. */
export async function fetchProjectDecisions(projectId: string): Promise<Decision[]> {
  const raw = await api.get(`/projects/${encodeURIComponent(projectId)}/decisions`);
  return mapList(raw);
}

export interface ProposeDecisionInput {
  title: string;
  context?: string | null;
  /**
   * §122 prefilled options. The §47 table carries an `options` jsonb column
   * but the real create handler does not parse it yet (same shape of gap as
   * message `attachment_ids`, D16/D22): the field rides the POST body, the
   * demo persists it, live mode drops it silently until the backend accepts
   * it — never fabricated by the client afterwards.
   */
  options?: Array<{ label: string }> | null;
}

/**
 * POST propose — always lands status PROPOSED (§122 default); the server
 * stamps proposed_by from the session.
 */
export async function proposeDecision(
  projectId: string,
  input: ProposeDecisionInput,
): Promise<Decision> {
  const raw = await api.post(`/projects/${encodeURIComponent(projectId)}/decisions`, input);
  return mapOne(raw);
}

/** GET one decision. */
export async function fetchDecision(decisionId: string): Promise<Decision> {
  const raw = await api.get(`/decisions/${encodeURIComponent(decisionId)}`);
  return mapOne(raw);
}

/** Approve with §21.2 CAS — stale expected_version → 409 CONFLICT. */
export async function approveDecision(
  decisionId: string,
  expectedVersion: number,
): Promise<Decision> {
  const raw = await api.post(`/decisions/${encodeURIComponent(decisionId)}/approve`, {
    expected_version: expectedVersion,
  });
  return mapOne(raw);
}

/** Reject with the same CAS guard — terminal REJECTED. */
export async function rejectDecision(decisionId: string, expectedVersion: number): Promise<void> {
  await api.post(`/decisions/${encodeURIComponent(decisionId)}/reject`, {
    expected_version: expectedVersion,
  });
}
