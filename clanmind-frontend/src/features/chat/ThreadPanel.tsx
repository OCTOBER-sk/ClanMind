import React, { useState } from 'react';
import { X, Reply, Send } from 'lucide-react';
import { Avatar } from '@/design-system/components/Avatar';
import type { Message } from '@/types';

export interface ThreadPanelProps {
  rootMessage: Message;
  currentUserId: string;
  currentUserName?: string;
  onClose: () => void;
  onSendReply: (rootMessageId: string, replyText: string) => void;
}

/** §30 Threads — reply opens the thread in the right work surface; Esc closes */
export function ThreadPanel({
  rootMessage,
  currentUserId,
  currentUserName,
  onClose,
  onSendReply,
}: ThreadPanelProps) {
  const [replyText, setReplyText] = useState('');
  const [replies, setReplies] = useState<Array<{ id: string; senderId: string; senderName: string; text: string; time: string }>>([
    {
      id: 'rep_1',
      senderId: 'user_priya_2',
      senderName: 'Priya Sharma',
      text: 'Agreed on SPI DMA. Let us allocate SRAM1 bank for telemetry circular ring.',
      time: '12m ago',
    },
  ]);

  const handleSend = () => {
    if (!replyText.trim()) return;
    setReplies((prev) => [
      ...prev,
      {
        id: `rep_${Date.now()}`,
        senderId: currentUserId,
        senderName: currentUserName || currentUserId,
        text: replyText.trim(),
        time: 'Just now',
      },
    ]);
    onSendReply(rootMessage.id, replyText.trim());
    setReplyText('');
  };

  return (
    <div
      className="flex flex-col h-full border-l text-xs"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Thread Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <Reply className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
          <h3 className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
            Thread
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close thread"
          className="p-1 rounded-lg cursor-pointer hover:opacity-80"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Root Message Box */}
      <div
        className="p-4 border-b"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-hover)' }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Avatar name={rootMessage.sender_name} size="sm" isAi={rootMessage.sender_type === 'AI'} />
          <span className="font-semibold text-xs" style={{ color: 'var(--color-text)' }}>
            {rootMessage.sender_name}
          </span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          {rootMessage.body}
        </p>
      </div>

      {/* Replies List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
        </div>
        {replies.map((reply) => (
          <div key={reply.id} className="flex gap-2.5">
            <Avatar name={reply.senderName} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs" style={{ color: 'var(--color-text)' }}>
                  {reply.senderName}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  {reply.time}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                {reply.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply Input */}
      <div
        className="p-3 border-t"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-hover)' }}
      >
        <div
          className="relative flex items-center border rounded-lg shadow-[var(--shadow-sm)]"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
        >
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Reply to thread…"
            aria-label="Reply to thread"
            className="w-full px-3 py-2 text-xs bg-transparent outline-none"
            style={{ color: 'var(--color-text)' }}
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim()}
            aria-label="Send reply"
            className="p-1.5 mr-1 cursor-pointer disabled:opacity-30"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}