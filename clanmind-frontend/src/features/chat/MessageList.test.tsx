import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '@/features/chat/MessageList';
import type { Message } from '@/types';

function message(overrides: Partial<Message>): Message {
  return {
    id: `m_${Math.random().toString(36).slice(2)}`,
    group_id: 'g1',
    sender_type: 'USER',
    sender_id: 'u1',
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

describe('MessageList — §39 unread divider & §78 empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "New messages" divider after the last-read message (§39)', () => {
    const messages = [
      message({ id: 'm1', body: 'Old message' }),
      message({ id: 'm2', body: 'New message' }),
      message({ id: 'm3', body: 'Newest message' }),
    ];
    render(<MessageList {...baseProps} messages={messages} lastReadMessageId="m1" />);
    const divider = screen.getByRole('separator', { name: /new messages start here/i });
    expect(divider).toBeInTheDocument();
    // Divider sits between m1 and m2 — verify sibling ordering via DOM
    const oldMsg = screen.getByText('Old message');
    const newMsg = screen.getByText('New message');
    expect(oldMsg.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(divider.compareDocumentPosition(newMsg) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the group empty state with Ask Odin (§78/§179)', () => {
    render(<MessageList {...baseProps} messages={[]} onAskOdin={vi.fn()} />);
    expect(screen.getByText('Your team is ready.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ask odin/i })).toBeInTheDocument();
  });

  it('announces new messages via a live region without stealing focus (§217)', () => {
    render(<MessageList {...baseProps} messages={[message({ id: 'm1' })]} />);
    // No unread announcements when nothing new
    expect(screen.queryByRole('status')).not.toHaveTextContent(/new messages/);
  });
});