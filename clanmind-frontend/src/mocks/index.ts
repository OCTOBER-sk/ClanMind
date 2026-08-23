/**
 * Demo mode entry point — loaded via dynamic import from bootstrap ONLY when
 * VITE_DEMO_MODE=1. Installs: dataset, REST transport override, realtime hub,
 * runtime registry, event dispatch, and store hydration. Production builds
 * never include this module or its imports.
 */

import { setTransportOverride } from '@/api/transport';
import { initRealtime } from '@/realtime/connection';
import { useArtifactStore } from '@/state/useArtifactStore';
import type { Message } from '@/types';
import { useChatStore } from '@/state/useChatStore';
import { createDemoDataset } from './dataset';
import { createDemoTransport } from './transportRoutes';
import { applyDemoHydration } from './hydrate';
import { getDemoHub } from './wsHub';
import { handleDemoEvent } from './demoDispatch';
import { installDemoRuntime, type DemoRuntime } from './runtime';

export interface DemoModeHandle {
  shutdown(): void;
}

export function installDemoMode(): DemoModeHandle {
  const ds = createDemoDataset();

  // 1. REST: every api/ call resolves against the dataset contract.
  setTransportOverride(createDemoTransport(ds));

  // 2. Realtime: a deterministic hub speaking the BE §17/§114 envelope.
  const hub = getDemoHub();

  const runtime: DemoRuntime = {
    simulateAiRun(opts) {
      return hub.startAiRun({
        runId: `run_${Date.now()}`,
        messageId: opts.messageId,
        groupId: opts.groupId,
        projectId: opts.projectId ?? null,
        prompt: opts.prompt,
        aiName: opts.aiName,
      });
    },
    applyQuotaState(messageId, canContinueWithByok) {
      const current = useArtifactStore.getState().aiRunsByMessage[messageId];
      if (!current) return;
      useArtifactStore.getState().setAiRunByMessage(messageId, {
        ...current,
        status: 'FAILED',
        error_code: 'APPLICATION_AI_QUOTA_EXHAUSTED',
        can_continue_with_byok: canContinueWithByok,
        completed_at: new Date().toISOString(),
      });
    },
    postProactiveOdinMessage(groupId, projectId, aiName) {
      const msg = {
        id: `msg_proactive_${Date.now()}`,
        group_id: groupId,
        project_id: projectId ?? null,
        sender_type: 'AI',
        sender_id: 'odin_ai',
        sender_name: aiName,
        body: 'I noticed two conflicting architecture assumptions in the last messages. Want me to review them?',
        visibility: 'GROUP',
        pinned: false,
        edited: false,
        deleted: false,
        attachments: [],
        reactions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Message;
      useChatStore.getState().addMessage(msg);
      hub.messageCreated({ id: msg.id, group_id: msg.group_id });
    },
    socketFactory(url) {
      return hub.createSocket(url);
    },
  };
  installDemoRuntime(runtime);

  // 3. Route demo socket traffic through the SAME dispatch pipeline production
  // uses — the client cannot tell demo from live inside its own code paths.
  initRealtime({
    getToken: async () => 'demo-token',
    socketFactory: runtime.socketFactory,
    onStatus: () => {},
    onEvent: (event) => handleDemoEvent(event),
    onReady: () => {},
    onProtocolRequired: () => {},
    onSequenceGap: () => {},
  }).connect([ds.groups[0]?.id ?? 'grp_robotics_1']);

  // 4. Hydrate stores (runtime stores ship empty in live mode).
  applyDemoHydration(ds);

  return {
    shutdown() {
      setTransportOverride(null);
    },
  };
}
