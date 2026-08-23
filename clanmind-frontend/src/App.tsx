import { useEffect, useMemo } from 'react';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppRouter } from '@/app/router';
import { ToastProvider } from '@/design-system/components/Toast';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { useUiStore } from '@/state/useUiStore';
import { useAuthStore } from '@/state/useAuthStore';
import { initConnectivity, shutdownConnectivity } from '@/sync/connectivity';
import { SessionExpiredGate } from '@/features/auth/SessionExpiredGate';
import { setUnauthorizedHandler } from '@/api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  const theme = useUiStore((s) => s.theme);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isSessionExpired = useAuthStore((s) => s.isSessionExpired);

  // Apply theme class to document root
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // FE §197 — any authenticated domain call answered 401 flips the session
  // gate. Local work is never cleared here; the same account signing back in
  // resumes seamlessly (account-switch wiping happens only in establishSession).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      useAuthStore.getState().setSessionExpired(true);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Real connectivity → SyncBanner truth (FE §185). Realtime is initialised
  // at boot: demo installs its hub + socket (src/mocks); LIVE mode bootstraps
  // workspace data from the real backend and connects the group room.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const { demoMode } = await import('@/config/env');
        if (demoMode) {
          const { getRealtime } = await import('@/realtime/connection');
          if (!cancelled) initConnectivity(getRealtime());
          return;
        }
        const live = await import('@/live/liveRuntime');
        if (cancelled) return;
        await live.bootstrapLiveWorkspace();
        if (cancelled) return;
        const { useGroupStore } = await import('@/state/useGroupStore');
        live.ensureLiveRealtime(useGroupStore.getState().activeGroup?.id);
      } catch {
        // Bootstrap failure keeps cached local state usable (FE §182);
        // the SyncBanner reflects whatever realtime status exists.
      }
    })();
    return () => {
      cancelled = true;
      shutdownConnectivity();
    };
  }, [isAuthenticated]);

  const router = useMemo(() => createAppRouter(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ErrorBoundary variant="global">
          {isSessionExpired && <SessionExpiredGate />}
          <RouterProvider router={router} />
        </ErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  );
}
