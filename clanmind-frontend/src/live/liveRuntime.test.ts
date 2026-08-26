import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/state/useProjectDataStore', () => ({
  useProjectDataStore: {
    setState: vi.fn(),
  },
}));

vi.mock('@/state/useArtifactStore', () => ({
  useArtifactStore: {
    setState: vi.fn(),
  },
}));

vi.mock('@/api/endpoints/tasks', () => ({
  fetchProjectTasks: vi.fn(),
}));

vi.mock('@/api/endpoints/decisions', () => ({
  fetchProjectDecisions: vi.fn(),
}));

vi.mock('@/api/endpoints/memory', () => ({
  fetchGroupMemories: vi.fn(),
  fetchMemoryCandidates: vi.fn(),
}));

vi.mock('@/api/endpoints/artifacts', () => ({
  fetchProjectArtifacts: vi.fn(),
}));

vi.mock('@/api/endpoints/notifications', () => ({
  fetchNotifications: vi.fn(),
  fetchGroupActivity: vi.fn(),
}));

import { useProjectDataStore } from '@/state/useProjectDataStore';
import { useArtifactStore } from '@/state/useArtifactStore';
import { fetchProjectTasks } from '@/api/endpoints/tasks';
import { fetchProjectDecisions } from '@/api/endpoints/decisions';
import {
  fetchGroupMemories,
  fetchMemoryCandidates,
} from '@/api/endpoints/memory';
import { fetchProjectArtifacts } from '@/api/endpoints/artifacts';
import {
  fetchNotifications,
  fetchGroupActivity,
} from '@/api/endpoints/notifications';
import { loadFeatureStores } from '@/live/liveRuntime';

const mockSetProjectData = vi.mocked(useProjectDataStore.setState);
const mockSetArtifact = vi.mocked(useArtifactStore.setState);
const mockFetchTasks = vi.mocked(fetchProjectTasks);
const mockFetchDecisions = vi.mocked(fetchProjectDecisions);
const mockFetchMemories = vi.mocked(fetchGroupMemories);
const mockFetchCandidates = vi.mocked(fetchMemoryCandidates);
const mockFetchArtifacts = vi.mocked(fetchProjectArtifacts);
const mockFetchNotifications = vi.mocked(fetchNotifications);
const mockFetchActivity = vi.mocked(fetchGroupActivity);

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TASKS = [
  {
    id: 'task-1',
    project_id: 'proj-1',
    title: 'Implement auth',
    status: 'TODO',
    priority: 'HIGH',
    version: 1,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

const DECISIONS = [
  {
    id: 'dec-1',
    project_id: 'proj-1',
    title: 'Use React',
    status: 'APPROVED',
    version: 1,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

const MEMORIES = [
  {
    id: 'mem-1',
    scope_type: 'GROUP',
    group_id: 'grp-1',
    memory_type: 'CONVENTION',
    content: 'Use pnpm',
    confidence: 0.9,
    importance: 0.7,
    source_type: 'conversation',
    status: 'ACTIVE',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

const CANDIDATES = [
  {
    id: 'cand-1',
    group_id: 'grp-1',
    candidate_type: 'CONSTRAINT',
    content: 'Must use TypeScript',
    confidence: 0.8,
    recommended_scope: 'GROUP',
    status: 'PENDING',
    created_at: '2025-01-01T00:00:00Z',
  },
];

const ARTIFACTS = [
  {
    id: 'art-1',
    group_id: 'grp-1',
    project_id: 'proj-1',
    title: 'Architecture Doc',
    artifact_type: 'DOCUMENT',
    current_version: 1,
    pinned: false,
    used_as_context: false,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    versions: [],
  },
];

const NOTIFICATIONS = [
  {
    id: 'notif-1',
    group_id: 'grp-1',
    recipient_user_id: 'user-1',
    category: 'MENTION',
    subject_type: 'message',
    subject_id: 'msg-1',
    title: 'Mentioned you',
    delivery_state: 'DELIVERED_REALTIME',
    read_at: null,
    created_at: '2025-01-01T00:00:00Z',
    target_route: '/message/msg-1',
  },
];

const ACTIVITY = [
  {
    id: 'act-1',
    group_id: 'grp-1',
    project_id: 'proj-1',
    actor_type: 'AI',
    activity_type: 'task.created',
    summary: 'Created task: Implement auth',
    subject_type: 'task',
    subject_id: 'task-1',
    visibility: 'PROJECT',
    occurred_at: '2025-01-01T00:00:00Z',
  },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('loadFeatureStores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls all six fetch functions in parallel with correct args', async () => {
    mockFetchTasks.mockResolvedValue(TASKS as never);
    mockFetchDecisions.mockResolvedValue(DECISIONS as never);
    mockFetchMemories.mockResolvedValue(MEMORIES as never);
    mockFetchCandidates.mockResolvedValue(CANDIDATES as never);
    mockFetchArtifacts.mockResolvedValue(ARTIFACTS as never);
    mockFetchNotifications.mockResolvedValue(NOTIFICATIONS as never);
    mockFetchActivity.mockResolvedValue(ACTIVITY as never);

    await loadFeatureStores('grp-1', 'proj-1');

    // Project-scoped
    expect(mockFetchTasks).toHaveBeenCalledWith('proj-1');
    expect(mockFetchDecisions).toHaveBeenCalledWith('proj-1');
    expect(mockFetchArtifacts).toHaveBeenCalledWith('proj-1');

    // Group-scoped
    expect(mockFetchMemories).toHaveBeenCalledWith('grp-1');
    expect(mockFetchCandidates).toHaveBeenCalledWith('grp-1');
    expect(mockFetchActivity).toHaveBeenCalledWith('grp-1');

    // User-scoped (no args)
    expect(mockFetchNotifications).toHaveBeenCalledTimes(1);
  });

  it('seeds tasks into useProjectDataStore', async () => {
    mockFetchTasks.mockResolvedValue(TASKS as never);
    mockFetchDecisions.mockResolvedValue([]);
    mockFetchMemories.mockResolvedValue([]);
    mockFetchCandidates.mockResolvedValue([]);
    mockFetchArtifacts.mockResolvedValue([]);
    mockFetchNotifications.mockResolvedValue([]);
    mockFetchActivity.mockResolvedValue([]);

    await loadFeatureStores('grp-1', 'proj-1');

    expect(mockSetProjectData).toHaveBeenCalledWith({ tasks: TASKS });
  });

  it('seeds decisions into useProjectDataStore', async () => {
    mockFetchTasks.mockResolvedValue([]);
    mockFetchDecisions.mockResolvedValue(DECISIONS as never);
    mockFetchMemories.mockResolvedValue([]);
    mockFetchCandidates.mockResolvedValue([]);
    mockFetchArtifacts.mockResolvedValue([]);
    mockFetchNotifications.mockResolvedValue([]);
    mockFetchActivity.mockResolvedValue([]);

    await loadFeatureStores('grp-1', 'proj-1');

    expect(mockSetProjectData).toHaveBeenCalledWith({ decisions: DECISIONS });
  });

  it('seeds memory and candidates into useProjectDataStore', async () => {
    mockFetchTasks.mockResolvedValue([]);
    mockFetchDecisions.mockResolvedValue([]);
    mockFetchMemories.mockResolvedValue(MEMORIES as never);
    mockFetchCandidates.mockResolvedValue(CANDIDATES as never);
    mockFetchArtifacts.mockResolvedValue([]);
    mockFetchNotifications.mockResolvedValue([]);
    mockFetchActivity.mockResolvedValue([]);

    await loadFeatureStores('grp-1', 'proj-1');

    expect(mockSetProjectData).toHaveBeenCalledWith({ memories: MEMORIES });
    expect(mockSetProjectData).toHaveBeenCalledWith({
      memoryCandidates: CANDIDATES,
    });
  });

  it('seeds artifacts into useArtifactStore', async () => {
    mockFetchTasks.mockResolvedValue([]);
    mockFetchDecisions.mockResolvedValue([]);
    mockFetchMemories.mockResolvedValue([]);
    mockFetchCandidates.mockResolvedValue([]);
    mockFetchArtifacts.mockResolvedValue(ARTIFACTS as never);
    mockFetchNotifications.mockResolvedValue([]);
    mockFetchActivity.mockResolvedValue([]);

    await loadFeatureStores('grp-1', 'proj-1');

    expect(mockSetArtifact).toHaveBeenCalledWith({ artifacts: ARTIFACTS });
  });

  it('seeds notifications and activity into useProjectDataStore', async () => {
    mockFetchTasks.mockResolvedValue([]);
    mockFetchDecisions.mockResolvedValue([]);
    mockFetchMemories.mockResolvedValue([]);
    mockFetchCandidates.mockResolvedValue([]);
    mockFetchArtifacts.mockResolvedValue([]);
    mockFetchNotifications.mockResolvedValue(NOTIFICATIONS as never);
    mockFetchActivity.mockResolvedValue(ACTIVITY as never);

    await loadFeatureStores('grp-1', 'proj-1');

    expect(mockSetProjectData).toHaveBeenCalledWith({
      notifications: NOTIFICATIONS,
    });
    expect(mockSetProjectData).toHaveBeenCalledWith({
      activityEvents: ACTIVITY,
    });
  });

  it('skips project-scoped fetches when projectId is absent', async () => {
    mockFetchTasks.mockResolvedValue([]);
    mockFetchDecisions.mockResolvedValue([]);
    mockFetchMemories.mockResolvedValue([]);
    mockFetchCandidates.mockResolvedValue([]);
    mockFetchArtifacts.mockResolvedValue([]);
    mockFetchNotifications.mockResolvedValue([]);
    mockFetchActivity.mockResolvedValue([]);

    await loadFeatureStores('grp-1');

    expect(mockFetchTasks).not.toHaveBeenCalled();
    expect(mockFetchDecisions).not.toHaveBeenCalled();
    expect(mockFetchArtifacts).not.toHaveBeenCalled();

    // Group + user-scoped still called
    expect(mockFetchMemories).toHaveBeenCalledWith('grp-1');
    expect(mockFetchCandidates).toHaveBeenCalledWith('grp-1');
    expect(mockFetchActivity).toHaveBeenCalledWith('grp-1');
    expect(mockFetchNotifications).toHaveBeenCalledTimes(1);
  });

  it('continues when one fetch 404s', async () => {
    mockFetchTasks.mockRejectedValue(
      Object.assign(new Error('NOT_FOUND'), { status: 404 }),
    );
    mockFetchDecisions.mockResolvedValue(DECISIONS as never);
    mockFetchMemories.mockResolvedValue(MEMORIES as never);
    mockFetchCandidates.mockResolvedValue([]);
    mockFetchArtifacts.mockResolvedValue(ARTIFACTS as never);
    mockFetchNotifications.mockResolvedValue(NOTIFICATIONS as never);
    mockFetchActivity.mockResolvedValue(ACTIVITY as never);

    // Should not throw
    await loadFeatureStores('grp-1', 'proj-1');

    // Decisions + Artifacts still seeded despite tasks 404
    expect(mockSetProjectData).toHaveBeenCalledWith({ decisions: DECISIONS });
    expect(mockSetArtifact).toHaveBeenCalledWith({ artifacts: ARTIFACTS });
    expect(mockSetProjectData).toHaveBeenCalledWith({ memories: MEMORIES });
    expect(mockSetProjectData).toHaveBeenCalledWith({
      notifications: NOTIFICATIONS,
    });
    expect(mockSetProjectData).toHaveBeenCalledWith({ activityEvents: ACTIVITY });
  });

  it('continues when all fetches fail', async () => {
    const err = Object.assign(new Error('NETWORK'), { status: 500 });
    mockFetchTasks.mockRejectedValue(err);
    mockFetchDecisions.mockRejectedValue(err);
    mockFetchMemories.mockRejectedValue(err);
    mockFetchCandidates.mockRejectedValue(err);
    mockFetchArtifacts.mockRejectedValue(err);
    mockFetchNotifications.mockRejectedValue(err);
    mockFetchActivity.mockRejectedValue(err);

    // Should not throw — all errors are caught
    await loadFeatureStores('grp-1', 'proj-1');
  });
});
