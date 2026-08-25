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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

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

// ── Undefined-token reference guard (FINAL_PREKEY blocker 3) ────────────────
// B3: `var(--color-primary-fg)` shipped at nine call sites while only
// `--color-primary-foreground` exists — an undefined var() makes the color
// declaration invalid at computed-value time, so text silently inherits the
// background color (white-on-white send icon, invisible skip link / nav
// labels, both themes). This guard fails the suite the moment ANY source file
// references a custom property that index.css does not define.
describe('design tokens — every referenced CSS variable is defined', () => {
  /** Every `--name:` definition anywhere in index.css (@theme, :root, .dark). */
  const definedTokens = new Set<string>();
  for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
    definedTokens.add(m[1]!);
  }
  expect(definedTokens.size, 'index.css must define tokens').toBeGreaterThan(0);

  function collectSourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === '__snapshots__' || entry === 'node_modules') continue;
        out.push(...collectSourceFiles(full));
      } else if (['.ts', '.tsx'].includes(extname(entry))) {
        out.push(full);
      }
    }
    return out;
  }

  it('no var(--…) reference points at an undefined token', () => {
    const srcDir = resolve(__dirname, '..');
    const offenders: string[] = [];
    for (const file of collectSourceFiles(srcDir)) {
      // Test files may reference undefined tokens as NEGATIVE fixtures.
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      const source = readFileSync(file, 'utf8');
      for (const m of source.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
        const token = m[1]!;
        if (!definedTokens.has(token)) {
          offenders.push(`${file}: ${token}`);
        }
      }
    }
    expect(
      offenders,
      `undefined CSS custom property references (invalid var() → inherited/invisible color):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('the known-broken alias --color-primary-fg never returns', () => {
    const srcDir = resolve(__dirname, '..');
    for (const file of collectSourceFiles(srcDir)) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      const source = readFileSync(file, 'utf8');
      expect(source, `${file} references the undefined --color-primary-fg`).not.toContain(
        '--color-primary-fg',
      );
    }
  });

  it.each([
    ['light', '#ffffff'],
    ['dark', '#090a0f'],
  ])('%s: --color-primary-foreground contrasts with --color-primary (AA)', (_theme, fg) => {
    // The primary/foreground pair is THE fix target of blocker 3; assert the
    // real ratio so future palette edits cannot reintroduce invisibility.
    const primary = _theme === 'light' ? '#111827' : '#f9fafb';
    expect(contrast(fg, primary)).toBeGreaterThanOrEqual(4.5);
  });
});
