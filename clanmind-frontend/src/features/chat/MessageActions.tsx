import React, { useState } from 'react';
import {
  Reply,
  Smile,
  Copy,
  Check,
  MoreHorizontal,
  Pin,
  Edit2,
  Trash2,
  CheckSquare,
  Bookmark,
  Bot,
  Quote,
  BellMinus,
} from 'lucide-react';
import { IconButton } from '@/design-system/components/IconButton';
import { Dropdown } from '@/design-system/components/Dropdown';
import { Popover } from '@/design-system/components/Popover';
import { Tooltip } from '@/design-system/components/Tooltip';
import { copyToClipboard } from '@/tauri/bridge';
import type { Message } from '@/types';

export interface MessageActionsProps {
  message: Message;
  currentUserId: string;
  /** §25 — only display actions the backend role permits */
  canModerate?: boolean;
  onReply: (message: Message) => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onCreateTask: (message: Message) => void;
  onCreateDecision: (message: Message) => void;
  onUseAsContext: (message: Message) => void;
  onQuote?: (message: Message) => void;
  onMarkUnread?: (message: Message) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '🚀', '👀'];

export function MessageActions({
  message,
  currentUserId,
  canModerate = false,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onTogglePin,
  onCreateTask,
  onCreateDecision,
  onUseAsContext,
  onQuote,
  onMarkUnread,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  // §26 Copy message: copy → check icon → tooltip "Copied" → reset ~1.5–2s. No toast.
  const handleCopy = async () => {
    const ok = await copyToClipboard(message.body);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  // §25: edit/delete only for own messages (or moderators)
  const isOwner = message.sender_id === currentUserId;
  const canEditOrDelete = isOwner || canModerate;

  const moreMenuItems = [
    ...(canEditOrDelete
      ? [
          {
            id: 'edit',
            label: 'Edit message',
            icon: <Edit2 className="w-3.5 h-3.5" />,
            onClick: onEdit,
          },
          {
            id: 'delete',
            label: 'Delete message',
            icon: <Trash2 className="w-3.5 h-3.5" />,
            destructive: true,
            onClick: onDelete,
          },
          { id: 'div-1', divider: true as const },
        ]
      : []),
    {
      id: 'pin',
      label: message.pinned ? 'Unpin message' : 'Pin message',
      icon: <Pin className="w-3.5 h-3.5" />,
      onClick: onTogglePin,
    },
    {
      id: 'task',
      label: 'Create task from this',
      icon: <CheckSquare className="w-3.5 h-3.5" />,
      onClick: () => onCreateTask(message),
    },
    {
      id: 'decision',
      label: 'Save as decision',
      icon: <Bookmark className="w-3.5 h-3.5" />,
      onClick: () => onCreateDecision(message),
    },
    {
      id: 'context',
      label: 'Use as Odin context',
      icon: <Bot className="w-3.5 h-3.5" />,
      onClick: () => onUseAsContext(message),
    },
    {
      id: 'quote',
      label: 'Quote message',
      icon: <Quote className="w-3.5 h-3.5" />,
      onClick: () => onQuote?.(message),
      disabled: !onQuote,
    },
    {
      id: 'unread',
      label: message.is_unread ? 'Mark as read' : 'Mark unread',
      icon: <BellMinus className="w-3.5 h-3.5" />,
      onClick: () => onMarkUnread?.(message),
      disabled: !onMarkUnread,
    },
  ];

  return (
    <div
      // §25 "Hover/Focus Actions" — the toolbar must surface for keyboard
      // users too: `hidden group-hover:flex` alone left Reply/React/Copy/More
      // unreachable (display:none removes them from the tab order).
      className="absolute right-3 -top-3.5 hidden group-hover:flex group-focus-within:flex h-7 items-center rounded-full shadow-lg bg-surface-container-high border border-outline-variant px-1 py-0.5 z-10 gap-0.5"
    >
      {/* Quick Reaction Popover (§28) — M3 icon buttons with state layers */}
      <Popover
        open={isEmojiPickerOpen}
        onOpenChange={setIsEmojiPickerOpen}
        trigger={
          <IconButton aria-label="Add reaction" size="xs" className="rounded-full hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)] focus-visible:shadow-[var(--md-focus-ring)] motion-reduce:transition-none">
            <Smile className="w-3.5 h-3.5 text-on-surface-variant" />
          </IconButton>
        }
      >
        <div className="flex items-center gap-0.5 p-1 bg-surface-container-high rounded-md border border-outline-variant shadow-lg">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(emoji);
                setIsEmojiPickerOpen(false);
              }}
              className="text-base p-1.5 rounded-full transition-all duration-micro ease-emphasized motion-reduce:transition-none hover:scale-105 active:scale-95 cursor-pointer hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)] focus-visible:shadow-[var(--md-focus-ring)] outline-none"
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </Popover>

      {/* Reply — M3 icon button */}
      <Tooltip content="Reply">
        <IconButton aria-label="Reply in thread" size="xs" onClick={() => onReply(message)} className="rounded-full hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)] focus-visible:shadow-[var(--md-focus-ring)] motion-reduce:transition-none">
          <Reply className="w-3.5 h-3.5 text-on-surface-variant" />
        </IconButton>
      </Tooltip>

      {/* Copy (§26) — M3 icon button */}
      <Tooltip content={copied ? 'Copied' : 'Copy message'}>
        <IconButton
          aria-label={copied ? 'Copied' : 'Copy message'}
          size="xs"
          onClick={handleCopy}
          className="rounded-full hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)] focus-visible:shadow-[var(--md-focus-ring)] motion-reduce:transition-none"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-success" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-on-surface-variant" />
          )}
        </IconButton>
      </Tooltip>

      {/* More Actions Dropdown (§25 More menu) — M3 icon button */}
      <Dropdown
        trigger={
          <IconButton aria-label="More message actions" size="xs" className="rounded-full hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)] focus-visible:shadow-[var(--md-focus-ring)] motion-reduce:transition-none">
            <MoreHorizontal className="w-3.5 h-3.5 text-on-surface-variant" />
          </IconButton>
        }
        items={moreMenuItems}
      />
    </div>
  );
}
