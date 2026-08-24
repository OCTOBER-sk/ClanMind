/**
 * FE §202/§289 — chat virtualization regression suite.
 *
 * jsdom has no layout, so the virtualizer's reads are stubbed deterministically:
 *   • the scroll container (`[data-virt-viewport]`) reports 600px height;
 *   • each measured row (`[data-index]`) reports 64px;
 *   • the container's `scrollHeight` is driven per-test through a controllable
 *     instance property so §202 anchor compensation is asserted exactly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState, useCallback } from 'react';
import { MessageList, VIRTUALIZATION_THRESHOLD } from '@/features/chat/MessageList';
import type { Message } from '@/types';

const ROW_HEIGHT = 64;
const VIEWPORT_HEIGHT = 600;

function message(id: string, seq: number): Message {
  return {
    id,
    group_id: 'g1',
    sender_type: 'USER',
    sender_id: 'u1',
    sender_name: 'Arun',
    body: `Body of ${id}`,
    visibility: 'GROUP',
    pinned: false,
    edited: false,
    deleted: false,
    attachments: [],
    reactions: [],
    created_at: new Date(Date.parse('2026-08-23T10:00:00Z') + seq * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function makeMessages(count: number, prefix = 'm'): Message[] {
  return Array.from({ length: count }, (_, i) => message(`${prefix}${i}`, i));
}

const baseProps = {
  currentUserId: 'u1',
  typingUsers: [],
  onReply: () => {},
  onReact: () => {},
  onEditSave: () => {},
  onDelete: () => {},
  onTogglePin: () => {},
  onCreateTask: () => {},
  onCreateDecision: () => {},
  onUseAsContext: () => {},
};

// ─── deterministic layout stubs ─────────────────────────────────────────────

/** A layout getter in the shape of the native `offsetHeight` accessor. */
type LayoutGetter = (this: HTMLElement) => number;

const realOffsetHeightDescriptor =
  Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const realOffsetWidthDescriptor =
  Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');

// Explicitly typed getters — PropertyDescriptor.get is `(() => any) | undefined`,
// which TS refuses to `.call()` against an HTMLElement `this`.
const realHeightGet = realOffsetHeightDescriptor?.get as LayoutGetter | undefined;
const realWidthGet = realOffsetWidthDescriptor?.get as LayoutGetter | undefined;

function installLayoutStubs(): void {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement): number {
      if (this.hasAttribute('data-index')) return ROW_HEIGHT;
      if (this.hasAttribute('data-virt-viewport')) return VIEWPORT_HEIGHT;
      return realHeightGet ? realHeightGet.call(this) : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement): number {
      if (this.hasAttribute('data-virt-viewport')) return 800;
      return realWidthGet ? realWidthGet.call(this) : 0;
    },
  });
}

function uninstallLayoutStubs(): void {
  if (realOffsetHeightDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', realOffsetHeightDescriptor);
  }
  if (realOffsetWidthDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realOffsetWidthDescriptor);
  }
}

function setScrollHeight(el: HTMLElement, value: number): void {
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => value,
  });
}

/**
 * Pin a scroll offset on `el`. MUST be writable: component anchor
 * compensation (§289) writes scrollTop back after prepends.
 */
function setScrollTop(el: HTMLElement, value: number): void {
  Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value });
}

/** Harness — lets tests swap in a longer history (older page prepend). */
function Harness({ initial }: { initial: Message[] }) {
  const [messages, setMessages] = useState(initial);
  const loadOlder = useCallback(() => {
    setMessages((prev) => [...makeMessages(20, 'old'), ...prev]);
  }, []);
  return (
    <MessageList
      {...baseProps}
      messages={messages}
      onLoadOlder={loadOlder}
      hasOlder={true}
    />
  );
}

describe('MessageList virtualization (§202/§289)', () => {
  beforeEach(() => {
    installLayoutStubs();
  });
  afterEach(uninstallLayoutStubs);

  it('windowed rendering: long histories render only the visible range', () => {
    const total = VIRTUALIZATION_THRESHOLD * 4; // 320 messages
    render(<MessageList {...baseProps} messages={makeMessages(total)} />);
    const scroller = screen.getByRole('log', { name: /group conversation/i });

    // First rows exist…
    expect(screen.getByText('Body of m0')).toBeInTheDocument();
    // …the tail does NOT (only ~viewport+overscan rows are mounted).
    expect(screen.queryByText(`Body of m${total - 1}`)).not.toBeInTheDocument();

    const renderedRows = scroller.querySelectorAll('[data-index]').length;
    expect(renderedRows).toBeGreaterThan(0);
    expect(renderedRows).toBeLessThan(total);
  });

  it('short histories render directly (no windowing overhead)', () => {
    render(<MessageList {...baseProps} messages={makeMessages(5)} />);
    expect(screen.getByText('Body of m4')).toBeInTheDocument();
  });

  it('cursor-loads older history when scrolled near the top (§202)', async () => {
    let olderLoads = 0;
    const total = 300;
    function TriggerHarness() {
      const [messages, setMessages] = useState(makeMessages(total));
      const loadOlder = useCallback(() => {
        olderLoads += 1;
        setMessages((prev) => [...makeMessages(20, 'old'), ...prev]);
      }, []);
      return (
        <MessageList
          {...baseProps}
          messages={messages}
          onLoadOlder={loadOlder}
          hasOlder
        />
      );
    }
    render(<TriggerHarness />);
    const scroller = screen.getByRole('log', { name: /group conversation/i }) as HTMLElement;

    setScrollHeight(scroller, total * ROW_HEIGHT);
    // Scroll near the top → trigger fires once (guard prevents spam).
    setScrollTop(scroller, 0);
    fireEvent.scroll(scroller);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(olderLoads).toBe(1);
    // Prepend landed: an old-page row is now rendered.
    expect(screen.getAllByText(/Body of old/).length).toBeGreaterThan(0);
  });

  it('preserves the scroll anchor when older pages prepend — no scroll-jump (§289)', async () => {
    const total = 300;
    render(<Harness initial={makeMessages(total)} />);
    const scroller = screen.getByRole('log', { name: /group conversation/i }) as HTMLElement;

    const initialScrollHeight = total * ROW_HEIGHT;
    setScrollHeight(scroller, initialScrollHeight);
    // Anchor at 200px from the top and register the pre-prepend height.
    const anchorScrollTop = 200;
    setScrollTop(scroller, anchorScrollTop);
    fireEvent.scroll(scroller);

    // Harness prepends 20×64px above the anchor; simulate the layout growth.
    const grownScrollHeight = initialScrollHeight + 20 * ROW_HEIGHT;
    setScrollHeight(scroller, grownScrollHeight);

    // The anchor settle loop runs across animation frames.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });

    // §289 — scrollTop must shift by EXACTLY the prepended height delta so
    // the anchored row stays visually stationary. All numbers here are
    // deterministic integers under the jsdom stubs, so assert exactness.
    expect(scroller.scrollTop - anchorScrollTop).toBe(grownScrollHeight - initialScrollHeight);
  });
});
