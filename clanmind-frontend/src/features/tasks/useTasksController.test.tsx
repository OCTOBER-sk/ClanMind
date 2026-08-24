/**
 * P8 — useTasksController end-to-end over the demo transport (the same
 * contract the live Worker serves): optimistic status writes, server-row
 * reconciliation, and the §21.2 409 path — a stale version must NOT retry
 * silently; it refetches and reports "changed elsewhere".
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setTransportOverride } from '@/api/transport';
import { createDemoTransport } from '@/mocks/transportRoutes';
import { createDemoDataset } from '@/mocks/dataset';
import { useTasksController } from '@/features/tasks/useTasksController';
import { useProjectDataStore } from '@/state/useProjectDataStore';

const PROJECT = 'proj_flight_ctrl';

let shutdown: (() => void) | null = null;
let ds: ReturnType<typeof createDemoDataset>;

beforeAll(() => {
  ds = createDemoDataset();
  setTransportOverride(createDemoTransport(ds));
  shutdown = () => setTransportOverride(null);
});

afterAll(() => {
  shutdown?.();
});

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useTasksController — live demo-transport integration', () => {
  it('loads project rows into the store scoped by project', async () => {
    const { result } = renderHook(() => useTasksController(PROJECT), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await waitFor(() => expect(result.current.tasks.length).toBeGreaterThan(0));
    // Every rendered row belongs to THIS project.
    for (const task of result.current.tasks) {
      expect(task.project_id).toBe(PROJECT);
    }
  });

  it('create() posts to the real endpoint and lands the server row', async () => {
    const { result } = renderHook(() => useTasksController(PROJECT), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.tasks.length).toBeGreaterThan(0));

    let created: Awaited<ReturnType<typeof result.current.create>> = null;
    await act(async () => {
      created = await result.current.create({ title: 'Controller-created task' });
    });
    expect(created).not.toBeNull();
    expect(created!.status).toBe('TODO'); // BE default
    expect(ds.tasks.some((t) => t.id === created!.id)).toBe(true);
    expect(useProjectDataStore.getState().tasks.map((t) => t.id)).toContain(created!.id);
  });

  it('setStatus applies optimistically and reconciles with the server row', async () => {
    const { result } = renderHook(() => useTasksController(PROJECT), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.tasks.length).toBeGreaterThan(0));
    const target = result.current.tasks.find((t) => t.status === 'TODO')!;

    await act(async () => {
      await result.current.setStatus(target, 'IN_PROGRESS');
    });
    const row = useProjectDataStore.getState().tasks.find((t) => t.id === target.id)!;
    expect(row.status).toBe('IN_PROGRESS');
    expect(row.version).toBe(target.version + 1); // server version won
    expect(result.current.error).toBeNull();
  });

  it('a stale CAS write surfaces "changed elsewhere" and refetches server truth', async () => {
    const { result } = renderHook(() => useTasksController(PROJECT), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.tasks.length).toBeGreaterThan(0));
    const held = result.current.tasks[0]!;

    // Another writer wins ON THE WIRE: bump the dataset behind the transport
    // so the client's held `version` is now stale.
    const datasetRow = ds.tasks.find((t) => t.id === held.id)!;
    datasetRow.version = held.version + 5;

    let ok = true;
    await act(async () => {
      ok = await result.current.setStatus(held, 'DONE');
    });

    // §21.2 — no silent retry: the losing write reports the conflict…
    expect(ok).toBe(false);
    expect(result.current.error).toContain('changed elsewhere');

    // …and the store reconciled to SERVER truth (bumped version, still open).
    const row = useProjectDataStore.getState().tasks.find((t) => t.id === held.id)!;
    expect(row.version).toBe(held.version + 5);
    expect(row.status).toBe(held.status); // DONE never applied
    void ds;
  });
});
