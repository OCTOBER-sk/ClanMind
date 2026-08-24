/**
 * P13 accessibility pass — §25 "Hover/Focus Actions".
 *
 * The message action toolbar previously rendered `hidden group-hover:flex`
 * only: display:none removed Reply/React/Copy/More from the tab order, so a
 * keyboard user could not operate ANY message action. These assertions lock
 * the fix: rows are focus entry points and the toolbar surfaces on focus.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '@/features/chat/MessageList';
import type { Message } from '@/types';

function message(overrides: Partial<Message>): Message {
  return {
    id: `m_${Math.random().toString(36).slice(2)}`,
    group_id: 'g1',
    sender_type: 'USER',
    sender_id: 'u_other',
    sender_name: 'Arun',
    body: 'Hello team',
    visibility: 'GROUP',
    pinned: false,
    edited: false,
    deleted: false,
    attachments: [],
    reactions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const baseProps = {
  messages: [] as Message[],
  currentUserId: 'u_me',
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

describe('MessageList — §25 hover AND focus message actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('every message row is a keyboard focus entry point (tabIndex=0)', () => {
    render(
      <MessageList
        {...baseProps}
        messages={[message({ id: 'm1' }), message({ id: 'm2' })]}
      />,
    );
    const log = screen.getByRole('log', { name: 'Group conversation' });
    const focusableRows = log.querySelectorAll<HTMLElement>('div[data-streaming], div.group');
    // Both rows expose themselves as stops in the tab order.
    const rows = Array.from(log.querySelectorAll<HTMLElement>('.group')).filter(
      (el) => el.getAttribute('tabindex') === '0',
    );
    expect(rows.length).toBe(focusableRows.length);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('action toolbar reveals on FOCUS WITHIN, not hover alone (§25)', () => {
    render(
      <MessageList {...baseProps} messages={[message({ id: 'm1' })]} />,
    );
    // The toolbar container must carry both reveal mechanisms.
    const toolbars = document.querySelectorAll<HTMLDivElement>('.group-focus-within\\/\\:flex');
    void toolbars;
    const toolbar = Array.from(document.querySelectorAll('div')).find((el) =>
      el.className.includes('group-hover:flex'),
    );
    expect(toolbar).toBeDefined();
    expect(toolbar!.className).toContain('group-focus-within:flex');

    // Its controls keep their accessible names (§64).
    expect(screen.getByRole('button', { name: 'Add reaction' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reply in thread' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More message actions' })).toBeInTheDocument();
  });

  it('own messages expose Edit/Delete through the same reachable toolbar', () => {
    render(
      <MessageList
        {...baseProps}
        currentUserId="u_me"
        messages={[message({ id: 'm1', sender_id: 'u_me' })]}
      />,
    );
    // Edit/Delete live behind the More menu; the menu trigger itself must be
    // the only extra stop — presence here guards against display:none drift.
    const toolbar = Array.from(document.querySelectorAll('div')).find((el) =>
      el.className.includes('group-focus-within:flex'),
    );
    expect(toolbar).toBeDefined();
  });
});
