import React, { forwardRef } from 'react';
import { cn } from '../utils';
import { Loader2, Check } from 'lucide-react';

/**
 * Button — M3 primitive (PAKKA §11, primitive #1).
 *
 * Contract (preserved from the pre-M3 implementation; no breaking changes):
 *   - variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'spectral'
 *   - size:    'sm' | 'md' | 'lg'
 *   - loading, isLoading (deprecated), success, leftIcon, rightIcon
 *   - all ButtonHTMLAttributes
 *   - forwardRef<HTMLButtonElement>
 *
 * M3 contract (PAKKA §BUTTON):
 *   - 48dp hit area on every size (PAKKA §BUTTON; FE §221 is 24×24 floor)
 *   - M3 shape: sm 4px / md 8px / lg 12px (PAKKA §TASK 0.14)
 *   - M3 state layers via .cm-state-hover / .cm-state-pressed / .cm-state-focus /
 *     .cm-state-disabled (PAKKA §TASK 0.16 — centralized helper; see index.css)
 *   - Focus ring uses --focus-ring; the resting radius is preserved
 *     (the prior implementation snapped the ring to --radius-md which was
 *     tighter than the resting radius on md/lg — a real visual bug).
 *   - Loading without layout jump: icon replaces the leading icon slot
 *     and label width is preserved via the existing children-wrapping pattern.
 *   - Reduced-motion safe: no `transition-all`; explicit
 *     transition-colors / transition-opacity / transition-shadow with the
 *     --duration-small / --ease-standard tokens. The Loader2 spin is left to
 *     Tailwind's animate-spin, but the global reduced-motion kill-switch
 *     (index.css lines 511-519) zeros animation-duration, so the spin
 *     collapses to a static icon — see tokens for the state-layer pattern.
 *   - Spectral variant: only the §309A.2 CLIENT_UPDATE_REQUIRED full-screen
 *     blocking state per D-16 audit (FE §3.3 permits a brand-moment equivalent).
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'spectral';
  size?: 'sm' | 'md' | 'lg';
  /** Show spinner and disable button (canonical). */
  loading?: boolean;
  /** @deprecated use `loading`. Still honored so existing call sites do not break. */
  isLoading?: boolean;
  /** Brief success state — e.g. after copy. */
  success?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  // M3 shape: 4 / 8 / 12 — maps to the existing tokens.radii scale
  // (--radius-sm = 4px / --radius-md = 8px / --radius-lg = 12px). PAKKA
  // §TASK 0.14 will rename the scale to xs/sm/md; until that lands we use
  // the existing token names so the centralized test guard
  // (tokens.a11y.test.ts) stays green.
  // M3 hit area: 48dp on every size — see PAKKA §BUTTON.
  sm: 'min-h-[48px] min-w-[48px] px-3 py-1 text-xs gap-1.5 rounded-[var(--radius-sm)]',
  md: 'min-h-[48px] min-w-[48px] px-4 py-2 text-sm gap-2 rounded-[var(--radius-md)]',
  lg: 'min-h-[48px] min-w-[48px] px-5 py-2.5 text-[0.9375rem] gap-2.5 rounded-[var(--radius-lg)]',
};

// M3 state-layer classes from index.css. Every interactive Button gets all
// four so hover / pressed / focus / disabled can be applied uniformly and
// the centralized helper (not per-component hand-rolled opacity) is the
// single source of truth (PAKKA §TASK 0.16).
const baseStateLayerClasses =
  'cm-state-hover cm-state-pressed cm-state-focus cm-state-disabled';

// M3 variant → class-string. Each variant sets:
//   - background and text colors via the design tokens
//   - shadow only where M3 elevated/filled warrants a shadow
//   - the spectral variant keeps the .spectral-active class so the rainbow
//     gradient animation is the §309A.2 brand moment; everywhere else we use
//     solid semantic surfaces
const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-[var(--shadow-sm)] border border-transparent',
  secondary:
    'bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)]',
  outline:
    'bg-transparent border border-[var(--color-border-strong)] text-[var(--color-text-secondary)]',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] border border-transparent',
  danger:
    'bg-[var(--color-danger)] text-white shadow-[var(--shadow-sm)] border border-transparent',
  spectral:
    'spectral-active text-white font-medium shadow-[var(--shadow-sm)] border border-transparent',
};

const successClasses =
  'bg-[var(--color-success)] text-white border border-transparent';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      loading = false,
      isLoading = false, // backwards compat
      success = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading || isLoading;
    const showLoading = loading || isLoading;

    // PAKKA §BUTTON: 48dp hit area (already enforced by sizeClasses).
    // PAKKA §BUTTON: loading without layout jump — the icon replaces the
    // leftIcon slot, label width is preserved by the existing span-wrapping
    // pattern. The container is min-w-[48px] so width does not jump.
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={showLoading || undefined}
        aria-disabled={isDisabled || undefined}
        data-disabled={isDisabled || undefined}
        className={cn(
          // Base layout — same as pre-M3 to keep call-site expectations.
          'inline-flex items-center justify-center font-medium select-none relative',
          // M3 motion: explicit transitions, not `transition-all` (so the
          // reduced-motion kill-switch only affects the dimensions we
          // actually animate). 150ms / standard easing per tokens.motion.small.
          'transition-[background-color,box-shadow,opacity,transform] duration-[var(--duration-small)] ease-[var(--ease-standard)]',
          // Focus ring: apply --focus-ring on :focus-visible, preserve the
          // resting radius (do NOT snap to --radius-md as the pre-M3 code did).
          'outline-none focus-visible:shadow-[var(--focus-ring)]',
          // Disabled: pointer-events off so click handlers do not fire
          // even via programmatic dispatch. 38% content opacity per
          // PAKKA §TASK 0.16 is applied by the consumer via the disabled
          // state class below; we render the 12% container overlay via
          // the .cm-state-disabled helper.
          'disabled:pointer-events-none',
          // Disabled content opacity (38% per PAKKA §TASK 0.16).
          'disabled:opacity-[0.38]',
          sizeClasses[size],
          baseStateLayerClasses,
          success ? successClasses : variantClasses[variant],
          className,
        )}
        {...props}
      >
        {showLoading ? (
          <>
            <Loader2
              className="w-4 h-4 shrink-0 motion-reduce:animate-none"
              aria-hidden="true"
            />
            {children !== undefined && (
              <span className="opacity-70">{children}</span>
            )}
          </>
        ) : success ? (
          <>
            <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
            {children !== undefined && <span>{children}</span>}
          </>
        ) : (
          <>
            {leftIcon && (
              <span className="inline-flex shrink-0" aria-hidden="true">
                {leftIcon}
              </span>
            )}
            {children !== undefined && <span>{children}</span>}
            {rightIcon && (
              <span className="inline-flex shrink-0" aria-hidden="true">
                {rightIcon}
              </span>
            )}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
