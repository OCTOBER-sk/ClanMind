import { buildServices, buildBackgroundRuntime } from "./services";
import { createApp } from "./app";
import type { Env } from "./env";
import { GroupRoom } from "./realtime/group-room";

/**
 * Worker entrypoint (spec §3.2, §103). One application; domain modules live
 * behind service interfaces (§182–§186). The cron trigger drives the §158
 * background job runner and the §124 outbox consumers.
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
    const runtime = buildBackgroundRuntime(env);
    ctx.waitUntil(
      (async () => {
        await runtime.drainOutbox();
        await runtime.runDueJobs();
      })(),
    );
  },
};

export { GroupRoom };
