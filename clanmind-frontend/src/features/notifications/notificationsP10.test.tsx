/**
 * P10 — notifications & activity feature flows:
 *
 *   • useNotificationsController over the REAL §95A contract shapes:
 *     validated list projection, §277 optimistic mark-read with server
 *     reconciliation, and ROLLBACK when the POST fails (a notification the
 *     server still holds unread keeps its badge);
 *   • NotificationCenterPanel §207 state matrix: loading skeletons, error +
 *     retry, empty what/why/next, unread badges, mark-all-read gating;
 *   • osNotify pipeline: §174 important categories only, §171 preference
 *     gates, §278 content-hidden previews, §173 away batching;
 *   • Sync Diagnostics exposing delivery_state VERBATIM (§171A).
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setTransportOverride } from '@/api/transport';
import { createDemoTransport } from '@/mocks/transportRoutes';
import { createDemoDataset } from '@/mocks/dataset';
import { useNotificationsController } from './useNotificationsController';
import { NotificationCenterPanel } from './NotificationCenterPanel';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  loadHidePreview,
  saveHidePreview,
} from './notificationPrefs';
import {
  deliverOsNotification,
  flushAwayNotifications,
  resetAwayBatch,
} from './osNotify';
import { SyncDiagnosticsView } from '@/features/sync/SyncDiagnosticsView';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import type { Notification } from '@/types';
import type { Transport as WireTransport } from '@/api/transport';

vi.mock('@/tauri/bridge', () => ({
  sendNativeNotification: vi.fn(async () => undefined),
}));

import { sendNativeNotification } from '@/tauri/bridge';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif_x',
    recipient_user_id: 'user_arun_1',
    group_id: 'grp_1',
    project_id: null,
    category: 'MENTION',
    subject_type: 'message',
    subject_id: 'msg_1',
    title: 'You were mentioned',
    body: 'Take a look at the DMA driver',
    delivery_state: 'DELIVERED_REALTIME',
    read_at: null,
    created_at: new Date().toISOString(),
    target_route: '/message/msg_1',
    ...overrides,
  };
}

const GROUP = 'grp_robotics_1';

let ds: ReturnType<typeof createDemoDataset>;

// ─── Controller over the real §95A wire ──────────────────────────────────────

describe('useNotificationsController — live demo-transport integration', () => {
  beforeEach(() => {
    // Fresh fixture rows per test — mark-read mutates the shared dataset.
    ds = createDemoDataset();
    setTransportOverride(createDemoTransport(ds));
    useProjectDataStore.getState().setNotifications([]);
    useProjectDataStore.getState().setActivityEvents([]);
  });

  afterAll(() => {
    setTransportOverride(null);
  });

  function makeWrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it('projects the validated §95A list + §98A activity feed into the store', async () => {
    const { result } = renderHook(() => useNotificationsController(GROUP), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await waitFor(() => expect(result.current.notifications.length).toBeGreaterThan(0));
    expect(result.current.unreadCount).toBe(4); // notif_1..4 seeded unread
    expect(useProjectDataStore.getState().activityEvents.length).toBe(3);
    // Deep links derived per §193 subject mapping.
    const mention = result.current.notifications.find((n) => n.id === 'notif_2')!;
    expect(mention.target_route).toBe('/message/msg_2');
  });

  it('markRead posts to the real endpoint and stamps the server row', async () => {
    const { result } = renderHook(() => useNotificationsController(GROUP), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.notifications.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.markRead('notif_2');
    });
    expect(ds.notifications.find((n) => n.id === 'notif_2')!.read_at).not.toBeNull();
    expect(result.current.unreadCount).toBe(3);
    expect(result.current.error).toBeNull();
  });

  it('markAllRead flips every unread row and the badge reaches zero', async () => {
    const { result } = renderHook(() => useNotificationsController(GROUP), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.notifications.length).toBeGreaterThan(0));

    let marked = 0;
    await act(async () => {
      marked = await result.current.markAllRead();
    });
    expect(marked).toBe(4);
    expect(result.current.unreadCount).toBe(0);
    const seededUnread = ds.notifications.filter(
      (n) => n.recipient_user_id === 'user_arun_1' && n.id.startsWith('notif_') && !n.id.includes('priya'),
    );
    expect(seededUnread.every((n) => n.read_at !== null)).toBe(true);
  });

  it('a failed mark-read POST rolls the optimistic read stamp back', async () => {
    // A transport where reads succeed but every read-POST fails.
    const failing: WireTransport = {
      async send(req) {
        const bare = req.path.replace(/^\/api\/v1/, '');
        if (req.method === 'GET' && bare === '/notifications') {
          return {
            status: 200,
            ok: true,
            json: {
              items: [
                {
                  id: 'notif_fail',
                  recipient_user_id: 'u1',
                  group_id: GROUP,
                  project_id: null,
                  category: 'MENTION',
                  subject_type: 'message',
                  subject_id: 'm1',
                  title: 'You were mentioned',
                  body: null,
                  delivery_state: 'DELIVERED_REALTIME',
                  read_at: null,
                  created_at: new Date().toISOString(),
                },
              ],
            },
          };
        }
        if (req.method === 'GET' && bare.endsWith('/activity')) {
          return { status: 200, ok: true, json: { items: [] } };
        }
        return {
          status: 500,
          ok: false,
          json: { error: { code: 'INTERNAL', message: 'Storage unavailable.', request_id: 'r1' } },
        };
      },
    };
    setTransportOverride(failing);

    const { result } = renderHook(() => useNotificationsController(GROUP), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.notifications.length).toBe(1));

    let ok = true;
    await act(async () => {
      ok = await result.current.markRead('notif_fail');
    });
    // §277 honesty — the server still owns read state; the badge returns.
    expect(ok).toBe(false);
    expect(result.current.error).toContain('Storage unavailable');
    expect(result.current.notifications[0]!.read_at).toBeNull();
    expect(result.current.unreadCount).toBe(1);
  });
});

// ─── Panel states (§207 matrix) ──────────────────────────────────────────────

describe('NotificationCenterPanel — §207 state coverage', () => {
  const base = {
    notifications: [] as Notification[],
    unreadCount: 0,
    isLoading: false,
    error: null as string | null,
    isMutating: false,
    onRefresh: vi.fn(),
    onMarkAllRead: vi.fn(),
    onOpenNotification: vi.fn(),
    onViewAllActivity: vi.fn(),
  };

  it('renders items with unread badges and the unread count chip', () => {
    const rows = [
      makeNotification({ id: 'a', title: 'Mention one', read_at: null }),
      makeNotification({ id: 'b', title: 'Already read', read_at: new Date().toISOString() }),
    ];
    render(<NotificationCenterPanel {...base} notifications={rows} unreadCount={1} />);
    expect(screen.getByText('Mention one')).toBeInTheDocument();
    expect(screen.getByText('1 unread')).toBeInTheDocument();
    expect(screen.getByLabelText('Mention one (unread)')).toBeInTheDocument();
    expect(screen.getByTestId('notification-center')).toBeInTheDocument();
  });

  it('clicking an item hands it to onOpenNotification (mark-read + deep link live there)', () => {
    const onOpenNotification = vi.fn();
    const row = makeNotification({ id: 'a', title: 'Mention one' });
    render(<NotificationCenterPanel {...base} notifications={[row]} onOpenNotification={onOpenNotification} />);
    fireEvent.click(screen.getByLabelText('Mention one (unread)'));
    expect(onOpenNotification).toHaveBeenCalledWith(row);
  });

  it('mark-all-read is enabled with unread items and fires; refresh button present', () => {
    const onMarkAllRead = vi.fn();
    render(
      <NotificationCenterPanel
        {...base}
        notifications={[makeNotification()]}
        unreadCount={1}
        onMarkAllRead={onMarkAllRead}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Refresh notifications' })).toBeInTheDocument();
  });

  it('mark-all-read disables while mutating and when nothing is unread (§215)', () => {
    render(<NotificationCenterPanel {...base} isMutating />);
    const btn = screen.getByRole('button', { name: /mark all read/i });
    expect(btn).toBeDisabled();

    render(<NotificationCenterPanel {...base} unreadCount={0} />);
    const second = screen.getAllByRole('button', { name: /mark all read/i })[1]!;
    expect(second).toBeDisabled();
  });

  it('loading shows skeletons (§180), never a universal spinner wall', () => {
    render(<NotificationCenterPanel {...base} isLoading />);
    expect(screen.getByTestId('notifications-loading')).toBeInTheDocument();
  });

  it('error shows what happened + recovery action (§181)', () => {
    render(<NotificationCenterPanel {...base} error="Request failed with status 500" />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load notifications.");
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('empty explains what/why/next (§179)', () => {
    render(<NotificationCenterPanel {...base} />);
    expect(screen.getByText('No notifications yet.')).toBeInTheDocument();
    expect(screen.getByText(/land here the moment they happen/i)).toBeInTheDocument();
  });
});

// ─── OS pipeline (§173/§174/§278) ────────────────────────────────────────────

describe('osNotify — importance, preferences, privacy, away batching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetAwayBatch();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  afterAll(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  function setHidden(value: boolean): void {
    Object.defineProperty(document, 'hidden', { value, configurable: true });
  }

  it('delivers §174 important categories to the native bridge', async () => {
    const res = await deliverOsNotification(makeNotification());
    expect(res.outcome).toBe('sent');
    expect(sendNativeNotification).toHaveBeenCalledWith({
      title: 'You were mentioned',
      body: 'Take a look at the DMA driver',
    });
  });

  it('never delivers non-important categories (§174: not every event interrupts)', async () => {
    const res = await deliverOsNotification(
      makeNotification({ category: 'ARTIFACT_READY' }),
    );
    expect(res.outcome).toBe('skipped');
    expect(sendNativeNotification).not.toHaveBeenCalled();
  });

  it('respects the per-category channel matrix (§171/§276)', async () => {
    saveNotificationPrefs(GROUP, {
      ...loadNotificationPrefs(GROUP),
      TASK_ASSIGNMENT: { inApp: true, desktop: false, email: false },
      PRIVATE_MESSAGE: { inApp: false, desktop: true, email: false }, // SUPPRESSED_BY_PREFERENCE twin
    });

    const desktopOff = await deliverOsNotification(
      makeNotification({ group_id: GROUP, category: 'TASK_ASSIGNMENT' }),
    );
    expect(desktopOff).toEqual({ outcome: 'skipped', reason: 'desktop channel off' });

    const inAppOff = await deliverOsNotification(
      makeNotification({ group_id: GROUP, category: 'PRIVATE_MESSAGE' }),
    );
    expect(inAppOff.reason).toBe('SUPPRESSED_BY_PREFERENCE');
    expect(sendNativeNotification).not.toHaveBeenCalled();
  });

  it('§278 — hidden previews ship title-only', async () => {
    saveHidePreview(true);
    await deliverOsNotification(makeNotification());
    expect(sendNativeNotification).toHaveBeenCalledWith({
      title: 'You were mentioned',
      body: undefined,
    });
    expect(loadHidePreview()).toBe(true);
  });

  it('§173 — while away events batch into ONE aggregate delivered on return', async () => {
    setHidden(true);
    const first = await deliverOsNotification(makeNotification({ id: '1', category: 'MENTION' }));
    const second = await deliverOsNotification(
      makeNotification({ id: '2', category: 'TASK_ASSIGNMENT', title: 'You were assigned a task' }),
    );
    expect(first.outcome).toBe('batched');
    expect(second.outcome).toBe('batched');
    expect(sendNativeNotification).not.toHaveBeenCalled();

    const summary = await flushAwayNotifications();
    expect(summary).toBe('2 new notifications · Mention ×1, Task ×1');
    expect(sendNativeNotification).toHaveBeenCalledWith({
      title: 'ClanMind',
      body: summary,
    });

    // Flushing an empty batch is a no-op.
    expect(await flushAwayNotifications()).toBeNull();
  });

  it('prefs round-trip through the shared storage key', () => {
    const defaults = loadNotificationPrefs('grp_new');
    expect(defaults.MENTION).toEqual({ inApp: true, desktop: true, email: false });
    const prefs = loadNotificationPrefs('grp_x');
    prefs.DECISION_APPROVAL = { inApp: false, desktop: false, email: true };
    saveNotificationPrefs('grp_x', prefs);
    expect(loadNotificationPrefs('grp_x').DECISION_APPROVAL).toEqual({
      inApp: false,
      desktop: false,
      email: true,
    });
  });
});

// ─── §171A diagnostics verbatim ──────────────────────────────────────────────

describe('SyncDiagnosticsView — §171A delivery_state verbatim', () => {
  it('exposes SUPPRESSED_BY_PREFERENCE and FAILED distinctly and unedited', () => {
    const rows = [
      makeNotification({ id: 'd1', title: 'Suppressed one', delivery_state: 'SUPPRESSED_BY_PREFERENCE' }),
      makeNotification({ id: 'd2', title: 'Failed one', delivery_state: 'FAILED' }),
      makeNotification({ id: 'd3', title: 'Realtime one', delivery_state: 'DELIVERED_REALTIME' }),
    ];
    render(<SyncDiagnosticsView
      status="connected"
      checkpoint={null}
      pendingOperations={[]}
      conflicts={[]}
      notifications={rows}
      onResolveConflict={vi.fn()}
    />);
    const list = screen.getByTestId('delivery-state-list');
    expect(list.textContent).toContain('SUPPRESSED_BY_PREFERENCE');
    expect(list.textContent).toContain('FAILED');
    expect(list.textContent).toContain('DELIVERED_REALTIME');
    expect(list.textContent).toContain('[MENTION] Suppressed one');
  });

  it('renders no section when no notifications exist', () => {
    render(<SyncDiagnosticsView
      status="connected"
      checkpoint={null}
      pendingOperations={[]}
      conflicts={[]}
      onResolveConflict={vi.fn()}
    />);
    expect(screen.queryByTestId('delivery-state-list')).not.toBeInTheDocument();
  });
});
