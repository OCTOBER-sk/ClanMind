import { Settings, Info } from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import type { GroupRole } from '@/types';

export interface AiQuotaCardProps {
  aiName?: string;
  canContinueWithByok: boolean;
  userRole: GroupRole;
  onOpenSettings: () => void;
}

/** §141 — branches on can_continue_with_byok; near-invisible when BYOK takes over */
export function AiQuotaCard({
  aiName = 'AI',
  canContinueWithByok,
  userRole,
  onOpenSettings,
}: AiQuotaCardProps) {
  const isAdminOrOwner = userRole === 'OWNER' || userRole === 'ADMIN';

  if (canContinueWithByok) {
    return (
      <div
        className="my-2 px-3 py-2 rounded-full border border-outline-variant bg-surface-container-low text-on-surface-variant text-[11px] flex items-center justify-between gap-2 motion-reduce:transition-none"
      >
        <span className="font-medium leading-none">
          Application AI quota reached for this Group. Continuing with your configured provider.
        </span>
        <span
          className="font-mono font-bold shrink-0 ml-2 px-2 py-0.5 rounded-full bg-surface-container-high border border-outline-variant text-on-surface-variant text-[10px] leading-none"
          title="Running via configured BYOK provider"
        >
          {aiName} · BYOK
        </span>
      </div>
    );
  }

  return (
    <div
      className="my-2 p-4 rounded-md border border-outline-variant bg-surface-container-high border-l-[3px] border-l-tertiary space-y-3 text-xs motion-reduce:transition-none overflow-hidden"
      role="alert"
    >
      <div className="flex items-center gap-2 font-semibold text-tertiary">
        <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Application AI Quota Reached</span>
      </div>

      <p className="leading-relaxed text-on-surface-variant">
        {isAdminOrOwner
          ? 'Application AI quota reached. You can configure Bring Your Own Key (BYOK) in AI Settings to continue immediately.'
          : 'Application AI quota reached. An administrator can configure BYOK to continue.'}
      </p>

      {isAdminOrOwner && (
        <Button
          size="sm"
          variant="tonal"
          leftIcon={<Settings className="w-3.5 h-3.5" />}
          onClick={onOpenSettings}
          aria-label="Open AI Settings to configure BYOK"
        >
          Open AI Settings
        </Button>
      )}
    </div>
  );
}
