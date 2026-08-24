/**
 * OS notification pipeline (FE §173/§174/§194/§278).
 *
 * A §95A row becomes a native OS notification ONLY when every gate agrees:
 *
 *   1. §174 importance — category ∈ {MENTION, PRIVATE_MESSAGE,
 *      AI_ACTION_APPROVAL, TASK_ASSIGNMENT, SYSTEM}. Everything else stays
 *      in-app; ordinary chat messages never interrupt.
 *   2. §171/§276 preference — the category's in-app toggle AND the
 *      client-derived desktop toggle are both on for this Group. The
 *      backend's SUPPRESSED_BY_PREFERENCE delivery_state is the server-side
 *      twin of gate 2 (in_app_enabled=false rows are suppressed there and
 *      still appear here as list items with that state verbatim, §171A).
 *   3. §278 privacy — when the user hides message content, previews ship
 *      title-only.
 *   4. §173 batching — while the window is hidden ("away"), noisy events do
 *      NOT fire one notification each; they accumulate into ONE aggregate
 *      ("3 new notifications · Mention ×2, Task ×1") delivered on return.
 *
 * In non-Tauri environments sendNativeNotification is a silent no-op, so
 * the pipeline is safe to run unconditionally in the browser.
 */

import { sendNativeNotification } from '@/tauri/bridge';
import {
  loadHidePreview,
  loadNotificationPrefs,
} from './notificationPrefs';
import { IMPORTANT_OS_CATEGORIES } from './notificationDisplay';
import type { Notification } from '@/types';

export interface OsDeliveryResult {
  /** 'sent' → handed to the bridge now; 'batched' → queued while away;
   *  'skipped' → an explicit gate kept it quiet (never an error). */
  outcome: 'sent' | 'batched' | 'skipped';
  reason?: string;
}

function isAway(): boolean {
  return typeof document !== 'undefined' && document.hidden === true;
}

// ─── §173 away batching ──────────────────────────────────────────────────────

interface BatchSummary {
  count: number;
  byCategory: Map<string, number>;
}

let batch: BatchSummary | null = null;

/** Test seam — clear the accumulated away batch between scenarios. */
export function resetAwayBatch(): void {
  batch = null;
}

function addToBatch(notification: Notification): void {
  if (!batch) batch = { count: 0, byCategory: new Map() };
  batch.count += 1;
  batch.byCategory.set(
    notification.category,
    (batch.byCategory.get(notification.category) ?? 0) + 1,
  );
}

function summarizeBatch(): string | null {
  if (!batch || batch.count === 0) return null;
  const parts = [...batch.byCategory.entries()].map(
    ([category, count]) =>
      `${categoryLabelForOs(category)} ×${count}`,
  );
  const summary = `${batch.count} new notification${batch.count === 1 ? '' : 's'}${parts.length ? ` · ${parts.join(', ')}` : ''}`;
  batch = null;
  return summary;
}

function categoryLabelForOs(category: string): string {
  switch (category) {
    case 'MENTION':
      return 'Mention';
    case 'PRIVATE_MESSAGE':
      return 'Private';
    case 'AI_ACTION_APPROVAL':
      return 'Approval';
    case 'TASK_ASSIGNMENT':
      return 'Task';
    case 'SYSTEM':
      return 'System';
    default:
      return 'Update';
  }
}

/**
 * Called when the window becomes visible again: delivers the single
 * aggregate for everything that arrived while away (§173). Returns the
 * summary text when something flushed.
 */
export async function flushAwayNotifications(): Promise<string | null> {
  const summary = summarizeBatch();
  if (!summary) return null;
  await sendNativeNotification({ title: 'ClanMind', body: summary });
  return summary;
}

/** Main entry point — dispatch calls this for every projected notification row. */
export async function deliverOsNotification(
  notification: Notification,
): Promise<OsDeliveryResult> {
  // Gate 1 — §174 important categories only.
  if (!IMPORTANT_OS_CATEGORIES.has(notification.category)) {
    return { outcome: 'skipped', reason: `category ${notification.category} is not OS-important` };
  }

  // Gate 2 — §171/§276 per-category channels (in-app + client desktop toggle).
  const prefs = loadNotificationPrefs(notification.group_id)[notification.category];
  if (!prefs?.inApp) {
    return { outcome: 'skipped', reason: 'SUPPRESSED_BY_PREFERENCE' };
  }
  if (!prefs?.desktop) {
    return { outcome: 'skipped', reason: 'desktop channel off' };
  }

  // Gate 4 — §173 batching while away.
  if (isAway()) {
    addToBatch(notification);
    return { outcome: 'batched' };
  }

  // Gate 3 — §278 content-hidden preview.
  const body = loadHidePreview() ? undefined : (notification.body ?? undefined);
  await sendNativeNotification({ title: notification.title, body });
  return { outcome: 'sent' };
}
