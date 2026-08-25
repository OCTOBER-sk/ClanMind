/**
 * FE §197 — session expired gate.
 *
 * When the server rejects an authenticated call with 401, the app shows this
 * blocking-but-calm screen. Copy follows FE §224 tone rules: what happened →
 * what is safe → next action. Local work (drafts, queued operations, cached
 * views) is deliberately NOT cleared — re-signing into the SAME account
 * resumes exactly where the user left off; only signing into a DIFFERENT
 * account on this device wipes local state (R4).
 *
 * §65/§224 — role="dialog" for screen reader semantics; auto-focus on the
 * sign-in button so keyboard users can immediately act.
 */

import { useEffect, useRef } from 'react';
import { ClanMindLogo } from '@/design-system/components/ClanMindLogo';
import { Button } from '@/design-system/components/Button';
import { useAuthStore } from '@/state/useAuthStore';

export function SessionExpiredGate() {
  const email = useAuthStore((s) => s.user?.email);
  const signInButtonRef = useRef<HTMLButtonElement>(null);

  // §65 — auto-focus the primary action so keyboard/AT users land on the
  // actionable element, not the backdrop.
  useEffect(() => {
    signInButtonRef.current?.focus();
  }, []);

  const handleSignInAgain = (): void => {
    // Drop only the session flag + identity — domain stores and queues stay.
    const store = useAuthStore.getState();
    store.setSessionExpired(false);
    store.setUser(null); // isAuthenticated=false → router guards route to /auth
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-desc"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--color-background)] text-[var(--color-text)] select-none"
    >
      <div className="w-full max-w-sm px-6 text-center space-y-6 animate-[fade-in_200ms_ease-out]">
        <div className="flex flex-col items-center gap-3">
          <ClanMindLogo size="md" variant="calm" showWordmark />
        </div>
        <h1 id="session-expired-title" className="text-xl font-bold tracking-tight">Your session expired.</h1>
        <p id="session-expired-desc" className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {email ? (
            <>
              Signed in as <span className="font-medium">{email}</span>. Sign in again to continue
              where you left off.
            </>
          ) : (
            'Sign in again to continue where you left off.'
          )}
        </p>
        {/* §197 — reassurance line: local work is safe */}
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Your drafts, queued changes, and recent work are safe on this device.
        </p>
        <Button
          ref={signInButtonRef}
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleSignInAgain}
        >
          Sign in again
        </Button>
      </div>
    </div>
  );
}
