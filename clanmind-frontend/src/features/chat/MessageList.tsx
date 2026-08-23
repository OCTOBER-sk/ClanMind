import React, { useRef, useEffect, useState } from 'react';
import { MessageRow } from './MessageRow';
import { ChatHeader } from './ChatHeader';
import { ArrowDown, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/design-system/utils';
import { Button } from '@/design-system/components/Button';
import type { Message, TypingIndicator, AiRun, GroupRole } from '@/types';

export interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  typingUsers: (string | TypingIndicator)[];
  /** §39 — last message the user has read; unread divider is drawn after it */
  lastReadMessageId?: string;
  /** §39 — called when the user reaches the latest messages */
  onMarkRead?: (messageId: string) => void;
  /** AI runs keyed by message id (§134A) */
  aiRunsByMessage?: Record<string, AiRun>;
  /** Streaming message ids (§134A STREAMING) */
  streamingMessageIds?: string[];
  aiName?: string;
  groupName?: string;
  activeProjectName?: string;
  presenceCount?: number;
  /** §132 — Odin is actively working (researching/streaming/building) */
  aiWorking?: boolean;
  meetingEnabled?: boolean;
  isMeetingActive?: boolean;
  onOpenSearch?: () => void;
  onStartMeeting?: () => void;
  onRetry?: (messageId: string) => void;
  canModerate?: boolean;
  /** §141 — role drives whether the quota card offers "Open AI settings" */
  userRole?: GroupRole;
  onOpenSettings?: () => void;
  onReply: (message: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
  onEditSave: (messageId: string, newBody: string) => void;
  onDelete: (messageId: string) => void;
  onTogglePin: (messageId: string) => void;
  onCreateTask: (message: Message) => void;
  onCreateDecision: (message: Message) => void;
  onUseAsContext: (message: Message) => void;
  onOpenThread?: (message: Message) => void;
  /** §78 group empty state actions */
  onCreateProject?: () => void;
  onInviteTeammates?: () => void;
  onAskOdin?: () => void;
}

export function MessageList({
  messages,
  currentUserId,
  typingUsers,
  lastReadMessageId,
  onMarkRead,
  aiRunsByMessage = {},
  streamingMessageIds = [],
  aiName = 'Odin',
  groupName = 'Group Chat',
  activeProjectName,
  presenceCount = 0,
  aiWorking = false,
  meetingEnabled = false,
  isMeetingActive = false,
  onOpenSearch,
  onStartMeeting,
  onRetry,
  canModerate = false,
  userRole = 'MEMBER',
  onOpenSettings,
  onReply,
  onReact,
  onEditSave,
  onDelete,
  onTogglePin,
  onCreateTask,
  onCreateDecision,
  onUseAsContext,
  onOpenThread,
  onCreateProject,
  onInviteTeammates,
  onAskOdin,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadNewCount, setUnreadNewCount] = useState(0);
  const lastMessageCountRef = useRef(messages.length);

  const checkIfNearBottom = () => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const handleScroll = () => {
    const nearBottom = checkIfNearBottom();
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setUnreadNewCount(0);
      const last = messages[messages.length - 1];
      if (last && onMarkRead) onMarkRead(last.id);
    }
  };

  const scrollToBottom = (smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setUnreadNewCount(0);
    setIsNearBottom(true);
    const last = messages[messages.length - 1];
    if (last && onMarkRead) onMarkRead(last.id);
  };

  // §41: auto-follow only when near bottom; accumulate otherwise
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (messages.length > lastMessageCountRef.current) {
      if (isNearBottom) {
        scrollToBottom(true);
      } else {
        setUnreadNewCount((prev) => prev + (messages.length - lastMessageCountRef.current));
      }
    }
    lastMessageCountRef.current = messages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    scrollToBottom(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderTypingText = () => {
    if (typingUsers.length === 0) return null;
    const names = typingUsers.map((u) => (typeof u === 'string' ? u : u.user_name));
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return 'Several teammates are typing…';
  };

  const streamingIds = new Set(streamingMessageIds);

  // §39: draw the unread divider after the last-read message
  const unreadDividerIndex = lastReadMessageId
    ? messages.findIndex((m) => m.id === lastReadMessageId) + 1
    : -1;

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
      <ChatHeader
        groupName={groupName}
        aiName={aiName}
        activeProjectName={activeProjectName}
        presenceCount={presenceCount}
        aiWorking={aiWorking}
        meetingEnabled={meetingEnabled}
        isMeetingActive={isMeetingActive}
        onOpenSearch={onOpenSearch}
        onStartMeeting={onStartMeeting}
      />

      {/* Scrollable Message Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden pt-4 pb-2"
        role="log"
        aria-label="Group conversation"
      >
        {/* §179/§78 group empty state */}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              Your team is ready.
            </div>
            <p className="text-sm max-w-md" style={{ color: 'var(--color-text-secondary)' }}>
              Start talking, create a Project or ask {aiName} something.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {onCreateProject && (
                <Button size="sm" variant="primary" onClick={onCreateProject}>
                  Create Project
                </Button>
              )}
              {onInviteTeammates && (
                <Button size="sm" variant="ghost" onClick={onInviteTeammates}>
                  Invite teammates
                </Button>
              )}
              {onAskOdin && (
                <Button
                  size="sm"
                  variant="spectral"
                  onClick={onAskOdin}
                  rightIcon={<Sparkles className="w-3.5 h-3.5" />}
                >
                  Ask {aiName}
                </Button>
              )}
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const prevMessage = messages[index - 1];
          const isConsecutive =
            !!prevMessage &&
            prevMessage.sender_id === message.sender_id &&
            new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() <
              1000 * 60 * 5 &&
            !prevMessage.deleted;

          const isStreaming = streamingIds.has(message.id);

          return (
            <React.Fragment key={message.id}>
              {/* §39 unread divider */}
              {index === unreadDividerIndex && (
                <div
                  className="flex items-center gap-3 px-4 py-2 select-none"
                  role="separator"
                  aria-label="New messages start here"
                >
                  <span className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-info)' }}>
                    New messages
                  </span>
                  <span className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
                </div>
              )}
              <MessageRow
                message={message}
                currentUserId={currentUserId}
                isConsecutive={isConsecutive}
                aiRun={aiRunsByMessage[message.id]}
                aiName={aiName}
                isStreaming={isStreaming}
                onRetry={onRetry}
                canModerate={canModerate}
                userRole={userRole}
                onOpenSettings={onOpenSettings}
                onReply={onReply}
                onReact={onReact}
                onEditSave={onEditSave}
                onDelete={onDelete}
                onTogglePin={onTogglePin}
                onCreateTask={onCreateTask}
                onCreateDecision={onCreateDecision}
                onUseAsContext={onUseAsContext}
                onOpenThread={onOpenThread}
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* Typing Indicator (§37) */}
      {typingUsers.length > 0 && (
        <div
          role="status"
          className="px-5 py-1 text-[11px] italic flex items-center gap-1.5 select-none"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          <span>{renderTypingText()}</span>
        </div>
      )}

      {/* §217: announce new messages, never steal focus */}
      {unreadNewCount > 0 && (
        <span className="sr-only" role="status">
          {unreadNewCount} new messages
        </span>
      )}

      {/* Jump to Latest / New Messages Button (§40) — subtle scale, no bounce (§29) */}
      {!isNearBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className={cn(
            'absolute bottom-3 right-8 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-[var(--shadow-lg)] transition-transform hover:scale-105 active:scale-95 cursor-pointer z-30 border',
            unreadNewCount > 0
              ? 'bg-[var(--color-info)] text-white hover:opacity-90'
              : 'bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:opacity-90'
          )}
          style={{ borderColor: 'var(--color-border)' }}
        >
          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{unreadNewCount > 0 ? `↓ ${unreadNewCount} new messages` : 'Jump to latest'}</span>
        </button>
      )}
    </div>
  );
}