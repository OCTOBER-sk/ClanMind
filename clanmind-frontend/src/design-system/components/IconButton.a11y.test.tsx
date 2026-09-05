/**
 * PHASE 1 Unit 2 — IconButton accessibility tests (FE §215, PAKKA §11).
 *
 * Covers:
 *  - accessible name comes from the mandatory `aria-label` prop
 *  - aria-busy is set in the loading state
 *  - aria-disabled is set in the disabled state
 *  - the focus-visible ring class is present (--focus-ring)
 *  - reduced-motion: motion-reduce:animate-none is on the loading spinner
 *  - decorative children are aria-hidden so they do not contribute to the
 *    accessible name
 *  - state-layer helper classes are applied (PAKKA §TASK 0.16)
 *
 * Test count: 7.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IconButton } from './IconButton';

describe('IconButton — accessibility (FE §215, PAKKA §11)', () => {
  it('derives its accessible name from the mandatory aria-label prop', () => {
    render(
      <IconButton aria-label="Close dialog">
        <span>×</span>
      </IconButton>,
    );
    expect(
      screen.getByRole('button', { name: 'Close dialog' }),
    ).toBeInTheDocument();
  });

  it('sets aria-busy="true" when isLoading', () => {
    render(
      <IconButton aria-label="loading" isLoading>
        <span>x</span>
      </IconButton>,
    );
    const btn = screen.getByRole('button', { name: 'loading' });
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('sets aria-disabled="true" when disabled', () => {
    render(
      <IconButton aria-label="disabled" disabled>
        <span>x</span>
      </IconButton>,
    );
    const btn = screen.getByRole('button', { name: 'disabled' });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('has the focus-visible ring class (--focus-ring, never a tighter radius)', () => {
    render(
      <IconButton aria-label="focus-ring">
        <span>x</span>
      </IconButton>,
    );
    const btn = screen.getByRole('button', { name: 'focus-ring' });
    // The class is applied; jsdom does not honor :focus-visible so we assert
    // the class is present (deterministic) and rely on the visual state
    // matrix owned by PHASE 8 for the actual visible ring.
    expect(btn.className).toContain('focus-visible:shadow-[var(--focus-ring)]');
  });

  it('loading spinner has motion-reduce:animate-none for reduced-motion safety', () => {
    const { container } = render(
      <IconButton aria-label="loading" isLoading>
        <span>x</span>
      </IconButton>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('class')).toContain('motion-reduce:animate-none');
  });

  it('decorative children are aria-hidden (via wrapper span)', () => {
    render(
      <IconButton aria-label="close">
        <span data-testid="icon-inner">×</span>
      </IconButton>,
    );
    // The wrapper span around the icon carries aria-hidden="true"; the inner
    // element is just a child. Query the parent.
    expect(screen.getByTestId('icon-inner').parentElement).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('state-layer helper classes are applied on every render (PAKKA §TASK 0.16)', () => {
    render(
      <IconButton aria-label="state-layers">
        <span>x</span>
      </IconButton>,
    );
    const btn = screen.getByRole('button', { name: 'state-layers' });
    expect(btn.className).toContain('cm-state-hover');
    expect(btn.className).toContain('cm-state-pressed');
    expect(btn.className).toContain('cm-state-focus');
    expect(btn.className).toContain('cm-state-disabled');
  });
});
