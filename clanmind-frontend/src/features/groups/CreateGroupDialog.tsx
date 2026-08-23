import React, { useState } from 'react';
import { Dialog } from '@/design-system/components/Dialog';
import { Button } from '@/design-system/components/Button';
import { Input } from '@/design-system/components/Input';
import { Textarea } from '@/design-system/components/Textarea';
import { useToast } from '@/design-system/components/Toast';
import { useGroupStore } from '@/state/useGroupStore';
import { useAuthStore } from '@/state/useAuthStore';
import type { Group } from '@/types';

export interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** §15 Group switcher → Create Group. §70 group name + optional description. */
export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const { addGroup, setActiveGroup } = useGroupStore();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give your group a name.');
      return;
    }
    const now = new Date().toISOString();
    const group: Group = {
      id: `grp_${Date.now()}`,
      name: trimmed,
      description: description.trim() || undefined,
      status: 'ACTIVE',
      ai_name: 'Odin',
      ai_proactivity: 'balanced',
      created_at: now,
      updated_at: now,
    };
    addGroup(group);
    setActiveGroup(group);
    // First member is the creator as Owner
    if (user) {
      useGroupStore.getState().addMember({
        user_id: user.id,
        group_id: group.id,
        role: 'OWNER',
        user,
        joined_at: now,
        created_at: now,
        updated_at: now,
      });
    }
    toast({ title: 'Group created', variant: 'success' });
    setName('');
    setDescription('');
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create a group"
      description="Groups are your team container — projects live inside them."
      maxWidth="sm"
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={handleCreate}>
            Create group
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="group-name" className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Group name
          </label>
          <Input
            id="group-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Robotics Team"
            error={error ?? undefined}
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="group-desc" className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Description (optional)
          </label>
          <Textarea
            id="group-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Give it a little context."
            minHeight={64}
            maxHeight={96}
          />
        </div>
      </div>
    </Dialog>
  );
}