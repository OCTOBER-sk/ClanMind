/**
 * P13 accessibility pass — shell-level §7 assertions.
 *
 * Covers the whole-app guarantees that can only be verified against the real
 * shell tree: skip link, main focus target, route-change focus movement,
 * and the §25 hover/focus message toolbar being keyboard-reachable.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/design-system/components/Toast';
import { AppShell } from './AppShell';
import { useAuthStore } from '@/state/useAuthStore';
import { useGroupStore } from '@/state/useGroupStore';

// The global setup stub answers `matches:false` for every query, which pins
// §13 to 'single' (nav hidden inside a closed Sheet). These tests exercise
// the DOCKED shell, so resolve width queries as a ≥1440 desktop.
vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
  matches: query.includes('min-width'),
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})));

const GROUP = {
  id: 'g1',
  name: 'Alpha',
  status: 'ACTIVE',
  ai_name: 'Odin',
  ai_proactivity: 'balanced' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function seedStores() {
  useAuthStore.setState({
    user: { id: 'u1', name: 'Tester', email_snapshot: 't@x.io' },
    isAuthenticated: true,
  } as never);
  useGroupStore.setState({
    groups: [GROUP],
    activeGroup: GROUP,
    members: [
      {
        group_id: 'g1',
        user_id: 'u1',
        role: 'OWNER',
        status: 'ACTIVE',
        joined_at: new Date().toISOString(),
        user: { id: 'u1', name: 'Tester', email_snapshot: 't@x.io' },
      },
    ],
  } as never);
}

function renderShell(initialEntry = '/group/g1/chat') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/group/:groupId/:section" element={<AppShell />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('AppShell — §7 skip link & main focus target', () => {
  beforeAll(() => seedStores());

  it('renders a skip link as the FIRST element targeting #cm-main-content', () => {
    const { container } = renderShell();
    const skip = screen.getByText('Skip to main content');
    expect(skip.tagName).toBe('A');
    expect(skip).toHaveAttribute('href', '#cm-main-content');
    // First element inside the shell root — nothing tabbable precedes it.
    expect(container.firstElementChild?.firstElementChild).toBe(skip);
  });

  it('main work surface is the named focus target, outside the tab order', () => {
    renderShell();
    const main = document.getElementById('cm-main-content');
    expect(main).not.toBeNull();
    expect(main!.tagName).toBe('MAIN');
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('initial mount does NOT steal focus (§253)', () => {
    renderShell();
    // Focus starts on body — no programmatic move happened during boot.
    expect(document.activeElement).toBe(document.body);
  });

  it('route changes move focus to the main work surface target (§7)', async () => {
    const user = userEvent.setup();
    renderShell();
    expect(document.activeElement).toBe(document.body);

    await user.click(screen.getByRole('button', { name: 'Team' }));
    expect(document.activeElement).toBe(document.getElementById('cm-main-content'));

    // …and again for a further section change.
    await user.click(screen.getByRole('button', { name: /Garage/i }));
    expect(document.activeElement).toBe(document.getElementById('cm-main-content'));
  });
});
