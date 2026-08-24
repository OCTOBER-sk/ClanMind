/**
 * P9 — dispatch projections for the meeting vocabulary. The real room
 * broadcasts `meeting.started` / `meeting.ended` as system events
 * (group-room.ts broadcastSystem), and §114 lists `meeting.event`.
 *
 * Honesty property: notify payloads carry ids only, so the projection
 * hydrates from the REAL §112 GET (validated rows) and never invents a
 * half-filled session. A locally-started session (REST response won the
 * race) is never clobbered.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchRealtimeEvent } from '@/realtime/dispatch';
import { setTransportOverride } from '@/api/transport';
import { useMeetingStore } from '@/state/useMeetingStore';
import type { RealtimeEvent } from '@/realtime/events';
import type { Transport } from '@/api/transport';
import type { MeetingCandidate, MeetingSession } from '@/types';

const SESSION: MeetingSession = {
  id: 'meet_rt_1',
  group_id: 'grp_1',
  project_id: 'proj_1',
  started_by: 'user_priya_2',
  started_at: new Date().toISOString(),
  ended_at: null,
  status: 'ACTIVE',
  summary_artifact_id: null,
};

const CANDIDATE: MeetingCandidate = {
  id: 'mc_rt_1',
  meeting_session_id: SESSION.id,
  candidate_type: 'DECISION',
  content: { title: 'Hydrated decision' },
  confidence: 0.91,
  source_message_id: null,
  status: 'PENDING',
  promoted_to_type: null,
  promoted_to_id: null,
  created_at: new Date().toISOString(),
  resolved_at: null,
};

function meetingTransport(status: MeetingSession['status']): Transport {
  return {
    async send(req) {
      // The client speaks unversioned paths; accept both framings.
      const bare = req.path.replace(/^\/api\/v1/, '');
      if (req.method === 'GET' && bare === `/meetings/${SESSION.id}`) {
        const json = {
          session:
            status === 'ENDED'
              ? { ...SESSION, status: 'ENDED', ended_at: new Date().toISOString() }
              : SESSION,
          candidates:
            status === 'ENDED'
              ? [{ ...CANDIDATE, status: 'EXPIRED', resolved_at: new Date().toISOString() }]
              : [CANDIDATE],
        };
        return { status: 200, ok: true, json };
      }
      return {
        status: 404,
        ok: false,
        json: { error: { code: 'NOT_FOUND', message: 'Meeting not found.', request_id: 'req_x' } },
      };
    },
  };
}

function event(event_type: string, payload: unknown): RealtimeEvent {
  return { event_type, group_id: 'grp_1', payload } as unknown as RealtimeEvent;
}

describe('dispatch — meeting fan-out', () => {
  beforeEach(() => {
    useMeetingStore.getState().resetMeeting();
    setTransportOverride(null);
  });

  it('meeting.started hydrates session + candidates through the validated §112 GET', async () => {
    setTransportOverride(meetingTransport('ACTIVE'));
    dispatchRealtimeEvent(event('meeting.started', {
      meeting_session_id: SESSION.id,
      project_id: SESSION.project_id,
      started_by: SESSION.started_by,
    }));
    await Promise.resolve();
    await Promise.resolve();
    await waitForStore();
    const state = useMeetingStore.getState();
    expect(state.currentSession?.id).toBe(SESSION.id);
    expect(state.isMeetingActive).toBe(true);
    expect(state.candidates).toHaveLength(1);
    expect(state.candidates[0]!.content.title).toBe('Hydrated decision');
  });

  it('a locally-started session is never clobbered by a late broadcast', async () => {
    setTransportOverride(meetingTransport('ACTIVE'));
    // The REST start response already adopted its own session.
    useMeetingStore.getState().setSession({
      ...SESSION,
      id: 'meet_local_1',
    });
    dispatchRealtimeEvent(event('meeting.started', { meeting_session_id: SESSION.id }));
    await Promise.resolve();
    await Promise.resolve();
    expect(useMeetingStore.getState().currentSession?.id).toBe('meet_local_1');
  });

  it('meeting.ended retires the active surface and re-reads the expired trail', async () => {
    setTransportOverride(meetingTransport('ENDED'));
    useMeetingStore.getState().setSession({ ...SESSION });
    useMeetingStore.getState().setCandidates([{ ...CANDIDATE }]);
    dispatchRealtimeEvent(event('meeting.ended', { meeting_session_id: SESSION.id }));
    // The retirement happens after the §112 re-read resolves.
    for (let i = 0; i < 40 && useMeetingStore.getState().isMeetingActive; i += 1) {
      await new Promise((r) => setTimeout(r, 5));
    }
    const state = useMeetingStore.getState();
    expect(state.isMeetingActive).toBe(false);
    expect(state.currentSession?.status).toBe('ENDED');
    expect(state.candidates[0]!.status).toBe('EXPIRED');
  });

  it('payloads without a resolvable session id are ignored (no fabrication)', async () => {
    setTransportOverride(meetingTransport('ACTIVE'));
    dispatchRealtimeEvent(event('meeting.started', {}));
    dispatchRealtimeEvent(event('meeting.event', {}));
    await Promise.resolve();
    expect(useMeetingStore.getState().isMeetingActive).toBe(false);
    expect(useMeetingStore.getState().currentSession).toBeNull();
  });
});

async function waitForStore(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    if (useMeetingStore.getState().currentSession !== null) return;
    await new Promise((r) => setTimeout(r, 5));
  }
}
