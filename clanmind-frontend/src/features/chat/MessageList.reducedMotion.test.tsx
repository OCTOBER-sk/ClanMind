/**
 * P13 accessibility pass — §6 motion in JS-driven scroll.
 *
 * The stylesheet's `scroll-behavior: auto !important` cannot reach the
 * JS `scrollTo({behavior:'smooth'})` option, so "Jump to latest" must gate
 * its own smoothness on prefers-reduced-motion.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageList } from '@/features/chat/MessageList';
import type { Message } from '@/types';

function message(id: string): Message {
  return {
    id,
    group_id: 'g1',
    sender_type: 'USER',
    sender_id: 'u1',
    sender_name: 'Arun',
    body: `Body ${id}`,
    visibility: 'GROUP',
    pinned: false,
    edited: false,
    deleted: false,
    attachments: [],
    reactions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

const baseProps = {
  messages: [message('m1'), message('m2'), message('m3')],
  currentUserId: 'u1',
  typingUsers: [] as string[],
  onReply: vi.fn(),
  onReact: vi.fn(),
  onEditSave: vi.fn(),
  onDelete: vi.fn(),
  onTogglePin: vi.fn(),
  onCreateTask: vi.fn(),
  onCreateDecision: vi.fn(),
  onUseAsContext: vi.fn(),
};

describe('MessageList scrollToBottom — §6 reduced motion', () => {
  let scrollToSpy: ReturnType<typeof vi.spyOn>;
  let matchMediaSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    scrollToSpy = vi
      .spyOn(Element.prototype, 'scrollTo')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    scrollToSpy.mockRestore();
    matchMediaSpy.mockRestore();
  });

  function stubReduceMotion(matches: boolean) {
    matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion') ? matches : false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
  }

  it('uses instant scrolling when prefers-reduced-motion is set', async () => {
    stubReduceMotion(true);
    const user = userEvent.setup();
    render(<MessageList {...baseProps} />);

    // Force the not-near-bottom state so the jump button exists.
    const viewport = document.querySelector('[data-virt-viewport="true"]')!;
    Object.defineProperty(viewport, 'scrollHeight', { value: 5000, configurable: true });
    viewport.scrollTop = 0;
    // handleScroll runs on the scroll event.
    fireEvent.scroll(viewport);
    const btn = screen.getByRole('button', { name: /jump to latest/i });
    scrollToSpy.mockClear();

    await user.click(btn);
    expect(scrollToSpy).toHaveBeenCalled();
    const arg = scrollToSpy.mock.calls[0]![0] as ScrollToOptions;
    expect(arg.behavior).toBe('auto');
  });

  it('keeps smooth scrolling when motion is allowed', async () => {
    stubReduceMotion(false);
    const user = userEvent.setup();
    render(<MessageList {...baseProps} />);
    const viewport = document.querySelector('[data-virt-viewport="true"]')!;
    Object.defineProperty(viewport, 'scrollHeight', { value: 5000, configurable: true });
    viewport.scrollTop = 0;
    fireEvent.scroll(viewport);
    const btn = screen.getByRole('button', { name: /jump to latest/i });
    scrollToSpy.mockClear();

    await user.click(btn);
    expect(scrollToSpy).toHaveBeenCalled();
    const arg = scrollToSpy.mock.calls[0]![0] as ScrollToOptions;
    expect(arg.behavior).toBe('smooth');
  });
});
