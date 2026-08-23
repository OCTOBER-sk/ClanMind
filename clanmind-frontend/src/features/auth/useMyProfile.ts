/**
 * GET /api/v1/me → authoritative profile into the TopBar (P1, BE §104).
 *
 * The persisted auth user is a cached shell (boot must never block on the
 * network — FE §196/§308); this query is the post-boot authority. A 401 here
 * is the natural expired-session detector: api/client routes it to the
 * unauthorized handler → FE §197 gate.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import { api } from '@/api/client';
import { ProfileSchema } from '@/api/schemas';
import { useAuthStore } from '@/state/useAuthStore';

type MeProfile = z.infer<typeof ProfileSchema>;

export function useMyProfile(options: { enabled?: boolean } = {}): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const enabled = options.enabled ?? true;

  const { data } = useQuery<MeProfile>({
    queryKey: ['me'],
    queryFn: () => api.get<MeProfile>('/me', { schema: ProfileSchema, retries: 0 }),
    enabled: enabled && isAuthenticated,
    staleTime: 60_000,
    retry: false,
  });

  // Reconcile server truth into the cached shell identity when it drifts.
  // BE §23 carries `email_snapshot` (email is not a live column).
  useEffect(() => {
    if (!data || !userId || data.id !== userId) return;
    const current = useAuthStore.getState().user;
    const serverEmail = data.email ?? data.email_snapshot ?? undefined;
    const drifted =
      current &&
      typeof data.display_name === 'string' &&
      data.display_name.length > 0 &&
      (current.name !== data.display_name || (serverEmail !== undefined && current.email !== serverEmail));
    if (current && drifted) {
      useAuthStore.getState().setUser({
        ...current,
        name: data.display_name,
        ...(serverEmail !== undefined ? { email: serverEmail } : {}),
      });
    }
  }, [data, userId]);
}
