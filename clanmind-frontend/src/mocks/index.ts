/**
 * Demo mode entry point — loaded via dynamic import from bootstrap ONLY when
 * VITE_DEMO_MODE=1. Installs: dataset, REST transport override, realtime hub,
 * runtime registry, event dispatch, and store hydration. Production builds
 * never include this module or its imports.
 */

import { setTransportOverride } from '@/api/transport';
import { initRealtime } from '@/realtime/connection';
import { useArtifactStore } from '@/state/useArtifactStore';
import type { Message, MeetingCandidate } from '@/types';
import { useChatStore } from '@/state/useChatStore';
import { useMeetingStore } from '@/state/useMeetingStore';
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
    seedMeeting(sessionId) {
      // §124A — demo meetings start with a rich candidate set so the Meeting
      // Panel shows every candidate section. Production never runs this.
      const session = useMeetingStore.getState().currentSession;
      if (!session || session.id !== sessionId) return;

      const now = new Date().toISOString();
      const base = {
        meeting_id: sessionId,
        group_id: session.group_id,
        project_id: session.project_id,
        status: 'PENDING',
        created_at: now,
      } satisfies Partial<MeetingCandidate>;

      const seeds: Array<Pick<MeetingCandidate, 'id' | 'candidate_type' | 'content'>> = [
        {
          id: `${sessionId}_cand_decision`,
          candidate_type: 'DECISION',
          content:
            'Lock SPI bus at CPOL=0 / CPHA=1 for the ICM-42688P link — matches the bench logic capture.',
        },
        {
          id: `${sessionId}_cand_task`,
          candidate_type: 'TASK',
          content:
            'Marcus wires the 500 Hz control-loop telemetry path behind a compile-time flag before Friday.',
        },
        {
          id: `${sessionId}_cand_contradiction`,
          candidate_type: 'CONTRADICTION',
          content:
            'Priya reported the attitude loop stable at 500 Hz, but Marcus\u2019s bench log shows dropped packets above 350 Hz.',
        },
        {
          id: `${sessionId}_cand_question`,
          candidate_type: 'OPEN_QUESTION',
          content:
            'Can flash logging stay on the same SPI bus without stalling the DMA ring buffer?',
        },
        {
          id: `${sessionId}_cand_research`,
          candidate_type: 'RESEARCH_NEED',
          content:
            'Benchmark DMA vs I2C throughput for sensor bursts on the STM32H7 before choosing the final bus map.',
        },
        {
          id: `${sessionId}_cand_milestone`,
          candidate_type: 'MILESTONE_CHANGE',
          content:
            'Hardware validation milestone slips one week \u2014 IMU breakout boards arrive Thursday instead of Monday.',
        },
      ];

      useMeetingStore.setState({
        currentSession: {
          ...session,
          live_notes: [
            ...session.live_notes,
            'Priya confirms 500 Hz target is realistic with the new IMU driver.',
            'Odin flagged DMA contention risk during flash writes \u2014 parked as an open question.',
          ],
          candidates: [
            ...seeds.map((seed) => ({ ...base, ...seed }) as MeetingCandidate),
            ...session.candidates,
          ],
        },
      });
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
  }).connect([ds.groups[0]?.id].filter((id): id is string => Boolean(id)));

  // 4. Hydrate stores (runtime stores ship empty in live mode).
  applyDemoHydration(ds);

  return {
    shutdown() {
      setTransportOverride(null);
    },
  };
}
