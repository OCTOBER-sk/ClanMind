import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, setUnauthorizedHandler } from '@/api/client';
import { setTransportOverride } from '@/api/transport';
import { useAuthStore } from '@/state/useAuthStore';
import { useChatStore } from '@/state/useChatStore';
import { useGroupStore } from '@/state/useGroupStore';
import { useSyncStore } from '@/state/useSyncStore';
import {
  establishSession,
  signOutSession,
} from '@/features/auth/session';
import type { AuthIdentity } from '@/features/auth/session';

/**
 * P1 — session lifecycle & account isolation (FE §197/§284, R4).
 * Runs against the demo transport (same contract the UI binds to).
 */

let identityCounter = 0;
function identityFor(prefix: string): AuthIdentity {
  return {
    id: `${prefix}_${++identityCounter}`,
    email: `${prefix}@clanmind.test`,
    name: prefix,
  };
}

describe('P1 session lifecycle', () => {
  beforeEach(async () => {
    const transportRoutes = await import('@/mocks/transportRoutes');
    const dataset = await import('@/mocks/dataset');
    setTransportOverride(transportRoutes.createDemoTransport(dataset.createDemoDataset()));
    useAuthStore.getState().logout();
  });

  afterEach(() => {
    setUnauthorizedHandler(null);
    setTransportOverride(null);
    vi.restoreAllMocks();
  });

  it('wrong password rejects with AUTH_INVALID_CREDENTIALS and does NOT trip the expiry gate', async () => {
    const onExpired = vi.fn();
    setUnauthorizedHandler(onExpired);
    await expect(api.post('/auth/login', { email: 'a@b.c', password: 'wrongpass' })).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
      status: 401,
    });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('401 on an authenticated domain call trips FE §197 gate and preserves local work', async () => {
    const transportRoutes = await import('@/mocks/transportRoutes');
    const onUnauthorized = vi.fn(() => useAuthStore.getState().setSessionExpired(true));
    setUnauthorizedHandler(onUnauthorized);

    // Seed "local work": a queued op + a draft + a user.
    const identity = identityFor('expired');
    useAuthStore.getState().setUser({
      id: identity.id,
      email: identity.email,
      name: identity.name,
      created_at: new Date().toISOString(),
    });
    useChatStore.setState({ messages: [], draftsByScope: { 'group:g1': 'half-typed note' } });
    useSyncStore.getState().addOperation({
      id: 'op_1',
      client_operation_id: 'op_1',
      group_id: 'g1',
      operation_type: 'message.create',
      entity_type: 'message',
      entity_id: 'm1',
      action: 'CREATE',
      payload: {},
      status: 'PENDING',
      created_at: new Date().toISOString(),
    });

    transportRoutes.expireDemoSession();
    await expect(api.get('/me')).rejects.toMatchObject({
      code: 'AUTH_SESSION_EXPIRED',
      status: 401,
    });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isSessionExpired).toBe(true);
    // §197 — local work is safe
    expect(useAuthStore.getState().user).not.toBeNull();
    expect(useChatStore.getState().draftsByScope['group:g1']).toBe('half-typed note');
    expect(useSyncStore.getState().pendingOperationsCount).toBe(1);

    // Same-account re-login resumes without wiping
    await establishSession(identity);
    expect(useAuthStore.getState().isSessionExpired).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useSyncStore.getState().pendingOperationsCount).toBe(1);
    expect(useChatStore.getState().draftsByScope['group:g1']).toBe('half-typed note');
  });

  it('switching to a DIFFERENT account wipes the previous account’s domain state (R4)', async () => {
    const first = identityFor('alice');
    await establishSession(first);
    // Simulate accumulated account data
    useGroupStore.setState({ groups: [], memberNicknames: { u9: 'Nick' } });
    useChatStore.setState({
      messages: [
        {
          id: 'm_old',
          group_id: 'g1',
          project_id: null,
          sender_type: 'USER',
          sender_id: first.id,
          sender_name: 'alice',
          body: 'secret idea',
          visibility: 'GROUP',
          pinned: false,
          edited: false,
          deleted: false,
          attachments: [],
          reactions: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as never,
      ],
      draftsByScope: { 'group:g1': 'alice private draft' },
    });

    const second = identityFor('bob');
    await establishSession(second);

    expect(useAuthStore.getState().user?.id).toBe(second.id);
    expect(useChatStore.getState().messages).toHaveLength(0);
    expect(useChatStore.getState().draftsByScope).toEqual({});
    expect(useGroupStore.getState().memberNicknames).toEqual({});
    expect(useSyncStore.getState().pendingOperationsCount).toBe(0);
  });

  it('sign-out ends the session but PRESERVES same-account local state (P1 exit: re-login restores drafts)', async () => {
    const only = identityFor('carol');
    await establishSession(only);
    useChatStore.setState({ composerText: 'unsent text' });

    await signOutSession();

    const auth = useAuthStore.getState();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.user).toBeNull();
    // Same account returning later must find its drafts again (FE §284
    // scopes clearing to account SWITCH, not sign-out).
    expect(useChatStore.getState().composerText).toBe('unsent text');

    // …and the return trip restores the session without wiping.
    await establishSession(only);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useChatStore.getState().composerText).toBe('unsent text');
  });
});
