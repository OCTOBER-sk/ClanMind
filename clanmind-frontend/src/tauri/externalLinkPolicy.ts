/**
 * Safe external-link policy — FE §295 (controlled mechanisms), §292 (never
 * trust URL parameters / arbitrary navigation).
 *
 * Rendered untrusted content (AI markdown bodies, artifact documents,
 * research-source cards) may contain links. Clicking them must NEVER navigate
 * the webview itself: http(s) targets are routed through the Tauri bridge's
 * `openExternalUrl`, which opens the OS browser via `shell:allow-open` (the
 * only shell capability granted, §294) or `window.open(...,'noopener')` in a
 * plain browser context.
 *
 * Non-http(s) schemes (`javascript:`, `data:`, `vbscript:`, …) are stripped:
 * react-markdown's default URL transform already neutralizes them, this is
 * defense-in-depth at the click boundary.
 */

import type { MouseEvent } from 'react';
import { openExternalUrl } from './bridge';

/** Absolute http(s) URL check — the only schemes allowed to leave the app. */
export function isSafeHttpUrl(raw: string | undefined | null): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw, window.location.href);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * §295 click router for anchors rendered from untrusted content.
 * - in-page anchors (`#…`) stay native;
 * - everything else is preventDefault()ed FIRST (the webview never navigates);
 * - http(s) goes through the bridge; other schemes die here silently.
 */
export function handleExternalLinkClick(
  event: MouseEvent<HTMLAnchorElement>,
): void {
  const href = event.currentTarget.getAttribute('href');
  if (!href) return;
  if (href.startsWith('#')) return;
  event.preventDefault();
  if (!isSafeHttpUrl(href)) return;
  void openExternalUrl(href);
}
