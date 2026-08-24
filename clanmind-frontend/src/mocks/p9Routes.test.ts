/**
 * P9 — demo REST parity for BE §112 meetings + the §50A candidate
 * intake/acceptance extras (handlers/intel.ts shapes).
 *
 * Contract points under test: project-scoped start returning a §50 session,
 * `{session, candidates}` detail reads, summary_text validation on end with
 * leftover-PENDING expiry, detect validation (candidate_type enum, 0..1
 * confidence) against ACTIVE sessions only, and accept promoting into REAL
 * task/decision rows with `promoted_to_type`/`promoted_to_id` recorded and
 * `{promoted_id}` returned — exactly what the real Worker answers.
 */

import { describe, it, expect } from 'vitest';
import { createDemoTransport } from '@/mocks/transportRoutes';
import { createDemoDataset } from '@/mocks/dataset';
import { MeetingCandidateSchema, MeetingSessionSchema } from '@/api/schemas';
import type { TransportRequest } from '@/api/transport';

function makeHarness() {
  const ds = createDemoDataset();
  const transport = createDemoTransport(ds);
  const send = (
    path: string,
    method: TransportRequest['method'] = 'GET',
    body?: unknown,
  ) => transport.send({ method, path, body });
  return { ds, send };
}

const PROJECT = 'proj_flight_ctrl';

async function startMeeting(send: ReturnType<typeof makeHarness>['send']) {
  const res = await send(`/api/v1/projects/${PROJECT}/meetings`, 'POST', {});
  expect(res.status).toBe(201);
  return (res.json as Record<string, string>).id!;
}

// ─── BE §112 session lifecycle ───────────────────────────────────────────────

describe('demo transport — BE §112 meeting sessions', () => {
  it('POST /projects/:id/meetings creates an ACTIVE §50 session scoped to the Project', async () => {
    const { ds, send } = makeHarness();
    const res = await send(`/api/v1/projects/${PROJECT}/meetings`, 'POST', {});
    expect(res.status).toBe(201);
    const parsed = MeetingSessionSchema.safeParse(res.json);
    expect(parsed.success).toBe(true);
    const row = parsed.data!;
    expect(row).toMatchObject({
      group_id: 'grp_robotics_1',
      project_id: PROJECT,
      status: 'ACTIVE',
      ended_at: null,
      summary_artifact_id: null,
    });
    expect(ds.meetingSessions).toHaveLength(1);

    // Project scoping is enforced server-side.
    const missing = await send('/api/v1/projects/proj_missing/meetings', 'POST', {});
    expect(missing.status).toBe(404);
    expect((missing.json as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });

  it('GET /meetings/:id returns {session, candidates} with the full §50A trail', async () => {
    const { send } = makeHarness();
    const id = await startMeeting(send);
    await send(`/api/v1/meetings/${id}/candidates`, 'POST', {
      candidate_type: 'DECISION',
      content: { title: 'Lock SPI bus' },
      confidence: 0.9,
    });

    const res = await send(`/api/v1/meetings/${id}`);
    expect(res.ok).toBe(true);
    const detail = res.json as { session: unknown; candidates: unknown[] };
    expect(MeetingSessionSchema.safeParse(detail.session).success).toBe(true);
    expect(detail.candidates).toHaveLength(1);
    for (const c of detail.candidates) {
      const parsed = MeetingCandidateSchema.safeParse(c);
      expect(parsed.success).toBe(true);
      // content is the jsonb record, not a string.
      expect(typeof parsed.data!.content).toBe('object');
    }

    const missing = await send('/api/v1/meetings/meet_ghost');
    expect(missing.status).toBe(404);
    expect((missing.json as { error: { message: string } }).error.message).toContain(
      'Meeting not found.',
    );
  });

  it('POST /meetings/:id/end validates summary_text like endMeetingBody and ENDED the session', async () => {
    const { ds, send } = makeHarness();
    const id = await startMeeting(send);

    const noText = await send(`/api/v1/meetings/${id}/end`, 'POST', {});
    expect(noText.status).toBe(400);
    expect((noText.json as { error: { message: string } }).error.message).toBe(
      'summary_text is required.',
    );

    const okEnd = await send(`/api/v1/meetings/${id}/end`, 'POST', {
      summary_text: 'Locked the bus map.',
    });
    expect(okEnd.ok).toBe(true);
    expect(okEnd.json).toEqual({ ok: true });
    const session = ds.meetingSessions.find((m) => m.id === id)!;
    expect(session.status).toBe('ENDED');
    expect(session.ended_at).not.toBeNull();

    // §50A — ending twice still answers honestly; detect now conflicts.
    const detectAfterEnd = await send(`/api/v1/meetings/${id}/candidates`, 'POST', {
      candidate_type: 'TASK',
      content: { title: 'Late detection' },
      confidence: 0.5,
    });
    expect(detectAfterEnd.status).toBe(409);
    expect((detectAfterEnd.json as { error: { message: string } }).error.message).toBe(
      'No active meeting session.',
    );
  });

  it('ending expires every candidate left PENDING (§50A leftovers)', async () => {
    const { ds, send } = makeHarness();
    const id = await startMeeting(send);
    await send(`/api/v1/meetings/${id}/candidates`, 'POST', {
      candidate_type: 'OPEN_QUESTION',
      content: { title: 'Unresolved' },
      confidence: 0.6,
    });
    await send(`/api/v1/meetings/${id}/end`, 'POST', { summary_text: 'Wrap up.' });
    const leftover = ds.meetingCandidates.find((c) => c.meeting_session_id === id)!;
    expect(leftover.status).toBe('EXPIRED');
    expect(leftover.resolved_at).not.toBeNull();
  });
});

// ─── BE §50A candidate intake + promotion ────────────────────────────────────

describe('demo transport — BE §50A candidates', () => {
  it('detect validates the exact zod domain of detectBody', async () => {
    const { send } = makeHarness();
    const id = await startMeeting(send);

    const badType = await send(`/api/v1/meetings/${id}/candidates`, 'POST', {
      candidate_type: 'RUMOR',
      content: {},
      confidence: 0.5,
    });
    expect(badType.status).toBe(400);
    expect((badType.json as { error: { message: string } }).error.message).toBe(
      'Invalid candidate body.',
    );

    const badConfidence = await send(`/api/v1/meetings/${id}/candidates`, 'POST', {
      candidate_type: 'TASK',
      content: {},
      confidence: 1.5,
    });
    expect(badConfidence.status).toBe(400);

    const badContent = await send(`/api/v1/meetings/${id}/candidates`, 'POST', {
      candidate_type: 'TASK',
      content: 'a string, not a record',
      confidence: 0.5,
    });
    expect(badContent.status).toBe(400);

    // Every valid §124A.1 type is accepted.
    for (const candidate_type of [
      'DECISION',
      'TASK',
      'OPEN_QUESTION',
      'CONTRADICTION',
      'RESEARCH_NEED',
      'MILESTONE_CHANGE',
    ] as const) {
      const res = await send(`/api/v1/meetings/${id}/candidates`, 'POST', {
        candidate_type,
        content: { title: `${candidate_type} headline` },
        confidence: 0.42,
        source_message_id: null,
      });
      expect(res.status).toBe(201);
      const row = res.json as Record<string, unknown>;
      expect(row).toMatchObject({
        meeting_session_id: id,
        candidate_type,
        status: 'PENDING',
        promoted_to_type: null,
        promoted_to_id: null,
      });
    }
  });

  it('accept promotes a DECISION into a real PROPOSED decision row and records the promotion', async () => {
    const { ds, send } = makeHarness();
    const id = await startMeeting(send);
    const cand = (
      await send(`/api/v1/meetings/${id}/candidates`, 'POST', {
        candidate_type: 'DECISION',
        content: { title: 'Lock SPI bus at CPOL=0', context: 'Bench logic capture' },
        confidence: 0.9,
      })
    ).json as Record<string, string>;

    const wrongBody = await send(`/api/v1/meetings/${id}/candidates/${cand.id}/accept`, 'POST', {
      promote: 'artifact',
    });
    expect(wrongBody.status).toBe(400);
    expect((wrongBody.json as { error: { message: string } }).error.message).toBe(
      "promote ('task'|'decision') is required.",
    );

    const res = await send(`/api/v1/meetings/${id}/candidates/${cand.id}/accept`, 'POST', {
      promote: 'decision',
    });
    expect(res.status).toBe(201);
    const promotedId = (res.json as { promoted_id: string }).promoted_id;
    const created = ds.decisions.find((d) => d.id === promotedId)!;
    expect(created.title).toBe('Lock SPI bus at CPOL=0');
    expect(created.context).toBe('Bench logic capture');
    expect(created.status).toBe('PROPOSED');

    const stored = ds.meetingCandidates.find((c) => c.id === cand.id)!;
    expect(stored.status).toBe('ACCEPTED');
    // BE §50A lowercase promote types.
    expect(stored.promoted_to_type).toBe('decision');
    expect(stored.promoted_to_id).toBe(promotedId);
    expect(stored.resolved_at).not.toBeNull();

    // Double-accept conflicts exactly like Candidate already resolved.
    const again = await send(`/api/v1/meetings/${id}/candidates/${cand.id}/accept`, 'POST', {
      promote: 'decision',
    });
    expect(again.status).toBe(409);
    expect((again.json as { error: { message: string } }).error.message).toBe(
      'Candidate already resolved.',
    );
  });

  it('accept promotes a TASK into a real TODO row with server defaults', async () => {
    const { ds, send } = makeHarness();
    const id = await startMeeting(send);
    const cand = (
      await send(`/api/v1/meetings/${id}/candidates`, 'POST', {
        candidate_type: 'TASK',
        content: { title: 'Wire telemetry path', description: 'Behind a compile flag' },
        confidence: 0.88,
      })
    ).json as Record<string, string>;

    const res = await send(`/api/v1/meetings/${id}/candidates/${cand.id}/accept`, 'POST', {
      promote: 'task',
    });
    expect(res.status).toBe(201);
    const promotedId = (res.json as { promoted_id: string }).promoted_id;
    const task = ds.tasks.find((t) => t.id === promotedId)!;
    expect(task).toMatchObject({
      title: 'Wire telemetry path',
      description: 'Behind a compile flag',
      status: 'TODO',
      priority: 'MEDIUM',
      version: 1,
    });
    expect(ds.meetingCandidates.find((c) => c.id === cand.id)!.promoted_to_type).toBe('task');

    // The promoted row is visible on the normal §111 list too.
    const list = await send(`/api/v1/projects/${PROJECT}/tasks`);
    expect((list.json as { items: unknown[] }).items.some((t) => t === task)).toBe(true);
  });

  it('unknown candidates answer NOT_FOUND like requireCandidate paths', async () => {
    const { send } = makeHarness();
    const id = await startMeeting(send);
    const res = await send(`/api/v1/meetings/${id}/candidates/mc_ghost/accept`, 'POST', {
      promote: 'task',
    });
    expect(res.status).toBe(404);
    expect((res.json as { error: { message: string } }).error.message).toBe(
      'Candidate not found.',
    );
  });
});
