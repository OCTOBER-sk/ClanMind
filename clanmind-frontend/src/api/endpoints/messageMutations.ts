/**
 * Message mutation endpoints — edit / pin / unpin (BE §39 edit, §111 pins).
 * The ONLY REST sites for these mutations (FE layer boundary §9).
 */
import { api } from '@/api/client';

/** BE §39 — edit own message body. Returns the updated message row. */
export function editMessage(messageId: string, body: string): Promise<unknown> {
  return api.patch(`/messages/${encodeURIComponent(messageId)}`, { body });
}

/** BE §111 — pin a message (Owner/Admin). */
export function pinMessage(messageId: string): Promise<unknown> {
  return api.post(`/messages/${encodeURIComponent(messageId)}/pin`, {});
}

/** BE §111 — unpin a message (Owner/Admin). */
export function unpinMessage(messageId: string): Promise<unknown> {
  return api.post(`/messages/${encodeURIComponent(messageId)}/unpin`, {});
}
