import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isSessionExpired: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSessionExpired: (expired: boolean) => void;
  logout: () => void;
}

/**
 * Auth store with persistence.
 * Starts unauthenticated so the login screen is shown on cold start.
 * Session is restored from localStorage if user was previously signed in.
 *
 * §67-69: Auth screens
 * §197: Session expiration — local work safe, show "Sign in again"
 * §284: Account isolation — clear state on logout
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isSessionExpired: false,
      isLoading: false,
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isSessionExpired: false,
          isLoading: false,
        }),
      setSessionExpired: (expired) => set({ isSessionExpired: expired }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isSessionExpired: false,
          isLoading: false,
        }),
    }),
    {
      name: 'cm_auth',
      // Only persist the user object — not loading/error state
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
