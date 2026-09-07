/**
 * Design Tokens — M3 runtime bridge (Phase 0-B)
 * Spec §11 rule 2: JS constants READ CSS vars at runtime via getComputedStyle
 * so recharts/@xyflow/canvas/inline styles theme correctly in both light/dark.
 * Source of truth is src/index.css --md-* vars (light in :root, dark in .dark).
 * This module keeps the legacy `tokens` export names working via compat getters.
 */

// ── Runtime CSS var resolver ────────────────────────────────────────────────
function readCssVar(name: string): string {
  if (typeof document === 'undefined' || typeof window === 'undefined') return '';
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v;
  } catch {
    return '';
  }
}

/** Returned when DOM is unavailable (SSR/tests) — use the var() reference so CSS still works. */
function resolveOrVar(cssVar: string, fallback: string): string {
  const v = readCssVar(cssVar);
  return v || fallback;
}

// ── M3 role → CSS var map (matches src/index.css) ──────────────────────────
const M3_VAR: Record<string, string> = {
  // core
  primary: '--md-primary',
  onPrimary: '--md-on-primary',
  primaryContainer: '--md-primary-container',
  onPrimaryContainer: '--md-on-primary-container',
  secondary: '--md-secondary',
  onSecondary: '--md-on-secondary',
  secondaryContainer: '--md-secondary-container',
  onSecondaryContainer: '--md-on-secondary-container',
  tertiary: '--md-tertiary',
  onTertiary: '--md-on-tertiary',
  tertiaryContainer: '--md-tertiary-container',
  onTertiaryContainer: '--md-on-tertiary-container',
  error: '--md-error',
  onError: '--md-on-error',
  errorContainer: '--md-error-container',
  onErrorContainer: '--md-on-error-container',
  background: '--md-background',
  onBackground: '--md-on-background',
  surface: '--md-surface',
  onSurface: '--md-on-surface',
  surfaceVariant: '--md-surface-variant',
  onSurfaceVariant: '--md-on-surface-variant',
  outline: '--md-outline',
  outlineVariant: '--md-outline-variant',
  inverseSurface: '--md-inverse-surface',
  inverseOnSurface: '--md-inverse-on-surface',
  inversePrimary: '--md-inverse-primary',
  scrim: '--md-scrim',
  shadow: '--md-shadow',
  // surface-container tiers
  surfaceDim: '--md-surface-dim',
  surfaceBright: '--md-surface-bright',
  surfaceContainerLowest: '--md-surface-container-lowest',
  surfaceContainerLow: '--md-surface-container-low',
  surfaceContainer: '--md-surface-container',
  surfaceContainerHigh: '--md-surface-container-high',
  surfaceContainerHighest: '--md-surface-container-highest',
  // extensions
  success: '--md-success',
  onSuccess: '--md-on-success',
  successContainer: '--md-success-container',
  onSuccessContainer: '--md-on-success-container',
  warning: '--md-warning',
  onWarning: '--md-on-warning',
  warningContainer: '--md-warning-container',
  onWarningContainer: '--md-on-warning-container',
  info: '--md-info',
  onInfo: '--md-on-info',
  infoContainer: '--md-info-container',
  onInfoContainer: '--md-on-info-container',
  focusRing: '--md-focus-ring',
  spectralGradient: '--md-spectral-gradient',
};

/** Full M3 palette — each getter resolves the live CSS var per current theme. */
export const m3 = {
  get primary() { return resolveOrVar(M3_VAR.primary!, 'var(--md-primary)'); },
  get onPrimary() { return resolveOrVar(M3_VAR.onPrimary!, 'var(--md-on-primary)'); },
  get primaryContainer() { return resolveOrVar(M3_VAR.primaryContainer!, 'var(--md-primary-container)'); },
  get onPrimaryContainer() { return resolveOrVar(M3_VAR.onPrimaryContainer!, 'var(--md-on-primary-container)'); },
  get secondary() { return resolveOrVar(M3_VAR.secondary!, 'var(--md-secondary)'); },
  get onSecondary() { return resolveOrVar(M3_VAR.onSecondary!, 'var(--md-on-secondary)'); },
  get secondaryContainer() { return resolveOrVar(M3_VAR.secondaryContainer!, 'var(--md-secondary-container)'); },
  get onSecondaryContainer() { return resolveOrVar(M3_VAR.onSecondaryContainer!, 'var(--md-on-secondary-container)'); },
  get tertiary() { return resolveOrVar(M3_VAR.tertiary!, 'var(--md-tertiary)'); },
  get onTertiary() { return resolveOrVar(M3_VAR.onTertiary!, 'var(--md-on-tertiary)'); },
  get tertiaryContainer() { return resolveOrVar(M3_VAR.tertiaryContainer!, 'var(--md-tertiary-container)'); },
  get onTertiaryContainer() { return resolveOrVar(M3_VAR.onTertiaryContainer!, 'var(--md-on-tertiary-container)'); },
  get error() { return resolveOrVar(M3_VAR.error!, 'var(--md-error)'); },
  get onError() { return resolveOrVar(M3_VAR.onError!, 'var(--md-on-error)'); },
  get errorContainer() { return resolveOrVar(M3_VAR.errorContainer!, 'var(--md-error-container)'); },
  get onErrorContainer() { return resolveOrVar(M3_VAR.onErrorContainer!, 'var(--md-on-error-container)'); },
  get background() { return resolveOrVar(M3_VAR.background!, 'var(--md-background)'); },
  get onBackground() { return resolveOrVar(M3_VAR.onBackground!, 'var(--md-on-background)'); },
  get surface() { return resolveOrVar(M3_VAR.surface!, 'var(--md-surface)'); },
  get onSurface() { return resolveOrVar(M3_VAR.onSurface!, 'var(--md-on-surface)'); },
  get surfaceVariant() { return resolveOrVar(M3_VAR.surfaceVariant!, 'var(--md-surface-variant)'); },
  get onSurfaceVariant() { return resolveOrVar(M3_VAR.onSurfaceVariant!, 'var(--md-on-surface-variant)'); },
  get outline() { return resolveOrVar(M3_VAR.outline!, 'var(--md-outline)'); },
  get outlineVariant() { return resolveOrVar(M3_VAR.outlineVariant!, 'var(--md-outline-variant)'); },
  get inverseSurface() { return resolveOrVar(M3_VAR.inverseSurface!, 'var(--md-inverse-surface)'); },
  get inverseOnSurface() { return resolveOrVar(M3_VAR.inverseOnSurface!, 'var(--md-inverse-on-surface)'); },
  get inversePrimary() { return resolveOrVar(M3_VAR.inversePrimary!, 'var(--md-inverse-primary)'); },
  get scrim() { return resolveOrVar(M3_VAR.scrim!, 'var(--md-scrim)'); },
  get shadow() { return resolveOrVar(M3_VAR.shadow!, 'var(--md-shadow)'); },
  get surfaceDim() { return resolveOrVar(M3_VAR.surfaceDim!, 'var(--md-surface-dim)'); },
  get surfaceBright() { return resolveOrVar(M3_VAR.surfaceBright!, 'var(--md-surface-bright)'); },
  get surfaceContainerLowest() { return resolveOrVar(M3_VAR.surfaceContainerLowest!, 'var(--md-surface-container-lowest)'); },
  get surfaceContainerLow() { return resolveOrVar(M3_VAR.surfaceContainerLow!, 'var(--md-surface-container-low)'); },
  get surfaceContainer() { return resolveOrVar(M3_VAR.surfaceContainer!, 'var(--md-surface-container)'); },
  get surfaceContainerHigh() { return resolveOrVar(M3_VAR.surfaceContainerHigh!, 'var(--md-surface-container-high)'); },
  get surfaceContainerHighest() { return resolveOrVar(M3_VAR.surfaceContainerHighest!, 'var(--md-surface-container-highest)'); },
  get success() { return resolveOrVar(M3_VAR.success!, 'var(--md-success)'); },
  get onSuccess() { return resolveOrVar(M3_VAR.onSuccess!, 'var(--md-on-success)'); },
  get successContainer() { return resolveOrVar(M3_VAR.successContainer!, 'var(--md-success-container)'); },
  get onSuccessContainer() { return resolveOrVar(M3_VAR.onSuccessContainer!, 'var(--md-on-success-container)'); },
  get warning() { return resolveOrVar(M3_VAR.warning!, 'var(--md-warning)'); },
  get onWarning() { return resolveOrVar(M3_VAR.onWarning!, 'var(--md-on-warning)'); },
  get warningContainer() { return resolveOrVar(M3_VAR.warningContainer!, 'var(--md-warning-container)'); },
  get onWarningContainer() { return resolveOrVar(M3_VAR.onWarningContainer!, 'var(--md-on-warning-container)'); },
  get info() { return resolveOrVar(M3_VAR.info!, 'var(--md-info)'); },
  get onInfo() { return resolveOrVar(M3_VAR.onInfo!, 'var(--md-on-info)'); },
  get infoContainer() { return resolveOrVar(M3_VAR.infoContainer!, 'var(--md-info-container)'); },
  get onInfoContainer() { return resolveOrVar(M3_VAR.onInfoContainer!, 'var(--md-on-info-container)'); },
  get focusRing() { return resolveOrVar(M3_VAR.focusRing!, 'var(--md-focus-ring)'); },
  get spectralGradient() { return resolveOrVar(M3_VAR.spectralGradient!, 'var(--md-spectral-gradient)'); },
} as const;

/** Read any M3 CSS var by its --md-* name (with or without leading --). */
export function getM3Var(name: string): string {
  const key = name.startsWith('--') ? name : `--${name}`;
  return resolveOrVar(key, `var(${key})`);
}

/** Convenience for chart/canvas callers: resolve a role to its live color. */
export function getM3Color(role: keyof typeof M3_VAR): string {
  const v = M3_VAR[role];
  return v ? resolveOrVar(v, `var(${v})`) : '';
}

/** Subscribe to theme changes (html class or system preference) — caller gets live values on change. */
export function subscribeM3Theme(cb: () => void): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};
  const root = document.documentElement;
  const obs = new MutationObserver(cb);
  obs.observe(root, { attributes: true, attributeFilter: ['class'] });
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onMedia = () => cb();
  // Only fire for system mode; observer already handles explicit toggles
  media.addEventListener('change', onMedia);
  return () => {
    obs.disconnect();
    media.removeEventListener('change', onMedia);
  };
}

// ── Legacy compat: existing `tokens` export names ───────────────────────────
// Components historically did `import { tokens } from '@/design-system/tokens'`
// and used tokens.colors.* (color CSS vars). Keep those working
// via getters that now resolve to the M3-driven values. Also re-export old
// spacing/radii/motion so no consumer needs editing.

export const tokens = {
  colors: {
    // M3 core (via --md-*), exposed under legacy names
    get background() { return resolveOrVar('--md-background', 'var(--color-background)'); },
    get surface() { return resolveOrVar('--md-surface', 'var(--color-surface)'); },
    // Compat aliases that previously were separate tokens — map to M3 container tiers
    get surfaceRaised() { return resolveOrVar('--md-surface-container', 'var(--color-surface-raised)'); },
    get surfaceElevated() { return resolveOrVar('--md-surface-container-high', 'var(--color-surface-elevated)'); },
    get surfaceHover() { return resolveOrVar('--md-surface-container-high', 'var(--color-surface-hover)'); },
    get surfacePressed() { return resolveOrVar('--md-surface-container-highest', 'var(--color-surface-pressed)'); },
    get border() { return resolveOrVar('--md-outline-variant', 'var(--color-border)'); },
    get borderStrong() { return resolveOrVar('--md-outline', 'var(--color-border-strong)'); },
    get text() { return resolveOrVar('--md-on-surface', 'var(--color-text)'); },
    get textSecondary() { return resolveOrVar('--md-on-surface-variant', 'var(--color-text-secondary)'); },
    // Tertiary compat: dark maps to outline (#8E909B = 6.6:1 on black) which keeps
    // the legacy a11y baseline green. Light maps to on-surface-variant.
    // Reading via getComputedStyle respects .dark toggling.
    get textTertiary() { return tertiaryCompat(); },
    get textDisabled() { return resolveOrVar('--md-outline-variant', 'var(--color-text-disabled)'); },
    get primary() { return resolveOrVar('--md-primary', 'var(--color-primary)'); },
    get primaryForeground() { return resolveOrVar('--md-on-primary', 'var(--color-primary-foreground)'); },
    get success() { return resolveOrVar('--md-success', 'var(--color-success)'); },
    get warning() { return resolveOrVar('--md-warning', 'var(--color-warning)'); },
    get danger() { return resolveOrVar('--md-error', 'var(--color-danger)'); },
    get info() { return resolveOrVar('--md-info', 'var(--color-info)'); },
    get spectral() { return resolveOrVar('--md-spectral-gradient', 'var(--spectral-gradient)'); },
    // Extra M3 direct aliases for canvas callers that used legacy tokens.colors
    get onPrimary() { return resolveOrVar('--md-on-primary', 'var(--md-on-primary)'); },
    get onSurface() { return resolveOrVar('--md-on-surface', 'var(--md-on-surface)'); },
    get error() { return resolveOrVar('--md-error', 'var(--md-error)'); },
    get onError() { return resolveOrVar('--md-on-error', 'var(--md-on-error)'); },
  },
  spacing: {
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    7: '1.75rem',
    8: '2rem',
    9: '2.25rem',
    10: '2.5rem',
    11: '2.75rem',
    12: '3rem',
  },
  radii: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
    md: '0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
    lg: '0 4px 8px -2px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
    xl: '0 8px 16px -4px rgba(0, 0, 0, 0.1), 0 4px 8px -2px rgba(0, 0, 0, 0.04)',
  },
  motion: {
    micro: '100ms cubic-bezier(0.4, 0, 0.2, 1)',
    small: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    standard: '220ms cubic-bezier(0.4, 0, 0.2, 1)',
    large: '350ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  fonts: {
    xs: '0.75rem',
    sm: '0.8125rem',
    base: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    display: '1.75rem',
    ui: 'var(--font-ui)',
    code: 'var(--font-code)',
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.625,
  },
  iconSize: {
    xs: 16,
    sm: 18,
    md: 20,
    lg: 24,
  },
  focus: {
    get ring() { return resolveOrVar('--md-focus-ring', 'var(--focus-ring)'); },
  },
  typography: {
    display: {
      fontSize: '1.75rem',
      lineHeight: '1.2',
      letterSpacing: '-0.025em',
      fontWeight: 700,
      fontFamily: 'var(--font-ui)',
    },
    pageTitle: {
      fontSize: '1.25rem',
      lineHeight: '1.3',
      letterSpacing: '-0.015em',
      fontWeight: 600,
      fontFamily: 'var(--font-ui)',
    },
    sectionTitle: {
      fontSize: '1.125rem',
      lineHeight: '1.35',
      letterSpacing: '-0.01em',
      fontWeight: 600,
      fontFamily: 'var(--font-ui)',
    },
    subsectionTitle: {
      fontSize: '1rem',
      lineHeight: '1.4',
      letterSpacing: '-0.005em',
      fontWeight: 600,
      fontFamily: 'var(--font-ui)',
    },
    body: {
      fontSize: '0.875rem',
      lineHeight: '1.5',
      letterSpacing: '0',
      fontWeight: 400,
      fontFamily: 'var(--font-ui)',
    },
    bodyStrong: {
      fontSize: '0.875rem',
      lineHeight: '1.5',
      letterSpacing: '0',
      fontWeight: 600,
      fontFamily: 'var(--font-ui)',
    },
    metadata: {
      fontSize: '0.75rem',
      lineHeight: '1.5',
      letterSpacing: '0.01em',
      fontWeight: 400,
      fontFamily: 'var(--font-ui)',
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: '1.5',
      letterSpacing: '0.01em',
      fontWeight: 400,
      fontFamily: 'var(--font-ui)',
    },
    label: {
      fontSize: '0.8125rem',
      lineHeight: '1.4',
      letterSpacing: '0.005em',
      fontWeight: 500,
      fontFamily: 'var(--font-ui)',
    },
    button: {
      fontSize: '0.8125rem',
      lineHeight: '1.4',
      letterSpacing: '0.005em',
      fontWeight: 500,
      fontFamily: 'var(--font-ui)',
    },
    code: {
      fontSize: '0.8125rem',
      lineHeight: '1.5',
      letterSpacing: '0',
      fontWeight: 400,
      fontFamily: 'var(--font-code)',
    },
  },
} as const;

function tertiaryCompat(): string {
  // In live DOM, getComputedStyle on --color-text-tertiary already resolves
  // via the alias chain (color-text-tertiary to md vars). That value
  // is AA-correct per theme (light 9.4:1, dark 6.6:1). Prefer it when available.
  const direct = readCssVar('--color-text-tertiary');
  if (direct) return direct;
  // Fallback when DOM unavailable: pick the AA-safe per-theme mapping manually
  // by checking html.dark — without DOM, assume light.
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return readCssVar('--md-outline') || 'var(--color-text-tertiary)';
  }
  return readCssVar('--md-on-surface-variant') || 'var(--color-text-tertiary)';
}

export type Tokens = typeof tokens;
export type M3Tokens = typeof m3;

// Legacy re-export alias for callers doing `import { tokens } from '@/design-system/tokens'`
export default tokens;
