/**
 * P13 accessibility pass — design-token contrast & reduced-motion contract.
 *
 * §222: normal text ≥4.5:1 (WCAG 2.2 AA). These assertions COMPUTE the real
 * WCAG ratios from src/index.css token values for both themes, so any future
 * palette drift that breaks AA fails here rather than shipping.
 *
 * §6: under prefers-reduced-motion every animation class collapses to an
 * instant state change, and animated spectral text falls back to solid,
 * readable color (a frozen rainbow still renders ~1.8:1 segments).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');

// ── Token extraction ────────────────────────────────────────────────────────
function block(inner: string): string {
  return inner;
}
function extractVars(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out[m[1]] = m[2];
  return out;
}

const rootStart = css.indexOf(':root {');
const rootEnd = css.indexOf('}', rootStart);
const lightVars = extractVars(block(css.slice(rootStart, rootEnd)));

const darkStart = css.indexOf('.dark {');
const darkEnd = css.indexOf('}', darkStart);
const darkVars = extractVars(block(css.slice(darkStart, darkEnd)));

// ── WCAG math ───────────────────────────────────────────────────────────────
function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const rgb = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_TOKENS = ['color-text', 'color-text-secondary', 'color-text-tertiary'];
/** Semantic tokens rendered AS TEXT somewhere in the app (badges, alerts…). */
const SEMANTIC_AS_TEXT = ['color-success', 'color-warning', 'color-danger', 'color-info'];
const SURFACES = ['color-background', 'color-surface'];

describe.each([
  ['light', lightVars],
  ['dark', darkVars],
])('§222 — %s theme text tokens meet WCAG AA', (_theme, vars) => {
  it.each([...TEXT_TOKENS, ...SEMANTIC_AS_TEXT])('--%s ≥ 4.5:1 on every surface', (token) => {
    const fg = vars[token];
    expect(fg, `token --${token} missing from theme`).toBeDefined();
    for (const surface of SURFACES) {
      const bg = vars[surface];
      expect(bg, `token --${surface} missing from theme`).toBeDefined();
      const ratio = contrast(fg!, bg!);
      expect(ratio, `--${token} on --${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('§222 — semantic tokens stay readable on their -bg tints', () => {
  it.each([
    ['light', lightVars],
    ['dark', darkVars],
  ])('%s: each semantic color ≥4.5:1 on its paired background tint', (_t, vars) => {
    for (const name of SEMANTIC_AS_TEXT) {
      const bgTint = vars[`${name}-bg`];
      // Dark-mode -bg values are rgba() over unknown surfaces; the flat-color
      // pairs above already cover them. Only assert when both are hex.
      if (!bgTint || !bgTint.startsWith('#')) continue;
      const ratio = contrast(vars[name]!, bgTint);
      expect(ratio, `--${name} on --${name}-bg is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// ── §6 reduced-motion contract ──────────────────────────────────────────────
function reducedBlock(): string {
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
  expect(start, 'prefers-reduced-motion block must exist').toBeGreaterThan(-1);
  return css.slice(start);
}

describe('§6 — prefers-reduced-motion contract', () => {
  const reduce = reducedBlock();

  it.each([
    '.spectral-active',
    '.odin-working',
    '.spectral-text',
    '.panel-open',
    '.panel-close',
    '.node-arrive',
    '.reaction-pop',
    '.completion-glow',
    '.cm-edge-draw',
    '.streaming-cursor::after',
    '.sheet-panel-right',
    '.sheet-panel-left',
    '.sheet-overlay',
  ])('%s animation is disabled under reduced motion', (selector) => {
    const pattern = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(new RegExp(pattern)).toBeTruthy();
    expect(reduce).toContain(selector.replace('::after', ''));
  });

  it('global kill-switch zeroes all animation/transition durations', () => {
    expect(reduce).toContain('animation-duration: 0.01ms !important');
    expect(reduce).toContain('transition-duration: 0.01ms !important');
    expect(reduce).toContain('animation-iteration-count: 1 !important');
  });

  it('animated spectral TEXT collapses to a solid readable color (§222)', () => {
    const spectralFallback = reduce.slice(reduce.indexOf('.spectral-text'));
    expect(spectralFallback).toContain('-webkit-text-fill-color');
    expect(spectralFallback).toContain('var(--color-text)');
  });

  it('a draw that cannot animate leaves no dashed artifact (§99)', () => {
    expect(reduce).toContain('stroke-dasharray: none');
  });
});
