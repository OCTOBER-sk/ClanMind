import React, { useState } from 'react';
import { Search, Video, Users, FolderKanban, Hash, Pin } from 'lucide-react';
import { Tooltip } from '@/design-system/components/Tooltip';
import { Popover } from '@/design-system/components/Popover';
import { Avatar } from '@/design-system/components/Avatar';
import { AiStatusIndicator } from '@/features/ai/AiStatusIndicator';
import type { GroupMember, Message, PresenceState } from '@/types';

/**
 * §80 Group Main Chat Header:
 *   Group Chat label · project context chip · search · meeting · presence
 * §267: the chip says "Group chat" or "Project: {name}".
 */
export interface ChatHeaderProps {
  groupName: string;
  aiName: string;
  activeProjectName?: string;
  /** §38 presence — e.g. "3 teammates here" */
  presenceCount?: number;
  /** §5.4 — optional roster for the teammates-here popover. */
  presenceMembers?: Array<{ member: GroupMember; presence: PresenceState }>;
  /** §6.12 — pinned messages in the current scope (preview only). */
  pinnedMessages?: Message[];
  /** §132 — Odin is actively working (researching/streaming/building) */
  aiWorking?: boolean;
  meetingEnabled: boolean;
  isMeetingActive: boolean;
  onOpenSearch?: () => void;
  onStartMeeting?: () => void;
  /** §5.4 — open a private chat / mention from the popover row. */
  onStartPrivateChat?: (member: GroupMember) => void;
  /** §6.12 — click a pinned item in the popover to scroll to it. */
  onSelectPinned?: (message: Message) => void;
}

export function ChatHeader({
  groupName,
  aiName,
  activeProjectName,
  presenceCount = 0,
  presenceMembers = [],
  pinnedMessages = [],
  aiWorking = false,
  meetingEnabled,
  isMeetingActive,
  onOpenSearch,
  onStartMeeting,
  onStartPrivateChat,
  onSelectPinned,
}: ChatHeaderProps) {
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const hasRoster = presenceMembers.length > 0;
  const pinnedCount = pinnedMessages.length;
  return (
    <header
      className="flex items-center justify-between px-4 h-12 border-b shrink-0 select-none"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
          <span className="text-[13px] font-bold truncate" style={{ color: 'var(--color-text)' }}>
            {groupName}
          </span>
        </div>
        {/* §267 project context chip */}
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium max-w-[200px]"
          style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}
        >
          <FolderKanban className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{activeProjectName ? `Project: ${activeProjectName}` : 'Group chat'}</span>
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* §6.12 — Pinned (N) popover — quick jump to a pinned message. */}
        {pinnedCount > 0 && (
          <Popover
            open={pinnedOpen}
            onOpenChange={setPinnedOpen}
            trigger={
              <button
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label={`${pinnedCount} pinned messages`}
                aria-expanded={pinnedOpen}
              >
                <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                {pinnedCount} pinned
              </button>
            }
          >
            <div
              className="min-w-[260px] max-h-64 overflow-y-auto rounded-lg border border-outline-variant shadow-lg p-1"
              style={{ background: 'var(--color-surface-raised)' }}
              role="list"
              aria-label="Pinned messages"
            >
              {pinnedMessages.map((m) => (
                <button
                  key={m.id}
                  role="listitem"
                  onClick={() => {
                    onSelectPinned?.(m);
                    setPinnedOpen(false);
                  }}
                  className="w-full flex items-start gap-2 px-2 py-1.5 rounded-md text-[12px] text-left transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:shadow-[var(--md-focus-ring)] focus-visible:outline-none"
                  style={{ color: 'var(--color-text)' }}
                >
                  <Pin className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
                  <span className="truncate flex-1">{m.body.slice(0, 80)}</span>
                </button>
              ))}
            </div>
          </Popover>
        )}

        {/* §38 presence — clickable list (popover shows roster) */}
        {presenceCount > 0 && hasRoster ? (
          <Popover
            open={presenceOpen}
            onOpenChange={setPresenceOpen}
            trigger={
              <button
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label={`${presenceCount} teammates here`}
                aria-expanded={presenceOpen}
              >
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                {presenceCount} here
              </button>
            }
          >
            <div
              className="min-w-[200px] max-h-64 overflow-y-auto rounded-lg border border-outline-variant shadow-lg p-1"
              style={{ background: 'var(--color-surface-raised)' }}
              role="list"
              aria-label="Teammates here"
            >
              {presenceMembers.map(({ member, presence }) => (
                <button
                  key={member.user_id}
                  role="listitem"
                  onClick={() => {
                    onStartPrivateChat?.(member);
                    setPresenceOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-left transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:shadow-[var(--md-focus-ring)] focus-visible:outline-none"
                  style={{ color: 'var(--color-text)' }}
                >
                  <Avatar name={member.user.name} size="xs" presence={presence} />
                  <span className="truncate flex-1">{member.nickname || member.user.name}</span>
                  <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    {presence === 'ONLINE' ? 'Online' : presence === 'IDLE' ? 'Idle' : presence === 'AWAY' ? 'Away' : 'Offline'}
                  </span>
                </button>
              ))}
            </div>
          </Popover>
        ) : presenceCount > 0 ? (
          <Tooltip content="View who is here">
            <button
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              aria-label={`${presenceCount} teammates here`}
            >
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              {presenceCount} here
            </button>
          </Tooltip>
        ) : null}

        {/* Search (§61 entry point from chat header) */}
        {onOpenSearch && (
          <Tooltip content="Search or jump to…">
            <button
              onClick={onOpenSearch}
              className="p-1.5 rounded-lg cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              aria-label="Search or jump to…"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
            </button>
          </Tooltip>
        )}

        {/* §165A.2 meeting gated by flag; §123 meeting entry */}
        {meetingEnabled && !isMeetingActive && onStartMeeting && (
          <button
            onClick={onStartMeeting}
            aria-label="Start meeting"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-semibold cursor-pointer transition-colors"
            style={{
              color: 'var(--color-danger)',
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-border)',
            }}
          >
            <Video className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Meeting</span>
          </button>
        )}

        {/* §129 AI identity + §132 status */}
        <span
          className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium"
          style={{ color: 'var(--color-text-tertiary)', background: 'var(--color-surface-hover)' }}
        >
          <AiStatusIndicator
            status={aiWorking ? 'working' : 'available'}
            aiName={aiName}
            activityLabel={aiWorking ? `${aiName} is working…` : undefined}
            compact
          />
        </span>
      </div>
    </header>
  );
}