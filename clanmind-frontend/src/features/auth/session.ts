/**
 * Session gateway + account-session controllers (P1, BE §6 / FE §67/§68/§197).
 *
 * Layer discipline: components call the controllers here; the gateway is the
 * only place that speaks Supabase Auth or the auth transport routes.
 *
 * Two implementations behind one interface:
 *  - demo  — `/auth/*` demo transport routes (deterministic, testable expiry)
 *  - live  — @supabase/supabase-js (credentials/refresh/recovery; BE §6.1)
 *
 * FE §68: password reset NEVER reveals whether an account exists.
 * FE §197: session expiry preserves all local work; "Sign in again" re-enters
 * the same account without wiping queued operations or drafts. A DIFFERENT
 * account signing in on the same device wipes the previous account's local
 * state first (R4).
 */

import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import { env } from '@/config/env';
import { useAuthStore } from '@/state/useAuthStore';
import { setOutboxAccount, hydrateOutbox } from '@/sync/outbox';
import { clearAccountLocalState } from './accountState';
import type { User } from '@/types';

export interface AuthIdentity {
  id: string;
  email: string;
  name: string;
}

export interface SessionGateway {
  signIn(email: string, password: string): Promise<AuthIdentity>;
  signUp(input: { name: string; email: string; password: string }): Promise<AuthIdentity>;
  /** Resolves regardless of account existence (FE §68) — errors are transport-level only. */
  requestPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
}

// ─── Demo gateway (VITE_DEMO_MODE=1) ─────────────────────────────────────────

interface AuthSessionResponse {
  access_token: string;
  user: { id: string; email: string; name: string };
}

function createDemoGateway(): SessionGateway {
  return {
    async signIn(email, password) {
      const res = await api.post<AuthSessionResponse>('/auth/login', { email, password });
      return res.user;
    },
    async signUp({ name, email, password }) {
      const res = await api.post<AuthSessionResponse>('/auth/signup', {
        name,
        email,
        password,
      });
      return res.user;
    },
    // The demo route always 200s; the no-disclosure contract is enforced there.
    async requestPasswordReset(email) {
      await api.post('/auth/request-password-reset', { email });
    },
    async signOut() {
      await api.post('/auth/logout').catch(() => undefined);
    },
  };
}

// ─── Live gateway (Supabase Auth) ────────────────────────────────────────────

function supabaseErrorToApiError(err: { message: string; status?: number }): ApiError {
  const status = err.status ?? 400;
  return new ApiError({
    // Supabase invalid-credentials surfaces as 400 — normalize to the same
    // code the UI already handles, so error copy stays single-sourced.
    code: status === 400 ? 'AUTH_INVALID_CREDENTIALS' : 'AUTH_FAILED',
    message: err.message,
    status,
  });
}

async function createLiveGateway(): Promise<SessionGateway> {
  const { getSupabase } = await import('@/api/supabase');
  const auth = () => getSupabase().auth;
  const identityFrom = (user: {
    id: string;
    email?: string | null;
    // Supabase stores signup metadata here
    user_metadata?: Record<string, unknown>;
  }): AuthIdentity => ({
    id: user.id,
    email: user.email ?? '',
    name:
      (typeof user.user_metadata?.['name'] === 'string'
        ? (user.user_metadata['name'] as string)
        : '') || (user.email ?? '').split('@')[0] || 'Member',
  });

  return {
    async signIn(email, password) {
      const { data, error } = await auth().signInWithPassword({ email, password });
      if (error || !data.user) throw supabaseErrorToApiError(error ?? { message: 'Sign in failed' });
      return identityFrom(data.user);
    },
    async signUp({ name, email, password }) {
      const { data, error } = await auth().signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error || !data.user) throw supabaseErrorToApiError(error ?? { message: 'Sign up failed' });
      return identityFrom(data.user);
    },
    // Deliberately ignores the result shape — response never discloses
    // whether the address is registered (FE §68).
    async requestPasswordReset(email) {
      const { error } = await auth().resetPasswordForEmail(email);
      if (error) throw supabaseErrorToApiError(error);
    },
    async signOut() {
      await auth().signOut();
    },
  };
}

let gateway: SessionGateway | null = null;

export function getSessionGateway(): SessionGateway {
  if (!gateway) {
    throw new Error('[auth] session gateway not initialised — call initSessionGateway() at boot');
  }
  return gateway;
}

/**
 * Called once from the boot sequence (main.tsx prepare()) BEFORE first render.
 * Live mode loads the Supabase SDK via dynamic import so the demo bundle
 * contains none of it (bible rule 12).
 */
export async function initSessionGateway(): Promise<void> {
  if (!gateway) {
    gateway = env.demoMode ? createDemoGateway() : await createLiveGateway();
  }
}

// ─── Account-session controllers ─────────────────────────────────────────────

/**
 * Establish a session after a successful credential exchange.
 *
 * FE §284/R4 — if the device previously held a DIFFERENT account, that
 * account's local state (zustand domains + `cm_<userId>` IndexedDB) is wiped
 * BEFORE the new identity takes effect: private drafts can never cross
 * accounts. The SAME account signing back in keeps everything — including
 * after logout (P1 exit: login→logout→login restores drafts) and after a
 * session-expiry detour (FE §197).
 */
export async function establishSession(identity: AuthIdentity): Promise<void> {
  const prev = useAuthStore.getState().user;
  if (prev && prev.id !== identity.id) {
    await clearAccountLocalState(prev.id);
  }
  useAuthStore.getState().setUser({
    id: identity.id,
    email: identity.email,
    name: identity.name,
    created_at: prev?.id === identity.id ? prev.created_at : new Date().toISOString(),
  });
  // P11 — point the durable outbox mirror at THIS account and restore any
  // operations queued by a previous session (§186A.2 durability: a restart
  // or sign-in cycle must never silently drop user work).
  setOutboxAccount(identity.id);
  await hydrateOutbox();
}

/**
 * Explicit sign-out (TopBar). Terminates the session and returns to the auth
 * screen while PRESERVING this account's device-local state — FE §284 scopes
 * clearing to ACCOUNT SWITCHES, and the P1 exit requires
 * login→logout→login(same account) to restore drafts. When a different
 * account later signs in on this device, establishSession() wipes everything
 * belonging to the previous one.
 */
export async function signOutSession(): Promise<void> {
  try {
    await getSessionGateway().signOut();
  } catch {
    // Network failure during sign-out must never trap the user in the app.
  }
  useAuthStore.getState().logout();
}

/** Map a gateway identity onto the persisted User shape. */
export function identityToUser(identity: AuthIdentity, existing?: User | null): User {
  return {
    id: identity.id,
    email: identity.email,
    name: identity.name,
    created_at:
      existing && existing.id === identity.id ? existing.created_at : new Date().toISOString(),
  };
}
