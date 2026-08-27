import React, { useState } from 'react';
import { Dialog } from '@/design-system/components/Dialog';
import { Button } from '@/design-system/components/Button';
import { Input } from '@/design-system/components/Input';
import { Textarea } from '@/design-system/components/Textarea';
import { useToast } from '@/design-system/components/Toast';
import { useGroupStore } from '@/state/useGroupStore';
import { createGroup } from '@/api/endpoints/groups';

export interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** §15 Group switcher → Create Group. §70 group name + optional description. */
export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const { addGroup, setActiveGroup } = useGroupStore();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give your group a name.');
      return;
    }

    setLoading(true);
    try {
      const group = await createGroup({
        name: trimmed,
        description: description.trim() || undefined,
      });
      addGroup(group);
      setActiveGroup(group);
      toast({ title: 'Group created', variant: 'success' });
      setName('');
      setDescription('');
      setError(null);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Failed to create group',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
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
          <Button size="sm" variant="primary" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating…' : 'Create group'}
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