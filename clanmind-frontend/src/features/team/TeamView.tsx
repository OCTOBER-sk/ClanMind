import React, { useState } from 'react';
import { MessageSquare, Edit3, UserPlus } from 'lucide-react';
import { Avatar } from '@/design-system/components/Avatar';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import type { GroupMember } from '@/types';

export interface TeamViewProps {
  members: GroupMember[];
  memberNicknames: Record<string, string>;
  onSetNickname: (userId: string, nickname: string) => void;
  onStartPrivateChat: (member: GroupMember) => void;
  onInviteTeammate: () => void;
}

export function TeamView({
  members,
  memberNicknames,
  onSetNickname,
  onStartPrivateChat,
  onInviteTeammate,
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
    <div className="flex flex-col h-full bg-[var(--color-surface-raised)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Team Roster</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Members of this Group and their designated roles.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<UserPlus className="w-3.5 h-3.5" />}
          onClick={onInviteTeammate}
        >
          Invite Teammate
        </Button>
      </div>

      {/* Member Cards Grid */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => {
          const nickname = memberNicknames[member.user_id] || member.user.name;
          const isEditing = editingUserId === member.user_id;

          return (
            <div
              key={member.user_id}
              className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-2xs space-y-4 text-xs"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={member.user.name} size="lg" presence="ONLINE" />
                  <div>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={tempNickname}
                          onChange={(e) => setTempNickname(e.target.value)}
                          className="px-2 py-0.5 text-xs rounded border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)]"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveNickname(member.user_id)}
                          className="text-xs font-semibold text-blue-600 cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-[var(--color-text)] text-sm">
                          {nickname}
                        </h3>
                        <button
                          onClick={() => handleStartEdit(member)}
                          aria-label={`Set personal nickname for ${member.user.name}`}
                          className="p-0.5 cursor-pointer hover:opacity-80"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          <Edit3 className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-[var(--color-text-tertiary)]">{member.user.email}</p>
                  </div>
                </div>

                <Badge
                  variant={
                    member.role === 'OWNER'
                      ? 'spectral'
                      : member.role === 'ADMIN'
                      ? 'info'
                      : 'neutral'
                  }
                  size="sm"
                >
                  {member.role}
                </Badge>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-[var(--color-border)] flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                  onClick={() => onStartPrivateChat(member)}
                >
                  Private Chat
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
