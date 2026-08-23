import { useEffect, useState } from 'react';

/**
 * useLayoutMode — FE §13 responsive desktop layout controller (R2).
 *
 *   ≥ 1440        three-pane      full left rail + center + docked right surface
 *   1200–1439     compressed      icon left rail + center + docked right surface
 *   900–1199      two-pane        rail + center; right surface becomes a sheet
 *   < 900         single          single main pane + sheets; nav goes off-canvas
 *
 * Driven by `matchMedia` so the mode reacts to window resizes without a
 * scroll/resize listener per frame. The composer stays bottom-anchored in
 * every mode (FE §13) because the center pane is always a flex column.
 */

export type LayoutMode = 'three-pane' | 'compressed' | 'two-pane' | 'single';

/** Breakpoint boundaries, mirrored by the test suite (1440/1200/900). */
export const LAYOUT_BREAKPOINTS = {
  wide: 1440,
  compressed: 1200,
  twoPane: 900,
} as const;

export interface LayoutInfo {
  mode: LayoutMode;
  /** Right work surface renders docked with a resizer (≥1200). */
  rightSurfaceDocked: boolean;
  /** Left rail is an inline pane (≥900); below that it lives in a sheet. */
  leftRailDocked: boolean;
  /** Compressed band renders the rail in its narrow icon-only form. */
  railCompressed: boolean;
}

function media(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(query).matches;
}

function computeMode(): LayoutMode {
  // Order matters: widest query wins.
  if (media(`(min-width: ${LAYOUT_BREAKPOINTS.wide}px)`)) return 'three-pane';
  if (media(`(min-width: ${LAYOUT_BREAKPOINTS.compressed}px)`)) return 'compressed';
  if (media(`(min-width: ${LAYOUT_BREAKPOINTS.twoPane}px)`)) return 'two-pane';
  return 'single';
}

function computeInfo(): LayoutInfo {
  const mode = computeMode();
  return {
    mode,
    rightSurfaceDocked: mode === 'three-pane' || mode === 'compressed',
    leftRailDocked: mode === 'three-pane' || mode === 'compressed' || mode === 'two-pane',
    railCompressed: mode === 'compressed',
  };
}

/**
 * Subscribe to the breakpoint set. Uses `change` events on each media query so
 * React re-renders only when the layout band actually changes.
 */
export function useLayoutMode(): LayoutInfo {
  const [info, setInfo] = useState<LayoutInfo>(computeInfo);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const queries = [
      `(min-width: ${LAYOUT_BREAKPOINTS.twoPane}px)`,
      `(min-width: ${LAYOUT_BREAKPOINTS.compressed}px)`,
      `(min-width: ${LAYOUT_BREAKPOINTS.wide}px)`,
    ].map((q) => window.matchMedia(q));

    const handleChange = () => setInfo(computeInfo());
    // Safari <14 support via addListener fallback is unnecessary for a Tauri
    // (WebKit current) + modern-Chrome target, but guard anyway.
    for (const mql of queries) {
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', handleChange);
      } else {
        mql.addListener(handleChange);
      }
    }
    // Re-evaluate once synchronously in case the first render happened before
    // hydration into a resized window (jsdom/tests).
    handleChange();

    return () => {
      for (const mql of queries) {
        if (typeof mql.removeEventListener === 'function') {
          mql.removeEventListener('change', handleChange);
        } else {
          mql.removeListener(handleChange);
        }
      }
    };
  }, []);

  return info;
}
