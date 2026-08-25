/**
 * LIVE-mode runtime — group bootstrap + realtime wiring for the real
 * backend. Loaded ONLY when __DEMO_MODE__ is false; demo mode keeps its
 * deterministic hub (src/mocks) behind the compile gate.
 *
 * Endpoints consumed (all zod-validated at the boundary, BE §102 errors
 * surface through ApiError):
 *   GET /groups                          → { items: Group[] }        (§104)
 *   GET /groups/:id/projects             → { items: Project[] }      (§104)
 *   GET /groups/:id/members              → { items: GroupMember[] }  (§104)
 *   GET /client-versions                 → §165 metadata (309A.1 banner)
 *   WS  /groups/:id/ws?token=…           → per-group room (§16)
 *
 * Message HISTORY is intentionally NOT prefetched here: P3 moves history to
 * the TanStack Query cursor-pagination layer (src/api/endpoints/messages.ts,
 * FE §202/§289) — one owner, no duplicate source of truth.
 */

import { api } from '@/api/client';
import type { ZodTypeAny, z as zodNamespace } from 'zod';
import {
  GroupSchema,
  ProjectSchema,
  VersionMetaSchema,
} from '@/api/schemas';
import { wsRoomEndpoint, env } from '@/config/env';
import { initRealtime, getRealtime } from '@/realtime/connection';
import { clientEvents, getDeviceId } from '@/realtime/events';
import { dispatchRealtimeEvent, bindRunToMessage } from '@/realtime/dispatch';
import { initConnectivity, markProtocolUpdateRequired } from '@/sync/connectivity';
import { useGroupStore, DEFAULT_FLAGS } from '@/state/useGroupStore';
import { useChatStore } from '@/state/useChatStore';
import { useSyncStore } from '@/state/useSyncStore';
import type { Group, Project } from '@/types';

type ZodInfer<T extends ZodTypeAny> = zodNamespace.infer<T>;
type BEGroup = ZodInfer<typeof GroupSchema>;
type BEProject = ZodInfer<typeof ProjectSchema>;

// ─── Row mapping (BE §24/§29/§39 rows → canonical FE types) ─────────────────

function mapGroup(row: BEGroup): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    status: 'ACTIVE',
    // §2.2 — one shared AI per Group; the agent's configured name is only
    // exposed via the admin-only ai/config endpoint, so members render the
    // spec default. Never a fixture value.
    ai_name: 'Odin',
    ai_proactivity: 'off',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapProject(row: BEProject): Project {
  return {
    id: row.id,
    group_id: row.group_id,
    name: row.name,
    goal: row.goal ?? undefined,
    description: row.description ?? undefined,
    project_type: (row.project_type ?? 'other') as Project['project_type'],
    status: row.status === 'archived' ? 'archived' : 'active',
    pulse_progress: typeof row.progress === 'number' ? row.progress : 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

interface ItemsPage<T> {
  items?: T[];
}

/** GET + validate `{ items: [...] }` list envelopes (tolerates bare arrays). */
async function getItems<TSchema extends ZodTypeAny>(
  path: string,
  schema: TSchema,
): Promise<ZodInfer<TSchema>[]> {
  const page = await api.get<ItemsPage<unknown> | unknown[]>(path);
  const rows = Array.isArray(page) ? page : (page.items ?? []);
  return rows.flatMap((row) => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data as ZodInfer<TSchema>] : [];
  });
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

let bootstrapped = false;

/**
 * Fill the runtime stores from the real backend before first render of the
 * authenticated shell. Idempotent per session; failures throw so App can
 * keep the user on cached local state (FE §182 offline-equivalent).
 */
export async function bootstrapLiveGroups(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  const groups = await getItems('/groups', GroupSchema);
  const mappedGroups = groups.map(mapGroup);
  const activeGroup = mappedGroups[0] ?? null;

  let projects: Project[] = [];
  const memberNames = new Map<string, string>();

  if (activeGroup) {
    const [projectRows, memberPage] = await Promise.all([
      getItems(`/groups/${activeGroup.id}/projects`, ProjectSchema).catch(() => []),
      api
        .get<ItemsPage<{ user_id: string; group_display_name?: string | null }>>(
          `/groups/${activeGroup.id}/members`,
        )
        .catch(() => ({ items: [] as Array<{ user_id: string; group_display_name?: string | null }> })),
    ]);

    projects = projectRows.map(mapProject);
    for (const m of memberPage.items ?? []) {
      if (m.user_id) memberNames.set(m.user_id, m.group_display_name ?? 'Member');
    }

    useGroupStore.setState({
      groups: mappedGroups,
      activeGroup,
      projects,
      activeProject: projects[0] ?? null,
      featureFlags: { ...DEFAULT_FLAGS }, // §165A — server flags endpoint pending; safe defaults
      memberNicknames: Object.fromEntries(memberNames),
    });
    // History arrives through the messages query layer (FE §202/§289);
    // only the project context filter is seeded here.
    useChatStore.setState({ messages: [], projectFilterId: projects[0]?.id });
  } else {
    useGroupStore.setState({ groups: [], activeGroup: null });
  }

  // §165/§309A.1 — recommended-update metadata for the non-blocking banner.
  // The authoritative gate stays the server's connect-time response (309A.3).
  void api
    .get<unknown>('/client-versions')
    .then((raw) => {
      const parsed = VersionMetaSchema.safeParse(raw);
      if (!parsed.success) return;
      useSyncStore.getState().setRecommendedUpdate({
        available: parsed.data.recommended_client_version !== env.appVersion,
        version: parsed.data.recommended_client_version,
      });
    })
    .catch(() => undefined);
}

export function bindRunId(runId: string, messageId: string): void {
  bindRunToMessage(runId, messageId);
}

// ─── Realtime ────────────────────────────────────────────────────────────────

let realtimeReady = false;

/**
 * Initialise + connect the live realtime socket. The real Worker exposes one
 * Durable-Object room PER GROUP (`/api/v1/groups/:id/ws`), so a connection
 * targets the active group; switching groups re-points via connectToGroup().
 */
export function ensureLiveRealtime(groupId?: string): void {
  if (!realtimeReady) {
    realtimeReady = true;
    initRealtime({
      url: groupId ? wsRoomEndpoint(groupId) : undefined,
      getToken: async () => {
        const { getSupabase } = await import('@/api/supabase');
        const { data } = await getSupabase().auth.getSession();
        return data.session?.access_token ?? null;
      },
      onStatus: () => {},
      onEvent: dispatchRealtimeEvent,
      onReady: (ready) => {
        // §20A checkpoint advances with the room allocator position.
        const activeGroupId = useGroupStore.getState().activeGroup?.id;
        if (!activeGroupId || typeof ready.sequence !== 'number') return;
        useSyncStore.getState().setCheckpoint({
          device_id: getDeviceId(),
          group_id: activeGroupId,
          last_server_sequence: ready.sequence,
          last_synced_at: new Date().toISOString(),
        });
      },
      onProtocolRequired: markProtocolUpdateRequired,
      onSequenceGap: (gapGroupId, from) => {
        // §17.1 — recover missing events from the room ring.
        getRealtime().send(clientEvents.syncRequest(gapGroupId, from));
      },
      onSequenceAdvance: (groupId, sequence) => {
        // §186A.1 — the checkpoint IS the reconnect resume point; it must
        // track applied sequences, not just the handshake position.
        useSyncStore.getState().setCheckpoint({
          device_id: getDeviceId(),
          group_id: groupId,
          last_server_sequence: sequence,
          last_synced_at: new Date().toISOString(),
        });
      },
    });
    initConnectivity(getRealtime());
  }
  getRealtime().connect(groupId ? [groupId] : []);
}

/** Point (or re-point) the live socket at a group room. */
export function connectToGroup(groupId: string): void {
  if (!realtimeReady) {
    ensureLiveRealtime(groupId);
    return;
  }
  const client = getRealtime();
  client.setGroups([groupId]);
}
