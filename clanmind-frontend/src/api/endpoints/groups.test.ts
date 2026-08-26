import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
  api: { post: vi.fn() },
}));

vi.mock('@/live/liveRuntime', () => ({
  mapGroup: vi.fn((row: Record<string, unknown>) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    status: 'ACTIVE',
    ai_name: 'Odin',
    ai_proactivity: 'off',
    created_at: row.created_at,
    updated_at: row.updated_at,
  })),
}));

import { api } from '@/api/client';
import { createGroup } from '@/api/endpoints/groups';

const mockPost = vi.mocked(api.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createGroup — live endpoint', () => {
  it('POSTs to /groups with the api client', async () => {
    mockPost.mockResolvedValueOnce({
      id: 'uuid-abc',
      name: 'My Team',
      description: null,
      status: 'ACTIVE',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    });

    const result = await createGroup({ name: 'My Team' });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/groups', { name: 'My Team' });
    expect(result.id).toBe('uuid-abc');
    expect(result.name).toBe('My Team');
  });

  it('passes description when provided', async () => {
    mockPost.mockResolvedValueOnce({
      id: 'uuid-xyz',
      name: 'Alpha',
      description: 'A team',
      status: 'ACTIVE',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    });

    await createGroup({ name: 'Alpha', description: 'A team' });

    expect(mockPost).toHaveBeenCalledWith('/groups', {
      name: 'Alpha',
      description: 'A team',
    });
  });

  it('throws when response fails schema validation', async () => {
    mockPost.mockResolvedValueOnce({ not: 'a valid group' });

    await expect(createGroup({ name: 'X' })).rejects.toThrow(
      'Group create response failed schema validation.',
    );
  });

  it('propagates API errors from the client', async () => {
    mockPost.mockRejectedValueOnce(new Error('NETWORK_TIMEOUT'));

    await expect(createGroup({ name: 'X' })).rejects.toThrow('NETWORK_TIMEOUT');
  });
});
