/**
 * §171/§276 notification preference storage — the single source both the
 * Settings matrix and the OS-notification pipeline read. Preferences are
 * per (user, Group, category) on the backend (`notification_preferences`,
 * BE §95A); until the Worker exposes GET/PATCH routes for them (recorded
 * gap), this mirror persists the matrix client-side under one shared key
 * so every consumer reads the same values.
 *
 * Channel semantics per FE §171:
 *   • In-app ↔ backend column `in_app_enabled`
 *   • Email  ↔ backend column `email_enabled`
 *   • Desktop is CLIENT-DERIVED (not a backend column): an OS push fires
 *     only when in-app is enabled AND the local desktop toggle is on AND
 *     the OS permission was granted (§194).
 */

import type { NotificationCategory } from '@/types';

export interface ChannelPrefs {
  /** Mirrors notification_preferences.in_app_enabled (default true). */
  inApp: boolean;
  /** Client-derived desktop push toggle — NOT a backend column (§171). */
  desktop: boolean;
  /** Mirrors notification_preferences.email_enabled (default false). */
  email: boolean;
}

export const DEFAULT_CHANNELS: ChannelPrefs = { inApp: true, desktop: true, email: false };

export const NOTIFICATION_PREF_CATEGORIES: NotificationCategory[] = [
  'MENTION',
  'PRIVATE_MESSAGE',
  'AI_RESPONSE',
  'AI_ACTION_APPROVAL',
  'TASK_ASSIGNMENT',
  'DECISION_APPROVAL',
  'ARTIFACT_READY',
  'GITHUB_EVENT',
  'MEETING_SUMMARY',
  'PROACTIVE_AI',
  'SYSTEM',
];

const KEY_PREFIX = 'cm_notif_';
/** §278 — hide message content in OS notification previews. */
const HIDE_PREVIEW_KEY = 'cm_notif_hide_preview';

export function notificationPrefsStorageKey(groupId: string): string {
  return `${KEY_PREFIX}${groupId}`;
}

function sanitize(raw: unknown): Record<NotificationCategory, ChannelPrefs> {
  return Object.fromEntries(
    NOTIFICATION_PREF_CATEGORIES.map((c) => {
      const entry = (raw as Record<string, Partial<ChannelPrefs>> | null)?.[c];
      return [
        c,
        {
          inApp: typeof entry?.inApp === 'boolean' ? entry.inApp : DEFAULT_CHANNELS.inApp,
          desktop: typeof entry?.desktop === 'boolean' ? entry.desktop : DEFAULT_CHANNELS.desktop,
          email: typeof entry?.email === 'boolean' ? entry.email : DEFAULT_CHANNELS.email,
        },
      ];
    }),
  ) as Record<NotificationCategory, ChannelPrefs>;
}

export function loadNotificationPrefs(
  groupId: string,
  storage: Pick<Storage, 'getItem'> = localStorage,
): Record<NotificationCategory, ChannelPrefs> {
  try {
    const stored = storage.getItem(notificationPrefsStorageKey(groupId));
    if (stored) return sanitize(JSON.parse(stored));
  } catch {
    /* fall through to defaults */
  }
  return sanitize(null);
}

export function saveNotificationPrefs(
  groupId: string,
  prefs: Record<NotificationCategory, ChannelPrefs>,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(notificationPrefsStorageKey(groupId), JSON.stringify(prefs));
}

/** §278 content-hidden preview option. */
export function loadHidePreview(storage: Pick<Storage, 'getItem'> = localStorage): boolean {
  return storage.getItem(HIDE_PREVIEW_KEY) === 'true';
}

export function saveHidePreview(value: boolean, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(HIDE_PREVIEW_KEY, value ? 'true' : 'false');
}
