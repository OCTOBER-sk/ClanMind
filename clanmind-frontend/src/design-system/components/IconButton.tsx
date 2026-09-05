import React, { forwardRef } from 'react';
import { cn } from '../utils';
import { Loader2 } from 'lucide-react';

/**
 * IconButton — M3 primitive (PAKKA §11, primitive #2).
 *
 * Contract (preserved from the pre-M3 implementation; no breaking changes):
 *   - variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
 *   - size:    'xs' | 'sm' | 'md' | 'lg'
 *   - isLoading
 *   - all ButtonHTMLAttributes
 *   - forwardRef<HTMLButtonElement>
 *   - mandatory `aria-label` (the button has no visible text)
 *
 * M3 contract (PAKKA §BUTTON):
 *   - 48dp hit area on every size — FE §221's 24×24 floor is too small for a
 *     desktop control; the pre-M3 `xs` was 24dp which now falls under
 *     PAKKA §BUTTON (see D-19). The button is now min-w-[48px] min-h-[48px]
 *     on every size; the visual box is smaller but the click target is
 *     always 48dp.
 *   - M3 shape: xs/sm 4px / md 8px / lg 12px (no --radius-xs per the new
 *     radius scale; --radius-sm is the tightest in src/index.css @theme).
 *   - M3 state layers via .cm-state-hover / .cm-state-pressed /
 *     .cm-state-focus / .cm-state-disabled (PAKKA §TASK 0.16 — centralized
 *     helper; see index.css). The variant just sets text color; the
 *     overlay paints via currentColor so a single class works for every
 *     variant.
 *   - Focus ring uses --focus-ring; the resting radius is preserved
 *     (never snap the ring to a tighter radius).
 *   - Reduced-motion safe: no `transition-all`; explicit
 *     transition-[background-color,box-shadow,opacity,transform] with the
 *     --duration-small / --ease-standard tokens. The Loader2 spin is left
 *     to Tailwind's animate-spin; the global reduced-motion kill-switch
 *     (index.css lines 511-519) zeros animation-duration, so we ALSO
 *     apply motion-reduce:animate-none on the spinner itself for
 *     defense-in-depth.
 *   - Default type="button" so the button does not accidentally submit a
 *     surrounding form.
 *   - Decorative children wrapped in aria-hidden span so the only
 *     accessible name is the mandatory `aria-label`.
 */
export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string; // Mandatory for accessibility (§64, §7)
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

// M3 shape tokens — mapped to the existing --radius scale (sm/md/lg per
// src/index.css). PAKKA §TASK 0.14 will rename the scale; until that lands
// we use the existing token names so no raw values appear in this file.
const sizeClasses: Record<NonNullable<IconButtonProps['size']>, string> = {
  // 48dp hit area on EVERY size. The visual box is smaller (p-* controls
  // the icon padding) but min-w/min-h keeps the click target at 48dp.
  // PAKKA §BUTTON: this was the pre-M3 bug (xs was 24dp) — see D-19.
  xs: 'p-1.5 min-w-[48px] min-h-[48px] rounded-[var(--radius-sm)]',
  sm: 'p-2 min-w-[48px] min-h-[48px] rounded-[var(--radius-sm)]',
  md: 'p-2.5 min-w-[48px] min-h-[48px] rounded-[var(--radius-md)]',
  lg: 'p-3 min-w-[48px] min-h-[48px] rounded-[var(--radius-lg)]',
};

// M3 state-layer classes from index.css. Every interactive IconButton gets
// all four so hover / pressed / focus / disabled can be applied uniformly
// and the centralized helper (not per-component hand-rolled opacity) is
// the single source of truth (PAKKA §TASK 0.16).
const baseStateLayerClasses =
  'cm-state-hover cm-state-pressed cm-state-focus cm-state-disabled';

// M3 variant → class-string. Each variant sets the text color (the state
// layer overlay paints with currentColor at the tokenized opacity, so the
// background of every variant shifts correctly on hover/pressed/focus).
// Backgrounds are kept from the pre-M3 implementation where they made
// sense; ghost/secondary/danger use the same surfaces as the equivalent
// Button variants for consistency.
const variantClasses: Record<NonNullable<IconButtonProps['variant']>, string> = {
  primary:
    'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] border border-transparent',
  secondary:
    'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border border-transparent',
  outline:
    'bg-transparent text-[var(--color-text-secondary)] border border-[var(--color-border-strong)]',
  ghost:
    'bg-transparent text-[var(--color-text-tertiary)] border border-transparent',
  danger:
    'bg-transparent text-[var(--color-danger)] border border-transparent',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = 'ghost',
      size = 'md',
      isLoading = false,
      disabled,
      type = 'button',
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        aria-disabled={isDisabled || undefined}
        data-disabled={isDisabled || undefined}
        className={cn(
          // Base layout — preserve the pre-M3 contract (icon-only, square).
          'inline-flex items-center justify-center select-none relative shrink-0',
          // M3 motion: explicit transitions, not `transition-all` (so the
          // reduced-motion kill-switch only affects the dimensions we
          // actually animate). 150ms / standard easing per tokens.motion.small.
          'transition-[background-color,box-shadow,opacity,transform] duration-[var(--duration-small)] ease-[var(--ease-standard)]',
          // Focus ring: apply --focus-ring on :focus-visible, preserve the
          // resting radius (do NOT snap to --radius-md as the pre-M3 code
          // implicitly did via outline-none alone).
          'outline-none focus-visible:shadow-[var(--focus-ring)]',
          // Disabled: pointer-events off so click handlers do not fire
          // even via programmatic dispatch. 38% content opacity per
          // PAKKA §TASK 0.16.
          'disabled:pointer-events-none disabled:opacity-[0.38]',
          // Cursor: only the default when not disabled, since pointer-events
          // are off when disabled.
          'cursor-pointer',
          sizeClasses[size],
          baseStateLayerClasses,
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2
            className="w-4 h-4 shrink-0 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          // Decorative children wrapped in aria-hidden span so the only
          // accessible name is the mandatory `aria-label` prop.
          <span className="inline-flex shrink-0" aria-hidden="true">
            {children}
          </span>
        )}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
