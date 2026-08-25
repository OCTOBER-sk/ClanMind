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
  Sparkles,
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
      icon: <Sparkles className="w-3.5 h-3.5" />,
      onClick: () => onUseAsContext(message),
    },
  ];

  const iconColor = { color: 'var(--color-text-tertiary)' };

  return (
    <div
      // §25 "Hover/Focus Actions" — the toolbar must surface for keyboard
      // users too: `hidden group-hover:flex` alone left Reply/React/Copy/More
      // unreachable (display:none removes them from the tab order).
      className="absolute right-3 -top-3.5 hidden group-hover:flex group-focus-within:flex items-center rounded-lg shadow-[var(--shadow-md)] px-0.5 py-0.5 z-10 gap-0 border"
      style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border)' }}
    >
      {/* Quick Reaction Popover (§28) */}
      <Popover
        open={isEmojiPickerOpen}
        onOpenChange={setIsEmojiPickerOpen}
        trigger={
          <IconButton aria-label="Add reaction" size="xs">
            <Smile className="w-3.5 h-3.5" style={iconColor} />
          </IconButton>
        }
      >
        <div className="flex items-center gap-0.5 p-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(emoji);
                setIsEmojiPickerOpen(false);
              }}
              className="text-base p-1.5 hover:bg-[var(--color-surface-hover)] rounded-md transition-all duration-100 hover:scale-110 cursor-pointer"
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </Popover>

      {/* Reply */}
      <Tooltip content="Reply">
        <IconButton aria-label="Reply in thread" size="xs" onClick={() => onReply(message)}>
          <Reply className="w-3.5 h-3.5" style={iconColor} />
        </IconButton>
      </Tooltip>

      {/* Copy (§26) */}
      <Tooltip content={copied ? 'Copied' : 'Copy message'}>
        <IconButton
          aria-label={copied ? 'Copied' : 'Copy message'}
          size="xs"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
          ) : (
            <Copy className="w-3.5 h-3.5" style={iconColor} />
          )}
        </IconButton>
      </Tooltip>

      {/* More Actions Dropdown (§25 More menu) */}
      <Dropdown
        trigger={
          <IconButton aria-label="More message actions" size="xs">
            <MoreHorizontal className="w-3.5 h-3.5" style={iconColor} />
          </IconButton>
        }
        items={moreMenuItems}
      />
    </div>
  );
}