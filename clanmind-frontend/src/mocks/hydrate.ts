/**
 * Demo hydration — fills client stores from the dataset at boot in demo mode.
 * Runtime stores ship EMPTY; only this module (demo-only) populates them,
 * so live-mode code paths can never silently fall back to fixture content.
 */

import { useGroupStore } from '@/state/useGroupStore';
import { useChatStore } from '@/state/useChatStore';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import { useArtifactStore } from '@/state/useArtifactStore';
import type { DemoDataset } from './dataset';

export function applyDemoHydration(ds: DemoDataset): void {
  const primaryProject = ds.projects.find((p) => p.id === 'proj_flight_ctrl') ?? ds.projects[0] ?? null;

  useGroupStore.setState({
    groups: [...ds.groups],
    activeGroup: ds.groups[0] ?? null,
    projects: [...ds.projects],
    activeProject: primaryProject,
    members: [...ds.members],
    featureFlags: { ...ds.featureFlags },
    memberNicknames: {
      user_arun_1: 'Arun (Lead)',
      user_priya_2: 'Priya (Firmware)',
      user_marcus_3: 'Marcus (Hardware)',
    },
  });

  useChatStore.setState({
    messages: [...ds.messages],
    projectFilterId: primaryProject?.id,
  });

  useProjectDataStore.setState({
    tasks: [...ds.tasks],
    decisions: [...ds.decisions],
    memories: [...ds.memories],
    memoryCandidates: [...ds.memoryCandidates],
    notifications: [...ds.notifications],
    aiActions: ds.aiActions.map((a) => ({ ...a })),
  });

  const firstArtifact = ds.artifacts[0] ?? null;
  useArtifactStore.setState({
    artifacts: ds.artifacts.map((a) => ({
      ...a,
      versions: a.versions.map((v) => ({ ...v })),
    })),
    activeArtifact: firstArtifact ? { ...firstArtifact } : null,
    activeVersionNumber: firstArtifact?.current_version ?? 1,
    rightPanelMode: firstArtifact ? 'artifact' : 'closed',
    aiRunsByMessage: {},
  });
}
