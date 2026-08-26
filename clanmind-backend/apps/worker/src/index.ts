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
    // §15/§16 WebSocket room entry — handle the upgrade here, before Hono's
    // Bearer-header auth (browsers can't set headers on an upgrade; the DO
    // re-verifies the JWT from `?token` + Group membership in handleConnect).
    const url = new URL(request.url);
    if (url.pathname.endsWith("/ws") && request.headers.get("upgrade") === "websocket") {
      // groupId from the /api/v1/groups/<id>/ws path (robust, no .at()).
      const m = url.pathname.match(/^\/api\/v1\/groups\/([^/]+)\/ws$/);
      const groupId: string = m ? (m[1] ?? "") : "";
      const id = env.GROUP_ROOM.idFromName(groupId);
      const stub = env.GROUP_ROOM.get(id);
      // Carry the groupId to the DO explicitly (dev Miniflare exposes an empty
      // state.id.name); the DO falls back to this header in handleConnect.
      const proxied = new Request(`https://room/ws${url.search}`, request);
      proxied.headers.set("x-room-group", groupId);
      return stub.fetch(proxied);
    }
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
