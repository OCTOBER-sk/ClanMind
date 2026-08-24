/**
 * Demo runtime registry — the seam between production code and demo-only
 * behavior. Runtime modules depend ONLY on this interface; the implementation
 * is loaded exclusively when VITE_DEMO_MODE=1 and is absent from prod bundles.
 */

import type { RealtimeSocketLike } from '@/realtime/connection';

export interface DemoAiRunOptions {
  messageId: string;
  /**
   * Run id minted by the caller so cancel-by-id (§137 REST mirror) and
   * shell.ai_run_id stay consistent with the emitted event stream.
   */
  runId?: string;
  groupId: string;
  projectId?: string | null;
  prompt: string;
  aiName: string;
}

export interface DemoRuntime {
  /** Starts a full §134A run driven by real socket events; returns cancel. */
  simulateAiRun(opts: DemoAiRunOptions): () => void;
  /** §141 quota-failure injection for a message's run. */
  applyQuotaState(messageId: string, canContinueWithByok: boolean): void;
  /** §149/§150 proactive Odin message through the normal pipeline. */
  postProactiveOdinMessage(groupId: string, projectId: string | undefined, aiName: string): void;
  /** Socket factory handed to RealtimeClient in demo mode. */
  socketFactory(url: string): RealtimeSocketLike;
  /**
   * §124A — seed a freshly started demo meeting session with a rich set of
   * candidates + live notes. No-op for unknown sessions; absent in production.
   */
  seedMeeting(sessionId: string): void;
  /**
   * FE §197 — make every subsequent authenticated domain call answer
   * 401 AUTH_SESSION_EXPIRED until the next successful login.
   */
  expireSession(): void;
}

let current: DemoRuntime | null = null;

export function installDemoRuntime(runtime: DemoRuntime): void {
  current = runtime;
}

export function getDemoRuntime(): DemoRuntime | null {
  return current;
}
