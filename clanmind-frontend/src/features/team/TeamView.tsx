/**
 * §21 Team view — compact disciplined rows, not oversized empty cards.
 *
 * Anatomy per row: Avatar · Name/Role · Presence · Actions
 * Grid is tight; no giant card interiors wasting viewport space.
 */

import React, { useState } from 'react';
import { MessageSquare, Edit3, UserPlus, Sparkles } from 'lucide-react';
import { Avatar } from '@/design-system/components/Avatar';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import { EmptyState } from '@/design-system/components/EmptyState';
import { Skeleton } from '@/design-system/components/Skeleton';
import odinAvatar from '@/assets/brand/odin-avatar.png';
import type { GroupMember, PresenceState } from '@/types';

export interface TeamViewProps {
  members: GroupMember[];
  memberNicknames: Record<string, string>;
  onSetNickname: (userId: string, nickname: string) => void;
  onStartPrivateChat: (member: GroupMember) => void;
  onInviteTeammate: () => void;
  isLoading?: boolean;
  error?: string | null;
}

const ROLE_BADGE: Record<string, 'spectral' | 'info' | 'neutral'> = {
  OWNER: 'spectral',
  ADMIN: 'info',
  MEMBER: 'neutral',
  GUEST: 'neutral',
};

/** §19 — presence label; no colored dots, just text + avatar dot. */
const PRESENCE_LABEL: Record<PresenceState, string> = {
  ONLINE: 'Online',
  IDLE: 'Idle',
  AWAY: 'Away',
  OFFLINE: 'Offline',
};

export function TeamView({
  members,
  memberNicknames,
  onSetNickname,
  onStartPrivateChat,
  onInviteTeammate,
  isLoading,
  error,
}: TeamViewProps) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [tempNickname, setTempNickname] = useState('');

  const handleStartEdit = (member: GroupMember) => {
    setEditingUserId(member.user_id);
    setTempNickname(memberNicknames[member.user_id] || member.user.name);
  };

  const handleSaveNickname = (userId: string) => {
    if (tempNickname.trim()) {
      onSetNickname(userId, tempNickname.trim());
    }
    setEditingUserId(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 border-b px-6 py-4"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div>
          <h1 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>
            Team
          </h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {members.length} member{members.length !== 1 ? 's' : ''} · Group members and roles.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<UserPlus className="w-3.5 h-3.5" />}
          onClick={onInviteTeammate}
        >
          Invite
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="px-6 py-2 text-xs border-b"
          style={{ color: 'var(--color-danger)', background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto" aria-busy={isLoading}>
        {isLoading && members.length === 0 ? (
          /* §64 — skeleton loading, not universal spinner */
          <div className="p-6 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--color-surface)' }}>
                <Skeleton variant="circular" className="h-8 w-8 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton variant="text" className="h-3 w-28" />
                  <Skeleton variant="text" className="h-2.5 w-20" />
                </div>
                <Skeleton variant="text" className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="w-8 h-8" />}
            title="No team members yet"
            description="Invite teammates to collaborate on projects and share AI context."
            actions={
              <Button size="sm" variant="primary" leftIcon={<UserPlus className="w-3.5 h-3.5" />} onClick={onInviteTeammate}>
                Invite Teammate
              </Button>
            }
          />
        ) : (
          /* §21 — compact row layout, not oversized cards */
          <div className="px-6 py-3">
            {/* Team members table */}
            <div role="table" aria-label="Team members">
            {/* Column headers */}
            <div
              className="grid grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: 'var(--color-text-tertiary)' }}
              role="row"
            >
              <span role="columnheader">Member</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Status</span>
              <span role="columnheader" className="text-right">Actions</span>
            </div>

            {/* Rows */}
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {/* AI Teammate row — Odin */}
              <div
                className="grid grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-3 px-3 py-2.5 rounded-md"
                style={{ background: 'var(--color-surface)' }}
                role="row"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name="Odin" src={odinAvatar} size="sm" isAi />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                        Odin
                      </span>
                      <Sparkles className="w-3 h-3 shrink-0" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
                    </div>
                    <p className="text-[10px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                      AI Teammate
                    </p>
                  </div>
                </div>
                <Badge variant="spectral" size="sm">AI</Badge>
                <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                  Available
                </span>
                <div />
              </div>

              {members.map((member) => {
                const nickname = memberNicknames[member.user_id] || member.user.name;
                const isEditing = editingUserId === member.user_id;
                const presence: PresenceState = 'ONLINE'; // placeholder — real presence from realtime

                return (
                  <div
                    key={member.user_id}
                    className="grid grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-3 px-3 py-2.5 rounded-md transition-colors hover:bg-[var(--color-surface-hover)]"
                    role="row"
                    aria-label={`${nickname}, ${member.role}`}
                  >
                    {/* Avatar + Name */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={member.user.name} size="sm" presence={presence} />
                      <div className="min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              value={tempNickname}
                              onChange={(e) => setTempNickname(e.target.value)}
                              className="px-2 py-0.5 text-xs rounded-md border outline-none min-w-0"
                              style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface-raised)', color: 'var(--color-text)' }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveNickname(member.user_id)}
                              className="text-xs font-semibold shrink-0 cursor-pointer"
                              style={{ color: 'var(--color-text)' }}
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                              {nickname}
                            </span>
                            <button
                              onClick={() => handleStartEdit(member)}
                              aria-label={`Set personal nickname for ${member.user.name}`}
                              className="p-0.5 cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
                              style={{ color: 'var(--color-text-tertiary)' }}
                            >
                              <Edit3 className="w-3 h-3" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                        <p className="text-[10px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                          {member.user.email}
                        </p>
                      </div>
                    </div>

                    {/* Role badge */}
                    <Badge variant={ROLE_BADGE[member.role] ?? 'neutral'} size="sm">
                      {member.role}
                    </Badge>

                    {/* Presence — text label, not colored dot overload */}
                    <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                      {PRESENCE_LABEL[presence]}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<MessageSquare className="w-3 h-3" />}
                        onClick={() => onStartPrivateChat(member)}
                        aria-label={`Start private chat with ${nickname}`}
                      >
                        Private
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
