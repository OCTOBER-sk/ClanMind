/**
 * P13 accessibility pass — toast announcements (§7 status announcements).
 *
 * Radix Toast defaults to role="status" (polite). Errors must interrupt:
 * the error variant renders role="alert" so failures are announced
 * assertively instead of being queued behind chatter.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

function Harness({ variant }: { variant: 'success' | 'error' }) {
  return (
    <ToastProvider>
      <FireButton variant={variant} />
    </ToastProvider>
  );
}

function FireButton({ variant }: { variant: 'success' | 'error' }) {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast({ title: 'Saved', variant })}>
      fire-{variant}
    </button>
  );
}

describe.each(['success', 'error'] as const)('Toast (%s)', (variant) => {
  it(`announces with ${variant === 'error' ? 'role="alert" (assertive)' : 'the default polite status role'}`, () => {
    render(<Harness variant={variant} />);
    act(() => {
      screen.getByText(`fire-${variant}`).click();
    });
    const toast = screen.getByText('Saved').closest('[role]');
    expect(toast).not.toBeNull();
    expect(toast!).toHaveAttribute('role', variant === 'error' ? 'alert' : 'status');
  });
});
