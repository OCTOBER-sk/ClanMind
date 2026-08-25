import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MessageRow } from './MessageRow';
import { ChatHeader } from './ChatHeader';
import { AiStreamAnnouncer } from '@/features/ai/AiStreamAnnouncer';
import { ArrowDown, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/design-system/utils';
import { Button } from '@/design-system/components/Button';
import type { Message, TypingIndicator, AiRun, GroupRole } from '@/types';

/** Below this count the virtualizer overhead buys nothing (§201). */
export const VIRTUALIZATION_THRESHOLD = 80;
/** Estimated row height for first paint; corrected by measurement. */
const ROW_ESTIMATE_PX = 64;
const OVERSCAN_ROWS = 8;
/** Scroll distance from top that triggers cursor-loading older history. */
const LOAD_OLDER_TRIGGER_PX = 480;

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
  /** §138/§139 — Retry / Regenerate an AI response as a NEW run */
  onRegenerate?: (messageId: string) => void;
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
  /** §202/§289 — cursor-load one older page; wired by useChatMessages */
  onLoadOlder?: () => void;
  hasOlder?: boolean;
  isLoadingOlder?: boolean;
  /** §78 group empty state actions */
  onCreateProject?: () => void;
  onInviteTeammates?: () => void;
  onAskOdin?: () => void;
}

/**
 * §21/§22/§24/§39/§40/§41 + §202/§289 — the conversation surface.
 *
 * Long histories are VIRTUALIZED with stable keys (`message.id`), dynamic
 * row measurement, preserved scroll anchors when older pages prepend
 * (height-delta compensation — no scroll-jump), and a top-of-list trigger
 * that cursor-loads older messages. Short histories render directly.
 * The unread divider rides INSIDE its row wrapper so anchors hold.
 */
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
  onRegenerate,
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
  onLoadOlder,
  hasOlder = false,
  isLoadingOlder = false,
  onCreateProject,
  onInviteTeammates,
  onAskOdin,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadNewCount, setUnreadNewCount] = useState(0);
  const lastMessageCountRef = useRef(messages.length);

  // ── §202 anchor bookkeeping ─────────────────────────────────────────────
  // When prepending an older page the content above the viewport grows; we
  // compensate scrollTop by the measured height delta so the anchored row
  // stays visually stationary ("do not scroll-jump").
  const pendingAnchorRef = useRef<{
    /** Container scrollHeight captured when the older page was requested. */
    scrollHeight: number;
    /** Message count captured when the older page was requested. */
    prevCount: number;
    frames: number;
  } | null>(null);
  const loadOlderGuardRef = useRef(false);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    getItemKey: (index) => messages[index]?.id ?? `idx_${index}`,
    overscan: OVERSCAN_ROWS,
  });

  const checkIfNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback(
    (smooth = true) => {
      const el = containerRef.current;
      if (!el) return;
      // §6 — JS smooth scrolling is motion too; the stylesheet's
      // `scroll-behavior: auto` override cannot reach the JS option.
      const reduceMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth && !reduceMotion ? 'smooth' : 'auto',
      });
      setUnreadNewCount(0);
      setIsNearBottom(true);
      const last = messages[messages.length - 1];
      if (last && onMarkRead) onMarkRead(last.id);
    },
    [messages, onMarkRead],
  );

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = checkIfNearBottom();
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setUnreadNewCount(0);
      const last = messages[messages.length - 1];
      if (last && onMarkRead) onMarkRead(last.id);
    }
    // §202 — approaching the top of the loaded window fetches older pages.
    if (
      el.scrollTop < LOAD_OLDER_TRIGGER_PX &&
      hasOlder &&
      !isLoadingOlder &&
      !loadOlderGuardRef.current
    ) {
      loadOlderGuardRef.current = true;
      pendingAnchorRef.current = { scrollHeight: el.scrollHeight, prevCount: messages.length, frames: 0 };
      onLoadOlder?.();
    }
  }, [checkIfNearBottom, messages, onMarkRead, hasOlder, isLoadingOlder, onLoadOlder]);

  // §41: auto-follow only when near bottom; accumulate otherwise
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (messages.length > lastMessageCountRef.current) {
      if (pendingAnchorRef.current) {
        // Growth came from a history prepend — handled by the anchor effect.
      } else if (isNearBottom) {
        scrollToBottom(true);
      } else {
        setUnreadNewCount((prev) => prev + (messages.length - lastMessageCountRef.current));
      }
    }
    lastMessageCountRef.current = messages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Initial paint lands at the latest message without animation.
  useEffect(() => {
    scrollToBottom(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // §202 — restore the scroll anchor after an older page mounts. The exact
  // height delta above the anchor is added back to scrollTop once per frame
  // until measurements settle (dynamic row heights arrive asynchronously).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !pendingAnchorRef.current) return;
    let raf = 0;
    const settle = () => {
      const anchor = pendingAnchorRef.current;
      if (!anchor || !containerRef.current) return;
      const delta = containerRef.current.scrollHeight - anchor.scrollHeight;
      if (delta !== 0) {
        containerRef.current.scrollTop += delta;
        anchor.scrollHeight = containerRef.current.scrollHeight;
      }
      anchor.frames += 1;
      // Two consecutive settled frames (or a sane cap) releases the anchor.
      if ((delta === 0 && anchor.frames >= 2) || anchor.frames >= 12) {
        pendingAnchorRef.current = null;
        loadOlderGuardRef.current = false;
        return;
      }
      raf = requestAnimationFrame(settle);
    };
    raf = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(raf);
  }, [messages.length]);

  // A failed/empty older-page fetch must not wedge the load-older trigger.
  // Only releases when the fetch finished WITHOUT appending rows — a landed
  // prepend keeps the anchor alive so §202/§289 compensation can run. The
  // comparison uses the count captured at trigger time (prevCount), never
  // lastMessageCountRef, which is already updated by the time effects run.
  useEffect(() => {
    const anchor = pendingAnchorRef.current;
    if (!anchor || isLoadingOlder) return;
    if (messages.length === anchor.prevCount) {
      pendingAnchorRef.current = null;
      loadOlderGuardRef.current = false;
    }
  }, [isLoadingOlder, messages.length]);

  // Keep following the latest message while measurement-driven height
  // corrections stream in after the initial paint (§41 near-bottom rule).
  const totalSize = virtualizer.getTotalSize();
  const prevTotalSizeRef = useRef(totalSize);
  useEffect(() => {
    if (
      totalSize > prevTotalSizeRef.current &&
      isNearBottom &&
      !pendingAnchorRef.current
    ) {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    prevTotalSizeRef.current = totalSize;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSize]);

  // ── §136 Auto-Scroll During AI ────────────────────────────────────────────
  // While Odin streams, the ACTIVE message grows without changing the list
  // count. Follow it ONLY while the user is near the bottom: the instant they
  // scroll away the viewport stops moving (§325 #6 — never move scroll while
  // reading), `Jump to latest` appears, and following resumes automatically
  // when they return to the bottom.
  const streamingIds = useMemo(() => new Set(streamingMessageIds), [streamingMessageIds]);
  const hasActiveStream = streamingIds.size > 0 || aiWorking;
  useEffect(() => {
    if (!hasActiveStream) return;
    let raf = 0;
    const step = () => {
      const el = containerRef.current;
      // checkIfNearBottom reads live layout each frame: user intent wins.
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
        el.scrollTop = el.scrollHeight; // instant — no smooth lag mid-stream
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [hasActiveStream]);

  const renderTypingText = () => {
    if (typingUsers.length === 0) return null;
    const names = typingUsers.map((u) => (typeof u === 'string' ? u : u.user_name));
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return 'Several teammates are typing…';
  };

  // §39: draw the unread divider after the last-read message
  const unreadDividerIndex = lastReadMessageId
    ? messages.findIndex((m) => m.id === lastReadMessageId) + 1
    : -1;

  /** §218 announcer mounts only while AI runs are in flight or settling. */
  const aiRunCount = Object.keys(aiRunsByMessage).length;

  const renderRow = (message: Message, index: number) => {
    const prevMessage = index > 0 ? messages[index - 1] : undefined;
    const isConsecutive =
      !!prevMessage &&
      prevMessage.sender_id === message.sender_id &&
      new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() <
        1000 * 60 * 5 &&
      !prevMessage.deleted;

    return (
      <>
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
          isStreaming={streamingIds.has(message.id)}
          onRetry={onRetry}
          onRegenerate={onRegenerate}
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
      </>
    );
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
      {/* §218 — lifecycle-only announcements (started/completed/failed);
          mounted only while AI runs exist so the live region isn't noise */}
      {aiRunCount > 0 && <AiStreamAnnouncer aiName={aiName} runsByMessage={aiRunsByMessage} />}

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
        data-virt-viewport="true"
        className="flex-1 overflow-y-auto overflow-x-hidden pt-4 pb-2"
        role="log"
        aria-label="Group conversation"
      >
        {/* §179/§78 group empty state */}
        {isEmpty && (
          <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
              Your team is ready.
            </div>
            <p className="text-[13px] max-w-md" style={{ color: 'var(--color-text-secondary)' }}>
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

        {!isEmpty && messages.length <= VIRTUALIZATION_THRESHOLD && (
          /* Short histories render directly — no virtualizer overhead. */
          messages.map((message, index) => (
            <React.Fragment key={message.id}>{renderRow(message, index)}</React.Fragment>
          ))
        )}

        {!isEmpty && messages.length > VIRTUALIZATION_THRESHOLD && (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const message = messages[virtualRow.index];
              if (!message) return null;
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {renderRow(message, virtualRow.index)}
                </div>
              );
            })}
          </div>
        )}

        {/* §289 older-page loading indicator at the head of the list */}
        {isLoadingOlder && !isEmpty && (
          <div
            className="flex items-center justify-center gap-2 py-2 text-[11px]"
            role="status"
            aria-label="Loading older messages"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            Loading earlier messages…
          </div>
        )}
      </div>

      {/* Typing Indicator (§37) */}
      {typingUsers.length > 0 && (
        <div
          role="status"
          className="px-5 py-1.5 text-[11px] italic flex items-center gap-1.5 select-none"
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
            'absolute bottom-3 right-8 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold shadow-[var(--shadow-lg)] transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer z-30 border',
            unreadNewCount > 0
              ? 'bg-[var(--color-info)] text-white hover:opacity-90'
              : 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90'
          )}
          style={{ borderColor: 'var(--color-border)' }}
        >
          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{unreadNewCount > 0 ? `${unreadNewCount} new` : 'Jump to latest'}</span>
        </button>
      )}
    </div>
  );
}
