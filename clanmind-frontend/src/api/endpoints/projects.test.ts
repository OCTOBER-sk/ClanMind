import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
  api: { post: vi.fn() },
}));

vi.mock('@/live/liveRuntime', () => ({
  mapProject: vi.fn((row: Record<string, unknown>) => ({
    id: row.id,
    group_id: row.group_id,
    name: row.name,
    goal: row.goal ?? undefined,
    description: row.description ?? undefined,
    project_type: (row.project_type ?? 'other') as string,
    status: row.status === 'archived' ? 'archived' : 'active',
    pulse_progress: typeof row.progress === 'number' ? row.progress : 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  })),
}));

import { api } from '@/api/client';
import { createProject } from '@/api/endpoints/projects';

const mockPost = vi.mocked(api.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createProject — live endpoint', () => {
  it('POSTs to /groups/:groupId/projects with the api client', async () => {
    mockPost.mockResolvedValueOnce({
      id: 'proj-uuid',
      group_id: 'grp-uuid',
      name: 'Sprint 1',
      description: null,
      goal: 'Ship v1',
      project_type: 'software',
      status: 'active',
      progress: 0,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    });

    const result = await createProject('grp-uuid', { name: 'Sprint 1', goal: 'Ship v1' });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/groups/grp-uuid/projects', {
      name: 'Sprint 1',
      goal: 'Ship v1',
    });
    expect(result.id).toBe('proj-uuid');
    expect(result.group_id).toBe('grp-uuid');
    expect(result.name).toBe('Sprint 1');
  });

  it('encodes special characters in groupId', async () => {
    mockPost.mockResolvedValueOnce({
      id: 'p1',
      group_id: 'g/1',
      name: 'X',
      status: 'active',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    });

    await createProject('g/1', { name: 'X' });

    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('/groups/'),
      { name: 'X' },
    );
  });

  it('throws when response fails schema validation', async () => {
    mockPost.mockResolvedValueOnce({ garbage: true });

    await expect(createProject('g1', { name: 'X' })).rejects.toThrow(
      'Project create response failed schema validation.',
    );
  });

  it('propagates API errors from the client', async () => {
    mockPost.mockRejectedValueOnce(new Error('FORBIDDEN'));

    await expect(createProject('g1', { name: 'X' })).rejects.toThrow('FORBIDDEN');
  });
});
