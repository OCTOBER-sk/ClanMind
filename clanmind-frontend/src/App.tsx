import { useEffect, useMemo } from 'react';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppRouter } from '@/app/router';
import { ToastProvider } from '@/design-system/components/Toast';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { useUiStore } from '@/state/useUiStore';
import { useAuthStore } from '@/state/useAuthStore';
import { initConnectivity, shutdownConnectivity } from '@/sync/connectivity';

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

  // Apply theme class to document root
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Real connectivity → SyncBanner truth (FE §185). Realtime is initialised
  // at boot (demo hub or live socket); connectivity derives banner state.
  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      void import('@/realtime/connection').then(({ getRealtime }) => {
        initConnectivity(getRealtime());
      });
    } catch {
      // Realtime not initialised yet (live mode pre-P1) — banner stays neutral.
    }
    return () => shutdownConnectivity();
  }, [isAuthenticated]);

  const router = useMemo(() => createAppRouter(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ErrorBoundary variant="global">
          <RouterProvider router={router} />
        </ErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  );
}
