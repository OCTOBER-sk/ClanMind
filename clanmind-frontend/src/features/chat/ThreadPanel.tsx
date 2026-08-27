import React, { useEffect, useRef, useState } from 'react';
import { X, Reply, Send } from 'lucide-react';
import { Avatar } from '@/design-system/components/Avatar';
import type { Message } from '@/types';

export interface ThreadPanelProps {
  /** §30 — the original message the thread hangs from. */
  rootMessage: Message;
  /** Live replies (reply_to_message_id === root.id), ascending. */
  replies?: Message[];
  onClose: () => void;
  onSendReply: (rootMessageId: string, replyText: string) => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * §30 Threads — lives in the right work surface and contains exactly:
 * the original message, its replies, and a composer. Escape closes and
 * focus is restored to the element that opened the thread (§7/§66).
 */
export function ThreadPanel({
  rootMessage,
  replies = [],
  onClose,
  onSendReply,
}: ThreadPanelProps) {
  const [replyText, setReplyText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  // §66 safe focus restoration: remember what had focus before we mounted.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current =
      typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;
    inputRef.current?.focus();
    return () => {
      const target = previouslyFocusedRef.current;
      if (target && typeof target.focus === 'function') target.focus();
    };
  }, []);

  // §30/§63 — Escape closes overlays; handled here so it works whether the
  // panel is docked or rendered inside a sheet.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSend = () => {
    if (!replyText.trim()) return;
    onSendReply(rootMessage.id, replyText.trim());
    setReplyText('');
    // §46 — composer keeps focus after sending.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const deletedRoot = rootMessage.deleted;

  return (
    <div
      data-testid="thread-panel"
      role="complementary"
      aria-label="Thread panel"
      className="flex flex-col h-full border-l text-[13px]"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Thread Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <Reply className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
          <h3 className="text-[13px] font-bold" style={{ color: 'var(--color-text)' }}>
            Thread
          </h3>
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
            · {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close thread"
          className="p-1 rounded-lg cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
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
          <span className="font-semibold text-[13px]" style={{ color: 'var(--color-text)' }}>
            {rootMessage.sender_name}
          </span>
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
            {formatTime(rootMessage.created_at)}
          </span>
        </div>
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: deletedRoot ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)', fontStyle: deletedRoot ? 'italic' : undefined }}>
          {deletedRoot ? 'This message was deleted.' : rootMessage.body}
        </p>
      </div>

      {/* Replies List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-label="Thread replies">
        {replies.length === 0 && (
          <div className="text-[12px] text-center py-6" style={{ color: 'var(--color-text-tertiary)' }}>
            No replies yet — start the thread.
          </div>
        )}
        {replies.map((reply) => (
          <div key={reply.id} className="flex gap-2.5">
            <Avatar name={reply.sender_name} size="sm" isAi={reply.sender_type === 'AI'} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[13px]" style={{ color: 'var(--color-text)' }}>
                  {reply.sender_name}
                </span>
                <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
                  {formatTime(reply.created_at)}
                </span>
              </div>
              <p
                className="text-[13px] mt-0.5 leading-relaxed whitespace-pre-wrap"
                style={{
                  color: reply.deleted ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
                  fontStyle: reply.deleted ? 'italic' : undefined,
                }}
              >
                {reply.deleted ? 'This message was deleted.' : reply.body}
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
          className="relative flex items-center border rounded-lg"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
        >
          <input
            ref={inputRef}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                handleSend();
              }
            }}
            placeholder={`Reply to ${rootMessage.sender_name}…`}
            aria-label="Reply to thread"
            className="w-full px-3 py-2 text-[13px] bg-transparent outline-none"
            style={{ color: 'var(--color-text)' }}
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim()}
            aria-label="Send reply"
            className="p-1.5 mr-1 cursor-pointer disabled:opacity-30 transition-opacity"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
          Enter to send · Esc closes the thread
        </p>
      </div>
    </div>
  );
}
