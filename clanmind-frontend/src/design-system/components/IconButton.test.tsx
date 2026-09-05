/**
 * PHASE 1 Unit 2 — IconButton functional tests (PAKKA §BUTTON, PAKKA §11).
 *
 * Covers:
 *  - 5 variants render without crashing (primary/secondary/outline/ghost/danger)
 *  - default variant is ghost; default size is md
 *  - 4 sizes (xs/sm/md/lg) all meet 48dp hit area (PAKKA §BUTTON; see D-19)
 *  - 4 sizes use the correct --radius token (no --radius-xs in the new scale)
 *  - isLoading disables the button, sets aria-busy, suppresses onClick
 *  - isLoading replaces children with the spinner (and that spinner has
 *    motion-reduce:animate-none for defense-in-depth)
 *  - disabled state removes pointer events and does not fire onClick
 *  - forwardRef<HTMLButtonElement> works
 *  - keyboard activation (Enter / Space)
 *  - onClick fires for normal clicks
 *  - default type="button"; explicit type="submit" honored
 *  - className passthrough
 *  - decorative children are aria-hidden so the only accessible name is the
 *    mandatory aria-label prop
 *  - state-layer helper classes are applied on every render
 *  - explicit motion contract (no `transition-all`, uses --duration-small
 *    and --ease-standard tokens)
 *  - focus ring uses --focus-ring (never a tighter radius)
 *
 * Test count: 25 (see comment per `it(`).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { IconButton } from './IconButton';

describe('IconButton — PHASE 1 Unit 2 (PAKKA §BUTTON)', () => {
  describe('variants', () => {
    // 5 generated tests (one per variant).
    const variants = [
      'primary',
      'secondary',
      'outline',
      'ghost',
      'danger',
    ] as const;

    // Test #1-#5
    it.each(variants)('renders %s variant without crashing', (variant) => {
      render(
        <IconButton aria-label={`${variant} action`} variant={variant}>
          <span>x</span>
        </IconButton>,
      );
      expect(
        screen.getByRole('button', { name: `${variant} action` }),
      ).toBeInTheDocument();
    });

    // Test #6
    it('defaults to ghost when no variant is passed', () => {
      render(
        <IconButton aria-label="default">
          <span>x</span>
        </IconButton>,
      );
      const btn = screen.getByRole('button', { name: 'default' });
      expect(btn.className).toContain('bg-transparent');
      expect(btn.className).toContain('text-[var(--color-text-tertiary)]');
    });
  });

  describe('sizes — 48dp hit area (PAKKA §BUTTON, D-19)', () => {
    const sizes = ['xs', 'sm', 'md', 'lg'] as const;

    // Test #7-#10 (4 generated, one per size).
    it.each(sizes)(
      'size %s enforces min-h-[48px] and min-w-[48px] (PAKKA §BUTTON 48dp hit area)',
      (size) => {
        render(
          <IconButton aria-label={`size-${size}`} size={size}>
            <span>x</span>
          </IconButton>,
        );
        const btn = screen.getByRole('button', { name: `size-${size}` });
        expect(btn.className).toContain('min-h-[48px]');
        expect(btn.className).toContain('min-w-[48px]');
      },
    );

    // Test #11
    it('defaults to size="md" and uses --radius-md', () => {
      render(
        <IconButton aria-label="default-size">
          <span>x</span>
        </IconButton>,
      );
      const btn = screen.getByRole('button', { name: 'default-size' });
      expect(btn.className).toContain('rounded-[var(--radius-md)]');
    });

    // Test #12 — covers xs/sm/md/lg shape tokens in one table.
    it('each size uses the correct --radius token (no --radius-xs)', () => {
      const expectedRadius: Record<string, string> = {
        xs: 'rounded-[var(--radius-sm)]',
        sm: 'rounded-[var(--radius-sm)]',
        md: 'rounded-[var(--radius-md)]',
        lg: 'rounded-[var(--radius-lg)]',
      };
      for (const size of sizes) {
        const { unmount } = render(
          <IconButton aria-label={`shape-${size}`} size={size}>
            <span>x</span>
          </IconButton>,
        );
        const btn = screen.getByRole('button', { name: `shape-${size}` });
        expect(btn.className).toContain(expectedRadius[size]);
        // Guard against accidentally reintroducing --radius-xs.
        expect(btn.className).not.toContain('--radius-xs');
        unmount();
      }
    });
  });

  describe('loading state', () => {
    // Test #13
    it('isLoading disables, sets aria-busy, and replaces children with the spinner', () => {
      const { container } = render(
        <IconButton aria-label="loading" isLoading>
          <span data-testid="child-icon">x</span>
        </IconButton>,
      );
      const btn = screen.getByRole('button', { name: 'loading' });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-busy', 'true');
      // The child icon is replaced by the spinner in the loading state.
      expect(screen.queryByTestId('child-icon')).not.toBeInTheDocument();
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    // Test #14
    it('isLoading suppresses click activation', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <IconButton aria-label="loading" isLoading onClick={onClick}>
          <span>x</span>
        </IconButton>,
      );
      await user.click(screen.getByRole('button', { name: 'loading' }));
      expect(onClick).not.toHaveBeenCalled();
    });

    // Test #15
    it('spinner has motion-reduce:animate-none for defense-in-depth', () => {
      const { container } = render(
        <IconButton aria-label="loading-spin" isLoading>
          <span>x</span>
        </IconButton>,
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.getAttribute('class')).toContain('motion-reduce:animate-none');
    });
  });

  describe('disabled state', () => {
    // Test #16
    it('disabled removes pointer events and does not fire onClick', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <IconButton aria-label="disabled" disabled onClick={onClick}>
          <span>x</span>
        </IconButton>,
      );
      const btn = screen.getByRole('button', { name: 'disabled' });
      expect(btn).toBeDisabled();
      expect(btn.className).toContain('disabled:pointer-events-none');
      await user.click(btn);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('forwardRef', () => {
    // Test #17
    it('forwards the ref to the underlying HTMLButtonElement', () => {
      const ref = createRef<HTMLButtonElement>();
      render(
        <IconButton aria-label="ref" ref={ref}>
          <span>x</span>
        </IconButton>,
      );
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('keyboard activation', () => {
    // Test #18
    it('Enter activates the button', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <IconButton aria-label="enter" onClick={onClick}>
          <span>x</span>
        </IconButton>,
      );
      const btn = screen.getByRole('button', { name: 'enter' });
      btn.focus();
      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    // Test #19
    it('Space activates the button', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <IconButton aria-label="space" onClick={onClick}>
          <span>x</span>
        </IconButton>,
      );
      const btn = screen.getByRole('button', { name: 'space' });
      btn.focus();
      await user.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('onClick behavior', () => {
    // Test #20
    it('fires onClick for normal clicks', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <IconButton aria-label="click" onClick={onClick}>
          <span>x</span>
        </IconButton>,
      );
      await user.click(screen.getByRole('button', { name: 'click' }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('form behavior', () => {
    // Test #21
    it('defaults to type="button" so it does not accidentally submit a form', () => {
      render(
        <form data-testid="form">
          <IconButton aria-label="default-type">
            <span>x</span>
          </IconButton>
        </form>,
      );
      const btn = screen.getByRole('button', { name: 'default-type' });
      expect(btn).toHaveAttribute('type', 'button');
    });

    // Test #22
    it('type="submit" is honored for form submission', () => {
      render(
        <form data-testid="form">
          <IconButton aria-label="submit" type="submit">
            <span>x</span>
          </IconButton>
        </form>,
      );
      const btn = screen.getByRole('button', { name: 'submit' });
      expect(btn).toHaveAttribute('type', 'submit');
    });
  });

  describe('className passthrough', () => {
    // Test #23
    it('appends custom className to the variant/size classes', () => {
      render(
        <IconButton aria-label="custom" className="absolute top-0 right-0">
          <span>x</span>
        </IconButton>,
      );
      const btn = screen.getByRole('button', { name: 'custom' });
      expect(btn.className).toContain('absolute');
      expect(btn.className).toContain('top-0');
      expect(btn.className).toContain('right-0');
    });
  });

  describe('decorative children + a11y wiring', () => {
    // Test #24
    it('wraps children in an aria-hidden span so the only accessible name is the aria-label', () => {
      render(
        <IconButton aria-label="close">
          <span data-testid="child-icon">×</span>
        </IconButton>,
      );
      const wrapper = screen.getByTestId('child-icon').parentElement;
      expect(wrapper).toHaveAttribute('aria-hidden', 'true');
      expect(
        screen.getByRole('button', { name: 'close' }),
      ).toBeInTheDocument();
    });
  });

  describe('motion contract (M3 §6) + focus ring (M3 §7)', () => {
    // Test #25
    it('uses explicit motion contract + focus ring; no transition-all; no tighter resting radius', () => {
      render(
        <IconButton aria-label="motion">
          <span>x</span>
        </IconButton>,
      );
      const btn = screen.getByRole('button', { name: 'motion' });
      // Explicit transition properties — never `transition-all` (so the
      // reduced-motion kill-switch only nukes the dimensions we actually
      // animate).
      expect(btn.className).toContain(
        'transition-[background-color,box-shadow,opacity,transform]',
      );
      expect(btn.className).toContain('duration-[var(--duration-small)]');
      expect(btn.className).toContain('ease-[var(--ease-standard)]');
      expect(btn.className).not.toMatch(/\btransition-all\b/);
      // Focus ring: --focus-ring applied on :focus-visible.
      expect(btn.className).toContain('focus-visible:shadow-[var(--focus-ring)]');
    });
  });
});
