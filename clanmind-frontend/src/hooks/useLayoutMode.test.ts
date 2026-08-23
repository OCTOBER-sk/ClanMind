/**
 * useLayoutMode — FE §13 responsive band controller.
 * Verifies every breakpoint boundary (1440/1200/900) and live resize
 * transitions driven through matchMedia change events.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { LAYOUT_BREAKPOINTS, useLayoutMode } from './useLayoutMode';

type Listener = () => void;

let currentWidth = 1280;
const changeListeners = new Set<Listener>();

/** Install a matchMedia stub that answers against a simulated viewport width. */
function stubViewport(width: number): void {
  currentWidth = width;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => {
      const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0);
      return {
        matches: currentWidth >= min,
        media: query,
        onchange: null,
        addEventListener: (_type: string, cb: Listener) => changeListeners.add(cb),
        removeEventListener: (_type: string, cb: Listener) => changeListeners.delete(cb),
        addListener: (_cb: Listener) => {},
        removeListener: (_cb: Listener) => {},
        dispatchEvent: () => false,
      };
    },
  });
}

/** Simulate the window crossing into a new band while the hook is mounted. */
function resizeTo(width: number): void {
  act(() => {
    currentWidth = width;
    changeListeners.forEach((cb) => cb());
  });
}

describe('useLayoutMode (FE §13)', () => {
  beforeEach(() => {
    changeListeners.clear();
  });

  afterEach(() => {
    // Leave a neutral stub behind; other suites in this file re-stub anyway.
    stubViewport(1280);
  });

  it.each([
    [1920, 'three-pane'],
    [LAYOUT_BREAKPOINTS.wide, 'three-pane'],
    [LAYOUT_BREAKPOINTS.wide - 1, 'compressed'],
    [1300, 'compressed'],
    [LAYOUT_BREAKPOINTS.compressed, 'compressed'],
    [LAYOUT_BREAKPOINTS.compressed - 1, 'two-pane'],
    [1000, 'two-pane'],
    [LAYOUT_BREAKPOINTS.twoPane, 'two-pane'],
    [LAYOUT_BREAKPOINTS.twoPane - 1, 'single'],
    [640, 'single'],
  ] as const)('width %ipx → %s', (width, expected) => {
    stubViewport(width);
    const { result } = renderHook(() => useLayoutMode());
    expect(result.current.mode).toBe(expected);
  });

  it('exposes pane docking flags consistent with the spec bands', () => {
    stubViewport(1600);
    const { result } = renderHook(() => useLayoutMode());
    expect(result.current.rightSurfaceDocked).toBe(true);
    expect(result.current.leftRailDocked).toBe(true);
    expect(result.current.railCompressed).toBe(false);

    resizeTo(1300); // compressed band: icon rail, right surface still docked
    expect(result.current.railCompressed).toBe(true);
    expect(result.current.rightSurfaceDocked).toBe(true);

    resizeTo(1000); // two-pane: rail inline, work surface leaves the dock
    expect(result.current.mode).toBe('two-pane');
    expect(result.current.leftRailDocked).toBe(true);
    expect(result.current.rightSurfaceDocked).toBe(false);

    resizeTo(800); // single: everything becomes sheets/off-canvas
    expect(result.current.mode).toBe('single');
    expect(result.current.leftRailDocked).toBe(false);
    expect(result.current.rightSurfaceDocked).toBe(false);
    expect(result.current.railCompressed).toBe(false);
  });

  it('unsubscribes from matchMedia on unmount', () => {
    stubViewport(1024);
    const { unmount } = renderHook(() => useLayoutMode());
    expect(changeListeners.size).toBeGreaterThan(0);
    unmount();
    expect(changeListeners.size).toBe(0);
  });
});
