import React from 'react';
import { AlertCircle, Settings } from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import type { GroupRole } from '@/types';

export interface AiQuotaCardProps {
  canContinueWithByok: boolean;
  userRole: GroupRole;
  onOpenSettings: () => void;
}

/** §141 — branches on can_continue_with_byok; near-invisible when BYOK takes over */
export function AiQuotaCard({
  canContinueWithByok,
  userRole,
  onOpenSettings,
}: AiQuotaCardProps) {
  const isAdminOrOwner = userRole === 'OWNER' || userRole === 'ADMIN';

  if (canContinueWithByok) {
    return (
      <div
        className="my-2 px-3 py-1.5 rounded-lg text-[11px] flex items-center justify-between"
        style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}
      >
        <span className="font-medium">
          Application AI quota reached for this Group. Continuing with your configured provider.
        </span>
        <span
          className="font-mono font-bold shrink-0 ml-2"
          style={{ color: 'var(--color-text-tertiary)' }}
          title="Running via configured BYOK provider"
        >
          Odin · BYOK
        </span>
      </div>
    );
  }

  return (
    <div
      className="my-2 p-4 rounded-lg border text-xs space-y-3"
      style={{
        borderColor: 'var(--color-warning)',
        background: 'var(--color-warning-bg)',
      }}
    >
      <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--color-warning)' }}>
        <AlertCircle className="w-4 h-4" aria-hidden="true" />
        <span>Application AI Quota Reached</span>
      </div>

      <p className="leading-relaxed" style={{ color: 'var(--color-text)' }}>
        {isAdminOrOwner
          ? 'Application AI quota reached. You can configure Bring Your Own Key (BYOK) in AI Settings to continue immediately.'
          : 'Application AI quota reached. An administrator can configure BYOK to continue.'}
      </p>

      {isAdminOrOwner && (
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Settings className="w-3.5 h-3.5" />}
          onClick={onOpenSettings}
        >
          Open AI Settings
        </Button>
      )}
    </div>
  );
}