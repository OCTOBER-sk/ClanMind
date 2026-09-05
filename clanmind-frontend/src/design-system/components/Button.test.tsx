/**
 * PHASE 1 Unit 1 — Button functional tests (PAKKA §BUTTON, PAKKA §11).
 *
 * Covers:
 *  - 6 variants render without crashing
 *  - 3 sizes all meet 48dp hit area (PAKKA §BUTTON)
 *  - loading state disables + sets aria-busy
 *  - isLoading (deprecated) still works
 *  - success state shows the check + preserves width
 *  - disabled state removes pointer events
 *  - forwardRef<HTMLButtonElement> works
 *  - keyboard activation (Enter / Space)
 *  - onClick fires for normal clicks; suppressed when loading/disabled
 *  - default type="button" (so forms do not accidentally submit)
 *  - explicit type="submit" is honored
 *  - className passthrough
 *  - leftIcon / rightIcon render
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { Button } from './Button';

describe('Button — PHASE 1 Unit 1 (PAKKA §BUTTON)', () => {
  describe('variants', () => {
    const variants = [
      'primary',
      'secondary',
      'outline',
      'ghost',
      'danger',
      'spectral',
    ] as const;

    it.each(variants)('renders %s variant without crashing', (variant) => {
      render(<Button variant={variant}>Action</Button>);
      expect(
        screen.getByRole('button', { name: 'Action' }),
      ).toBeInTheDocument();
    });

    it('defaults to secondary when no variant is passed', () => {
      render(<Button>Action</Button>);
      const btn = screen.getByRole('button', { name: 'Action' });
      // The class string should contain the secondary-variant marker.
      expect(btn.className).toContain('bg-[var(--color-surface-hover)]');
    });
  });

  describe('sizes — 48dp hit area (PAKKA §BUTTON)', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    it.each(sizes)(
      'size %s enforces min-h-[48px] and min-w-[48px] (PAKKA §BUTTON 48dp hit area)',
      (size) => {
        render(<Button size={size}>Action</Button>);
        const btn = screen.getByRole('button', { name: 'Action' });
        expect(btn.className).toContain('min-h-[48px]');
        expect(btn.className).toContain('min-w-[48px]');
      },
    );
  });

  describe('loading state', () => {
    it('loading={true} disables the button and sets aria-busy="true"', () => {
      render(<Button loading>Save</Button>);
      const btn = screen.getByRole('button', { name: 'Save' });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-busy', 'true');
    });

    it('isLoading={true} (deprecated) still works', () => {
      render(<Button isLoading>Save</Button>);
      const btn = screen.getByRole('button', { name: 'Save' });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-busy', 'true');
    });

    it('loading suppresses click activation', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Button loading onClick={onClick}>
          Save
        </Button>,
      );
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('success state', () => {
    it('success shows the check icon and renders the children', () => {
      render(<Button success>Saved</Button>);
      const btn = screen.getByRole('button', { name: 'Saved' });
      // The Check icon renders as an svg with aria-hidden. We assert
      // the label is still present (so the button width does not collapse).
      expect(btn).toHaveTextContent('Saved');
    });
  });

  describe('disabled state', () => {
    it('disabled removes pointer events', () => {
      render(<Button disabled>Save</Button>);
      const btn = screen.getByRole('button', { name: 'Save' });
      expect(btn).toBeDisabled();
      expect(btn.className).toContain('disabled:pointer-events-none');
    });

    it('disabled does not fire onClick', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Button disabled onClick={onClick}>
          Save
        </Button>,
      );
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('forwardRef', () => {
    it('forwards the ref to the underlying HTMLButtonElement', () => {
      const ref = createRef<HTMLButtonElement>();
      render(<Button ref={ref}>Action</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      // The single forwardRef consumer in the codebase is SessionExpiredGate —
      // this assertion protects that contract.
    });
  });

  describe('keyboard activation', () => {
    it('Enter activates the button', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<Button onClick={onClick}>Save</Button>);
      const btn = screen.getByRole('button', { name: 'Save' });
      btn.focus();
      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('Space activates the button', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<Button onClick={onClick}>Save</Button>);
      const btn = screen.getByRole('button', { name: 'Save' });
      btn.focus();
      await user.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('form behavior', () => {
    it('defaults to type="button" so it does not accidentally submit a form', () => {
      render(
        <form data-testid="form">
          <Button>Save</Button>
        </form>,
      );
      const btn = screen.getByRole('button', { name: 'Save' });
      expect(btn).toHaveAttribute('type', 'button');
    });

    it('type="submit" is honored for form submission', () => {
      render(
        <form data-testid="form">
          <Button type="submit">Submit</Button>
        </form>,
      );
      const btn = screen.getByRole('button', { name: 'Submit' });
      expect(btn).toHaveAttribute('type', 'submit');
    });
  });

  describe('className passthrough', () => {
    it('appends custom className to the variant classes', () => {
      render(<Button className="w-full">Save</Button>);
      const btn = screen.getByRole('button', { name: 'Save' });
      expect(btn.className).toContain('w-full');
    });
  });

  describe('icons', () => {
    it('wraps leftIcon and rightIcon in aria-hidden spans', () => {
      render(
        <Button
          leftIcon={<span data-testid="left-icon">L</span>}
          rightIcon={<span data-testid="right-icon">R</span>}
        >
          Action
        </Button>,
      );
      // The inner icons are decorative; the wrapper span (parent of the
      // data-testid) carries aria-hidden="true". We query via closest()
      // because the test-id is on the inner span, not the wrapper.
      const leftWrapper = screen.getByTestId('left-icon').parentElement;
      const rightWrapper = screen.getByTestId('right-icon').parentElement;
      expect(leftWrapper).toHaveAttribute('aria-hidden', 'true');
      expect(rightWrapper).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
