/**
 * Demo mode entry point — loaded via dynamic import from bootstrap ONLY when
 * VITE_DEMO_MODE=1. Installs: dataset, REST transport override, realtime hub,
 * runtime registry, event dispatch, and store hydration. Production builds
 * never include this module or its imports.
 */

import { setTransportOverride } from '@/api/transport';
import { initRealtime, getRealtime } from '@/realtime/connection';
import { clientEvents, getDeviceId } from '@/realtime/events';
import { markProtocolUpdateRequired } from '@/sync/connectivity';
import { useArtifactStore } from '@/state/useArtifactStore';
import type { Message, MeetingCandidate } from '@/types';
import { detectMeetingCandidate } from '@/api/endpoints/meetings';
import { useChatStore } from '@/state/useChatStore';
import { useSyncStore } from '@/state/useSyncStore';
import { useMeetingStore } from '@/state/useMeetingStore';
import { createDemoDataset } from './dataset';
import {
  createDemoTransport,
  expireDemoSession,
} from './transportRoutes';
import { applyDemoHydration } from './hydrate';
import { getDemoHub } from './wsHub';
import { dispatchRealtimeEvent } from '@/realtime/dispatch';
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
        runId: opts.runId ?? `run_${Date.now()}`,
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
    expireSession() {
      expireDemoSession();
    },
    seedMeeting(sessionId) {
      // §124A — demo meetings seed a rich candidate set so the Meeting Panel
      // shows every candidate section. The seeds go through the REAL §50A
      // detect endpoint (POST /meetings/:id/candidates) so demo exercises the
      // exact payload shapes live mode uses; production never runs this.
      const { currentSession } = useMeetingStore.getState();
      if (!currentSession || currentSession.id !== sessionId) return;

      const seeds: Array<{
        candidate_type: MeetingCandidate['candidate_type'];
        title: string;
        confidence: number;
      }> = [
        {
          candidate_type: 'DECISION',
          title: 'Lock SPI bus at CPOL=0 / CPHA=1 for the ICM-42688P link',
          confidence: 0.92,
        },
        {
          candidate_type: 'TASK',
          title: 'Wire the 500 Hz control-loop telemetry path behind a compile-time flag',
          confidence: 0.88,
        },
        {
          candidate_type: 'CONTRADICTION',
          title:
            'Priya reported the attitude loop stable at 500 Hz, but Marcus\u2019s bench log shows dropped packets above 350 Hz.',
          confidence: 0.81,
        },
        {
          candidate_type: 'OPEN_QUESTION',
          title: 'Can flash logging stay on the same SPI bus without stalling the DMA ring buffer?',
          confidence: 0.74,
        },
        {
          candidate_type: 'RESEARCH_NEED',
          title: 'Benchmark DMA vs I2C throughput for sensor bursts on the STM32H7',
          confidence: 0.69,
        },
        {
          candidate_type: 'MILESTONE_CHANGE',
          title: 'Hardware validation milestone slips one week \u2014 IMU breakout boards arrive Thursday.',
          confidence: 0.77,
        },
      ];

      // §125 — two client-held live notes (no backend column; D23).
      const store = useMeetingStore.getState();
      store.addLiveNote('Priya confirms 500 Hz target is realistic with the new IMU driver.');
      store.addLiveNote('Odin flagged DMA contention risk during flash writes \u2014 parked as an open question.');

      void (async () => {
        for (const seed of seeds) {
          try {
            const row = await detectMeetingCandidate(sessionId, {
              candidate_type: seed.candidate_type,
              content: { project: 'Flight Controller', title: seed.title },
              confidence: seed.confidence,
            });
            useMeetingStore.getState().addCandidate(row);
          } catch {
            // A rejected detect (e.g. meeting already ended) must not wedge
            // the demo panel; remaining seeds still try.
          }
        }
      })();
    },
  };
  installDemoRuntime(runtime);

  // 3. Route demo socket traffic through the SAME dispatch pipeline production
  // uses — the client cannot tell demo from live inside its own code paths.
  // §17.1 gap recovery and §186A.1 checkpoint advancement are wired
  // IDENTICALLY to live mode (src/live/liveRuntime.ts) — one pattern, both
  // transports, per D2/D7.
  const demoGroupId = ds.groups[0]?.id;
  initRealtime({
    getToken: async () => 'demo-token',
    socketFactory: runtime.socketFactory,
    onStatus: () => {},
    onEvent: (event) => dispatchRealtimeEvent(event),
    onReady: () => {},
    onProtocolRequired: markProtocolUpdateRequired,
    onSequenceGap: (gapGroupId, from) => {
      getRealtime().send(clientEvents.syncRequest(gapGroupId, from));
    },
    onSequenceAdvance: (groupId, sequence) => {
      useSyncStore.getState().setCheckpoint({
        device_id: getDeviceId(),
        group_id: groupId,
        last_server_sequence: sequence,
        last_synced_at: new Date().toISOString(),
      });
    },
  }).connect([demoGroupId].filter((id): id is string => Boolean(id)));

  // 4. Hydrate stores (runtime stores ship empty in live mode).
  applyDemoHydration(ds);

  return {
    shutdown() {
      setTransportOverride(null);
    },
  };
}
