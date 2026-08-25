import React, { useState } from 'react';
import { Dialog } from '@/design-system/components/Dialog';
import { Button } from '@/design-system/components/Button';
import { Input } from '@/design-system/components/Input';
import { useToast } from '@/design-system/components/Toast';
import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import { useGroupStore } from '@/state/useGroupStore';
import type { Group } from '@/types';

export interface JoinGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * §15 Group switcher → Join Group. §8.2 share-link invites.
 * Accepts a share-link token via URL path or manual paste, then calls
 * POST /api/v1/invites/:token/accept (BE §8.2 handler).
 */
export function JoinGroupDialog({ open, onOpenChange }: JoinGroupDialogProps) {
  const { toast } = useToast();
  const { addGroup, setActiveGroup } = useGroupStore();
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Extract the invite token from a full URL or a bare token string. */
  function extractToken(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    // Full URL: https://clanmind.io/join/<token>
    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split('/').filter(Boolean);
      const joinIdx = segments.indexOf('join');
      if (joinIdx >= 0 && segments[joinIdx + 1]) return segments[joinIdx + 1];
    } catch {
      // not a URL — treat as bare token
    }
    // Bare token (alphanumeric + dashes/underscores)
    if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
    return null;
  }

  const handleJoin = async () => {
    const token = extractToken(link);
    if (!token) {
      setError('Paste a valid invite link or token.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // BE §8.2 — POST /api/v1/invites/:token/accept returns the joined group.
      const res = await api.post<{ group: Group }>(`/invites/${encodeURIComponent(token)}/accept`);
      const group = res.group;
      if (group) {
        addGroup(group);
        setActiveGroup(group);
      }
      toast({
        title: 'Joined group',
        description: group ? `Welcome to ${group.name}.` : 'You are now a member.',
        variant: 'success',
      });
      setLink('');
      setError(null);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVITE_NOT_FOUND' || err.code === 'INVITE_EXPIRED') {
          setError('This invite link is invalid or has expired.');
        } else if (err.code === 'INVITE_MAX_USES') {
          setError('This invite link has reached its usage limit.');
        } else if (err.code === 'ALREADY_MEMBER') {
          setError('You are already a member of this group.');
        } else {
          setError(err.message || 'Could not join the group. Try again.');
        }
      } else {
        setError('Could not join the group. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Join a group"
      description="Paste an invite link shared by a group owner or admin."
      maxWidth="sm"
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={handleJoin} loading={loading}>
            Join group
          </Button>
        </>
      }
    >
      <div className="space-y-1">
        <label htmlFor="invite-link" className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Invite link or token
        </label>
        <Input
          id="invite-link"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            if (error) setError(null);
          }}
          placeholder="https://clanmind.io/join/… or bare token"
          error={error ?? undefined}
          autoFocus
        />
        <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
          Accepting adds you to the group. You can leave anytime from Settings.
        </p>
      </div>
    </Dialog>
  );
}
