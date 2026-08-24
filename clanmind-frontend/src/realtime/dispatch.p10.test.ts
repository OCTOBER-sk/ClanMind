/**
 * P10 — dispatch projections for the notification vocabulary.
 *
 * The demo hub broadcasts `notification.created` carrying the FULL §95A row
 * (mirroring the real outbox→notification-worker rows). Honesty properties:
 *   • only schema-valid complete rows project into the store;
 *   • sparse/id-only stubs are tolerated and IGNORED (never half-rendered);
 *   • duplicate delivery is deduped by id;
 *   • every projected row runs the §174/§173/§278 OS pipeline.
 *
 * The live backend has no notification WS frame yet (INTEGRATION_NOTES D24)
 * — these projections keep demo and a future live frame on ONE pathway.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dispatchRealtimeEvent } from '@/realtime/dispatch';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import { useAuthStore } from '@/state/useAuthStore';
import type { RealtimeEvent } from '@/realtime/events';
import type { Notification } from '@/types';

vi.mock('@/features/notifications/osNotify', () => ({
  deliverOsNotification: vi.fn(async () => ({ outcome: 'sent' as const })),
  flushAwayNotifications: vi.fn(async () => null),
  resetAwayBatch: vi.fn(),
}));

import { deliverOsNotification } from '@/features/notifications/osNotify';

const ROW: Notification = {
  id: 'notif_rt_1',
  recipient_user_id: 'user_arun_1',
  group_id: 'grp_1',
  project_id: 'proj_1',
  category: 'MENTION',
  subject_type: 'message',
  subject_id: 'msg_9',
  title: 'You were mentioned',
  body: 'Priya: take a look at the DMA driver',
  delivery_state: 'DELIVERED_REALTIME',
  read_at: null,
  created_at: new Date().toISOString(),
  target_route: '/message/msg_9',
};

function event(payload: unknown): RealtimeEvent {
  return { event_type: 'notification.created', group_id: 'grp_1', payload } as unknown as RealtimeEvent;
}

describe('dispatch — notification.created fan-out', () => {
  beforeEach(() => {
    const store = useProjectDataStore.getState();
    store.setNotifications([]);
    store.setActivityEvents([]);
    // The signed-in recipient — §95A rows for OTHERS must never project.
    useAuthStore.setState({ user: { id: 'user_arun_1', email: 'a@x.io', name: 'Arun', created_at: '' } });
    vi.clearAllMocks();
  });

  it('projects a full §95A row into the store with the derived deep link', () => {
    dispatchRealtimeEvent(event({ notification: { ...ROW } }));
    const state = useProjectDataStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]!.id).toBe(ROW.id);
    expect(state.notifications[0]!.target_route).toBe('/message/msg_9');
    expect(state.notifications[0]!.read_at).toBeNull();
    // §174 OS pipeline ran for the important category.
    expect(deliverOsNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: ROW.id, category: 'MENTION' }),
    );
  });

  it('a sparse stub (id only) is ignored — nothing fabricated, no OS call', () => {
    dispatchRealtimeEvent(event({ notification_id: 'notif_x' }));
    dispatchRealtimeEvent(event({}));
    expect(useProjectDataStore.getState().notifications).toHaveLength(0);
    expect(deliverOsNotification).not.toHaveBeenCalled();
  });

  it('§95A targeting: rows addressed to ANOTHER recipient are dropped client-side', () => {
    dispatchRealtimeEvent(event({
      notification: { ...ROW, id: 'notif_foreign', recipient_user_id: 'user_priya_2' },
    }));
    expect(useProjectDataStore.getState().notifications).toHaveLength(0);
    expect(deliverOsNotification).not.toHaveBeenCalled();
  });

  it('without a session no row projects (no cache before auth)', () => {
    useAuthStore.setState({ user: null });
    dispatchRealtimeEvent(event({ notification: { ...ROW } }));
    expect(useProjectDataStore.getState().notifications).toHaveLength(0);
  });

  it('duplicate delivery is deduped by id', () => {
    dispatchRealtimeEvent(event({ notification: { ...ROW } }));
    dispatchRealtimeEvent(event({ notification: { ...ROW } }));
    expect(useProjectDataStore.getState().notifications).toHaveLength(1);
  });

  it('non-important categories still project but the OS pipeline decides quietly', () => {
    dispatchRealtimeEvent(event({
      notification: { ...ROW, id: 'notif_rt_2', category: 'ARTIFACT_READY', target_route: '/artifact/art_1' },
    }));
    expect(useProjectDataStore.getState().notifications.map((n) => n.id)).toContain('notif_rt_2');
    expect(deliverOsNotification).toHaveBeenCalledTimes(1); // gate lives in the pipeline
  });
});
