import React, { useState } from 'react';
import { Dialog } from '@/design-system/components/Dialog';
import { Button } from '@/design-system/components/Button';
import { Input } from '@/design-system/components/Input';
import { useToast } from '@/design-system/components/Toast';

export interface JoinGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** §15 Group switcher → Join Group. §8.2 share-link invites. */
export function JoinGroupDialog({ open, onOpenChange }: JoinGroupDialogProps) {
  const { toast } = useToast();
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const trimmed = link.trim();
    if (!trimmed) {
      setError('Paste an invite link to join a group.');
      return;
    }
    setLoading(true);
    // Mock join — backend invite verification arrives with the API layer.
    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);
    toast({ title: 'Request sent', description: 'The group owner will confirm your invite.' });
    setLink('');
    setError(null);
    onOpenChange(false);
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
          Invite link
        </label>
        <Input
          id="invite-link"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            if (error) setError(null);
          }}
          placeholder="https://clanmind.io/join/…"
          error={error ?? undefined}
          autoFocus
        />
      </div>
    </Dialog>
  );
}