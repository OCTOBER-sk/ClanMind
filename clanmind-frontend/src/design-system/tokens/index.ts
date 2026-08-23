/**
 * Design Tokens for ClanMind Frontend
 * Governed by §3, §4, §5, §6 of ClanMind_Frontend_Master_Implementation_Specification.md
 */

export const tokens = {
  colors: {
    background: 'var(--color-background)',
    surface: 'var(--color-surface)',
    surfaceRaised: 'var(--color-surface-raised)',
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
    2: '0.5rem',  // 8px
    3: '0.75rem', // 12px
    4: '1rem',    // 16px
    5: '1.25rem', // 20px
    6: '1.5rem',  // 24px
    8: '2rem',    // 32px
    10: '2.5rem', // 40px
    12: '3rem',   // 48px
  },
  radii: {
    sm: '0.25rem', // 4px
    md: '0.5rem',  // 8px
    lg: '0.75rem', // 12px
    xl: '1rem',    // 16px
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
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
    ui: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    code: '"JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace',
  },
  focus: {
    ring: 'var(--focus-ring)',
  },
} as const;

export type Tokens = typeof tokens;
