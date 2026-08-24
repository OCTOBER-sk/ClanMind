/**
 * Notifications endpoint module — the ONLY REST site for the notification
 * surface (FE §9 layer boundary). Wire contracts mirror the REAL Worker
 * handlers/search.ts + NotificationService exactly:
 *
 *   GET  /api/v1/notifications?limit=&unread=   → { items: §95A[] }   (limit clamped ≤100, created_at DESC)
 *   POST /api/v1/notifications/:id/read         → { ok: true }        (stamps read_at; idempotent —
 *                                                                     unknown/foreign ids still answer ok)
 *   GET  /api/v1/groups/:groupId/activity       → { items: §98A[] }   (membership-checked)
 *
 * Read state rides the server's `read_at` column (BE §95A); the FE never
 * invents a local-only read flag. `target_route` is derived client-side
 * from (subject_type, subject_id) per the FE §193 stable deep links.
 */

import { z } from 'zod';
import { api } from '@/api/client';
import {
  ActivityEventSchema,
  ActivityListSchema,
  NotificationListSchema,
  NotificationSchema,
} from '@/api/schemas';
import type { ActivityEvent, Notification } from '@/types';

type NotificationRow = z.infer<typeof NotificationSchema>;
type ActivityRow = z.infer<typeof ActivityEventSchema>;

/**
 * §193 stable routes for a notification subject. Unknown subject types fall
 * back to the Group Activity surface — the safest shared view — rather than
 * an erroring dead link (same policy as ObjectRedirect unknown ids).
 */
export function notificationTargetRoute(
  subjectType: string,
  subjectId: string,
  groupId: string,
): string {
  switch (subjectType) {
    case 'message':
      return `/message/${encodeURIComponent(subjectId)}`;
    case 'artifact':
      return `/artifact/${encodeURIComponent(subjectId)}`;
    case 'task':
      return `/task/${encodeURIComponent(subjectId)}`;
    case 'decision':
      return `/decision/${encodeURIComponent(subjectId)}`;
    case 'meeting_session':
    case 'meeting':
      return `/meeting/${encodeURIComponent(subjectId)}`;
    default:
      return `/group/${encodeURIComponent(groupId)}/activity`;
  }
}

/** Map a validated §95A wire row into the canonical FE Notification. */
export function mapNotificationRow(row: NotificationRow): Notification {
  const category = row.category as Notification['category'];
  return {
    id: row.id,
    group_id: row.group_id,
    project_id: row.project_id ?? null,
    recipient_user_id: row.recipient_user_id,
    category,
    subject_type: row.subject_type,
    subject_id: row.subject_id,
    title: row.title,
    body: row.body ?? null,
    delivery_state: row.delivery_state as Notification['delivery_state'],
    read_at: row.read_at ?? null,
    created_at: row.created_at,
    target_route: notificationTargetRoute(row.subject_type, row.subject_id, row.group_id),
  };
}

export interface FetchNotificationsInput {
  /** Server clamps to 100 (handlers/search.ts). */
  limit?: number;
  /** `unread=true` → server filters read_at IS NULL. */
  unreadOnly?: boolean;
}

/** GET /notifications — rows for the authenticated recipient, newest first. */
export async function fetchNotifications(
  input: FetchNotificationsInput = {},
): Promise<Notification[]> {
  const query: Record<string, string> = {};
  if (input.limit !== undefined) query.limit = String(input.limit);
  if (input.unreadOnly) query.unread = 'true';
  const raw = await api.get('/notifications', { query });
  const page = NotificationListSchema.safeParse(raw);
  if (!page.success) return [];
  return (page.data.items ?? []).flatMap((row) => {
    const parsed = NotificationSchema.safeParse(row);
    return parsed.success ? [mapNotificationRow(parsed.data)] : [];
  });
}

/**
 * POST /notifications/:id/read — stamps the server-side read_at. The real
 * handler answers `{ok:true}` even when the id does not exist or belongs to
 * another recipient (UPDATE matches zero rows silently), so this returns
 * void and callers reconcile from their next list fetch.
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  await api.post(`/notifications/${encodeURIComponent(notificationId)}/read`, {});
}

function mapActivity(raw: unknown): ActivityEvent[] {
  const page = ActivityListSchema.safeParse(raw);
  if (!page.success) return [];
  return (page.data.items ?? []).flatMap((row) => {
    const parsed = ActivityEventSchema.safeParse(row);
    if (!parsed.success) return [];
    const r = parsed.data as ActivityRow;
    return [
      {
        id: r.id,
        group_id: r.group_id,
        project_id: r.project_id ?? null,
        actor_type: r.actor_type,
        actor_user_id: r.actor_user_id ?? null,
        actor_ai_id: r.actor_ai_id ?? null,
        activity_type: r.activity_type,
        summary: r.summary,
        subject_type: r.subject_type,
        subject_id: r.subject_id,
        visibility: r.visibility,
        occurred_at: r.occurred_at,
      },
    ];
  });
}

/** GET /groups/:groupId/activity — the §172/§98A attention feed. */
export async function fetchGroupActivity(
  groupId: string,
  limit = 50,
): Promise<ActivityEvent[]> {
  const raw = await api.get(`/groups/${encodeURIComponent(groupId)}/activity`, {
    query: { limit: String(limit) },
  });
  return mapActivity(raw);
}
