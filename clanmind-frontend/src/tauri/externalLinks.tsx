/**
 * Safe markdown anchor — FE §295. The `components.a` override shared by every
 * markdown surface (chat bubbles §23/§134, document artifacts §89).
 * External http(s) links get rel="noreferrer noopener" + the §295 bridge
 * router; unsafe schemes render a href-less anchor so nothing is clickable
 * into the webview navigator.
 *
 * Component-only module (fast-refresh); the policy lives in
 * `externalLinkPolicy.ts`.
 */

import type { AnchorHTMLAttributes } from 'react';
import { handleExternalLinkClick, isSafeHttpUrl } from './externalLinkPolicy';

export type SafeMarkdownLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /** react-markdown injects the mdast node; never spread onto the DOM. */
  node?: unknown;
};

export function SafeMarkdownLink({
  node: _node,
  href,
  children,
  ...rest
}: SafeMarkdownLinkProps) {
  const external = isSafeHttpUrl(href);
  const inPage = typeof href === 'string' && href.startsWith('#');
  const resolvedHref = external || inPage ? href : undefined;
  return (
    <a
      {...rest}
      href={resolvedHref}
      target={external ? '_blank' : rest.target}
      rel={external ? 'noreferrer noopener' : rest.rel}
      onClick={handleExternalLinkClick}
    >
      {children}
    </a>
  );
}
