import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
  Clock,
} from 'lucide-react';
import { Badge } from '@/design-system/components/Badge';
import type { AiToolCall, AiToolCallStatus } from '@/types';

export interface AiToolTimelineProps {
  toolCalls: AiToolCall[];
  onApproveTool?: (toolCallId: string) => void;
  onDenyTool?: (toolCallId: string) => void;
}

export function AiToolTimeline({
  toolCalls,
  onApproveTool,
  onDenyTool,
}: AiToolTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  /** Once the user toggles manually, auto-collapse stands down (§325 #8). */
  const userToggledRef = useRef(false);

  const completedCount = (toolCalls ?? []).filter((t) => t.status === 'SUCCEEDED').length;
  const isAllDone =
    (toolCalls ?? []).length > 0 &&
    completedCount === toolCalls.length &&
    toolCalls.every((t) => t.status !== 'EXECUTING' && t.status !== 'PENDING');

  // §133 — "Collapse automatically after completion": the live activity card
  // folds itself away when the run settles, unless the user took control.
  useEffect(() => {
    if (isAllDone && !userToggledRef.current) setIsExpanded(false);
  }, [isAllDone]);

  if (!toolCalls || toolCalls.length === 0) return null;

  const renderStatusIcon = (status: AiToolCallStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-3.5 h-3.5" style={{ color: 'var(--color-text-tertiary)' }} />;
      case 'APPROVED':
        return <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--color-info)' }} />;
      case 'EXECUTING':
        return <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-warning)' }} />;
      case 'SUCCEEDED':
        return <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />;
      case 'FAILED':
        return <AlertCircle className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />;
      case 'DENIED':
        return <XCircle className="w-3.5 h-3.5" style={{ color: 'var(--color-text-tertiary)' }} />;
    }
  };

  return (
    <div className="my-2 rounded-lg border overflow-hidden text-xs" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}>
      {/* Collapsible Header */}
      <button
        onClick={() => {
          userToggledRef.current = true;
          setIsExpanded(!isExpanded);
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 font-semibold text-[var(--color-text-secondary)] text-[11px]">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" /> : <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />}
          <span>Odin Tool Activity</span>
          <Badge variant={isAllDone ? 'neutral' : 'warning'} size="sm">
            {completedCount}/{toolCalls.length} Complete
          </Badge>
        </div>
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          {isExpanded ? 'Hide activity' : 'Show details'}
        </span>
      </button>

      {/* Expanded Timeline Items */}
      {isExpanded && (
        <div className="p-3 pt-1 border-t space-y-2 font-mono text-[11px]" style={{ borderColor: 'var(--color-border)' }}>
          {toolCalls.map((call) => (
            <div
              key={call.id}
              className="flex items-start justify-between p-2 rounded-md"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="mt-0.5 shrink-0">{renderStatusIcon(call.status)}</span>
                <div>
                  <p className="font-semibold text-[var(--color-text)]">
                    {call.tool_name}
                  </p>
                  {call.input && (
                    <p className="text-[10px] text-[var(--color-text-secondary)] font-sans truncate max-w-sm">
                      {JSON.stringify(call.input)}
                    </p>
                  )}
                </div>
              </div>

              {/* Approval Gating for HIGH-risk tools (§134A.1, §164A) */}
              {call.status === 'PENDING' && (
                <div className="flex items-center gap-1.5 shrink-0 ml-2 font-sans">
                  <button
                    onClick={() => onDenyTool?.(call.id)}
                    className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Deny
                  </button>
                  <button
                    onClick={() => onApproveTool?.(call.id)}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer"
                    style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                  >
                    Approve Tool
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
