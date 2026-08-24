/**
 * P6 — demo REST parity for BE §109 artifact routes (INTEGRATION_NOTES D17).
 * The in-process transport must answer the same shapes the real Worker does:
 * `{items}` lists, §44 rows with `content_ref`, VALIDATION_FAILED on bad
 * bodies, and restore semantics that preserve history.
 */

import { describe, it, expect } from 'vitest';
import { createDemoTransport } from '@/mocks/transportRoutes';
import { createDemoDataset } from '@/mocks/dataset';
import type { TransportRequest } from '@/api/transport';

const ds = createDemoDataset();
const transport = createDemoTransport(ds);

function send(path: string, method: TransportRequest['method'] = 'GET', body?: unknown): Promise<{ status: number; ok: boolean; json: unknown }> {
  return transport.send({ method, path, body });
}

describe('demo transport — BE §109 parity', () => {
  it('GET /projects/:id/artifacts returns {items} of §44 wire rows', async () => {
    const res = await send('/api/v1/projects/proj_flight_ctrl/artifacts');
    expect(res.ok).toBe(true);
    const items = (res.json as { items: Array<Record<string, unknown>> }).items;
    expect(items.length).toBeGreaterThan(0);
    const first = items[0]!;
    expect(first).toMatchObject({
      id: 'art_diagram_1',
      name: expect.any(String),
      artifact_type: 'ARCHITECTURE',
      current_version: 2,
    });
    const versions = first.versions as Array<Record<string, unknown>>;
    // §44 metadata columns exist even though inline content rides along (D17).
    expect(versions[0]).toMatchObject({
      version_number: 1,
      content_ref: expect.stringContaining('artifacts/art_diagram_1/v1'),
      content_type: 'application/json',
    });
  });

  it('GET /artifacts/:id serves one artifact; unknown ids 404 with the BE §102 envelope', async () => {
    const okRes = await send('/api/v1/artifacts/art_doc_2');
    expect(okRes.ok).toBe(true);

    const missing = await send('/api/v1/artifacts/art_missing');
    expect(missing.status).toBe(404);
    expect((missing.json as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });

  it('POST /artifacts/:id/pin flips the flag and persists to the dataset', async () => {
    const target = ds.artifacts.find((a) => a.id === 'art_table_3')!;
    const was = target.pinned;
    const res = await send('/api/v1/artifacts/art_table_3/pin', 'POST', { pinned: !was });
    expect(res.ok).toBe(true);
    expect((res.json as { pinned: boolean }).pinned).toBe(!was);
    expect(ds.artifacts.find((a) => a.id === 'art_table_3')!.pinned).toBe(!was);

    // Restore original state for other tests/datasets.
    await send('/api/v1/artifacts/art_table_3/pin', 'POST', { pinned: was });
  });

  it('POST /artifacts/:id/pin rejects non-boolean bodies (§102)', async () => {
    const res = await send('/api/v1/artifacts/art_table_3/pin', 'POST', { pinned: 'yes' });
    expect(res.status).toBe(400);
    expect((res.json as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED');
  });

  it('POST /artifacts/:id/restore moves current_version WITHOUT destroying history', async () => {
    const res = await send('/api/v1/artifacts/art_diagram_1/restore', 'POST', { version_number: 1 });
    expect(res.ok).toBe(true);
    const row = res.json as { current_version: number; versions: unknown[] };
    expect(row.current_version).toBe(1);
    expect(row.versions).toHaveLength(2); // lineage preserved
    expect(ds.artifacts.find((a) => a.id === 'art_diagram_1')!.current_version).toBe(1);

    // Back to v2 for dataset hygiene.
    await send('/api/v1/artifacts/art_diagram_1/restore', 'POST', { version_number: 2 });
  });

  it('POST restore validates the version number and existence', async () => {
    const bad = await send('/api/v1/artifacts/art_diagram_1/restore', 'POST', { version_number: 99 });
    expect(bad.status).toBe(404);

    const invalid = await send('/api/v1/artifacts/art_diagram_1/restore', 'POST', { version_number: -3 });
    expect(invalid.status).toBe(400);
  });

  it('DELETE soft-deletes (§256) and the row disappears from project lists', async () => {
    const res = await send('/api/v1/artifacts/art_table_3', 'DELETE');
    expect(res.ok).toBe(true);
    expect(ds.artifacts.find((a) => a.id === 'art_table_3')!.deleted).toBe(true);

    const list = await send('/api/v1/projects/proj_flight_ctrl/artifacts');
    const ids = (list.json as { items: Array<{ id: string }> }).items.map((i) => i.id);
    expect(ids).not.toContain('art_table_3');

    // Undo for dataset hygiene.
    ds.artifacts.find((a) => a.id === 'art_table_3')!.deleted = false;
  });

  it('unknown routes still answer the BE §102 envelope', async () => {
    const res = await send('/api/v1/nonexistent/route');
    expect(res.status).toBe(404);
    expect((res.json as { error: { request_id: string } }).error.request_id).toBeDefined();
  });
});
