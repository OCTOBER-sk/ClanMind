/**
 * Client mirrors of the BE §178 "Recommended Initial Limits" that shape
 * composer/upload UX. These exist for PRE-FLIGHT rejection only — the server
 * remains the security authority and re-validates every upload against its
 * own configuration (`LIMITS_JSON`, tunable per environment). When the server
 * answers VALIDATION_FAILED anyway, its envelope is surfaced verbatim
 * (§51/§236) rather than a hardcoded guess.
 *
 * Values here must track the backend defaults; they are deliberately NOT
 * inlined into components so there is exactly one place to tune.
 */

/** §178: Attachment upload size — 25 MB per file (26,214,400 bytes). */
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

/** §178: Attachments per message — 10. */
export const ATTACHMENTS_PER_MESSAGE_MAX = 10;

/** §178 signed URL lifetime (seconds) — used to know when previews need re-signing. */
export const SIGNED_URL_LIFETIME_SECONDS = 15 * 60;

/** Compact human size for chips ("1.2 MB"), stable across the app. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb >= 100 ? Math.round(kb) : kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
}
