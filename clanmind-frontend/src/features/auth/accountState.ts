/**
 * Account-scoped local state lifecycle (R4 / FE §283/§284).
 *
 * Signing out or switching accounts must leave NOTHING of the previous
 * account behind: domain zustand stores are reset to pristine defaults,
 * persisted `cm_*` slices are re-synced (empty), and the account's IndexedDB
 * (`cm_<userId>`) is closed and deleted. The ONLY device-local survivors are
 * true device preferences in useUiStore (theme, panel widths) which carry no
 * account data.
 *
 * Session expiry (FE §197) deliberately does NOT route through here — local
 * work must survive until the same account signs back in.
 */

import { useChatStore } from '@/state/useChatStore';
import { useGroupStore, DEFAULT_FLAGS } from '@/state/useGroupStore';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import { useArtifactStore } from '@/state/useArtifactStore';
import { useMeetingStore } from '@/state/useMeetingStore';
import { useSyncStore } from '@/state/useSyncStore';
import { useUiStore } from '@/state/useUiStore';
import { wipeAccountDb } from '@/local/db';

export function clearDomainStores(): void {
  // The meeting timer interval is owned by the shell's useEffect — dropping
  // the active flags stops it; state itself resets via resetMeeting().
  useMeetingStore.getState().resetMeeting();

  useChatStore.setState({
    messages: [],
    replyTarget: null,
    composerText: '',
    composerAttachments: [],
    visibility: 'GROUP',
    privateRecipientId: undefined,
    privateRecipientName: undefined,
    typingUsers: [],
    draftsByScope: {},
    lastReadMessageIdByScope: {},
    pendingMessages: [],
    projectFilterId: undefined,
  });

  useGroupStore.setState({
    groups: [],
    activeGroup: null,
    projects: [],
    activeProject: null,
    members: [],
    featureFlags: { ...DEFAULT_FLAGS },
    memberNicknames: {},
    flagsLoading: false,
  });

  useProjectDataStore.setState({
    tasks: [],
    decisions: [],
    memories: [],
    memoryCandidates: [],
    notifications: [],
    activityEvents: [],
    aiActions: [],
  });

  useArtifactStore.setState({
    artifacts: [],
    activeArtifact: null,
    activeVersionNumber: 1,
    compareVersionNumber: null,
    rightPanelMode: 'closed',
    aiRunByArtifact: {},
    aiRunsByMessage: {},
  });

  // Sync queue/checkpoint/conflicts belong to the account's data plane.
  // The durable IndexedDB mirror dies with the account DB below
  // (wipeAccountDb); queued operations for the SAME account signing back in
  // survive logout (FE §197) because that path never runs this wipe.
  useSyncStore.setState({
    status: 'connected',
    pendingOperationsCount: 0,
    pendingOperations: [],
    conflicts: [],
    activeConflict: null,
    checkpoint: null,
    protocolMismatch: null,
    recommendedUpdate: { available: false, dismissed: false },
  });

  // Per-ACCOUNT ui flag only — theme/panel widths stay (device prefs).
  useUiStore.setState({ onboardingComplete: false });
}

/** FE §284 — wipe every trace of an account from this device. */
export async function clearAccountLocalState(userId: string): Promise<void> {
  clearDomainStores();
  await wipeAccountDb(userId);
}
