import { buildServices, buildBackgroundRuntime } from "./services";
import { createApp } from "./app";
import type { Env } from "./env";
import { GroupRoom } from "./realtime/group-room";
import { getAiRuntime } from "./ai";

/**
 * Worker entrypoint (spec §3.2, §103). One application; domain modules live
 * behind service interfaces (§182–§186). The cron trigger drives the §158
 * background job runner, the §124 outbox consumers, and the §78A approval
 * expiry sweeper.
 */
export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    const app = createApp(buildServices(env));
    return app.fetch(request, env, ctx);
  },
  scheduled: async (
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) => {
    const services = buildServices(env);
    const runtime = buildBackgroundRuntime(env);
    ctx.waitUntil(
      (async () => {
        await runtime.drainOutbox();
        await runtime.runDueJobs();
        // §78A lifecycle: unapproved/stale actions expire on schedule.
        try {
          await getAiRuntime(env, services).expireStaleActions();
        } catch {
          // Sweeping is best-effort; never block the rest of the tick.
        }
      })(),
    );
  },
};

export { GroupRoom };
