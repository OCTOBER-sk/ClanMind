/**
 * Design Tokens for ClanMind Frontend
 * Governed by §3, §4, §5, §6 of ClanMind_Frontend_Master_Implementation_Specification.md
 * Visual refinement layer per UIUX_REFINEMENT_DIRECTIVE.md §7–§15.
 */

export const tokens = {
  colors: {
    background: 'var(--color-background)',
    surface: 'var(--color-surface)',
    surfaceRaised: 'var(--color-surface-raised)',
    surfaceElevated: 'var(--color-surface-elevated)',
    surfaceHover: 'var(--color-surface-hover)',
    surfacePressed: 'var(--color-surface-pressed)',
    border: 'var(--color-border)',
    borderStrong: 'var(--color-border-strong)',
    text: 'var(--color-text)',
    textSecondary: 'var(--color-text-secondary)',
    textTertiary: 'var(--color-text-tertiary)',
    textDisabled: 'var(--color-text-disabled)',
    primary: 'var(--color-primary)',
    primaryForeground: 'var(--color-primary-foreground)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)',
    info: 'var(--color-info)',
    spectral: 'var(--spectral-gradient)',
  },
  spacing: {
    1: '0.25rem', // 4px
    2: '0.5rem', // 8px
    3: '0.75rem', // 12px
    4: '1rem', // 16px
    5: '1.25rem', // 20px
    6: '1.5rem', // 24px
    8: '2rem', // 32px
    10: '2.5rem', // 40px
    12: '3rem', // 48px
  },
  radii: {
    sm: '0.25rem', // 4px — inputs, small controls
    md: '0.5rem', // 8px — buttons, inputs, cards
    lg: '0.75rem', // 12px — cards, panels
    xl: '1rem', // 16px — large surfaces
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
    ring: 'var(--focus-ring)',
  },
} as const;

export type Tokens = typeof tokens;
