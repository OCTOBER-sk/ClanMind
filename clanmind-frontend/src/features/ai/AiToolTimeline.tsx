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
import { cn } from '@/design-system/utils';
import { Badge } from '@/design-system/components/Badge';
import type { AiToolCall, AiToolCallStatus } from '@/types';

export interface AiToolTimelineProps {
  aiName?: string;
  toolCalls: AiToolCall[];
  onApproveTool?: (toolCallId: string) => void;
  onDenyTool?: (toolCallId: string) => void;
}

export function AiToolTimeline({
  aiName = 'AI',
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
        return <Clock className="w-3.5 h-3.5" style={{ color: 'var(--md-outline)' }} />;
      case 'APPROVED':
        return <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--md-tertiary)' }} />;
      case 'EXECUTING':
        return <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" style={{ color: 'var(--md-tertiary)' }} />;
      case 'SUCCEEDED':
        return <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--md-success)' }} />;
      case 'FAILED':
        return <AlertCircle className="w-3.5 h-3.5" style={{ color: 'var(--md-error)' }} />;
      case 'DENIED':
        return <XCircle className="w-3.5 h-3.5" style={{ color: 'var(--md-outline)' }} />;
    }
  };

  return (
    <div
      className={cn(
        'my-2 rounded-md border overflow-hidden motion-reduce:transition-none',
        isAllDone && !isExpanded
          ? 'bg-success-container border-transparent'
          : 'bg-surface-container-low border-outline-variant',
      )}
    >
      {/* Collapsible Header — tonal container, state-layer hover */}
      <button
        onClick={() => {
          userToggledRef.current = true;
          setIsExpanded(!isExpanded);
        }}
        aria-expanded={isExpanded}
        aria-label={`${aiName} tool activity — ${completedCount} of ${toolCalls.length} complete`}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer select-none outline-none transition-colors duration-micro ease-emphasized motion-reduce:transition-none focus-visible:shadow-[var(--md-focus-ring)] relative isolate overflow-hidden before:absolute before:inset-0 before:opacity-0 hover:before:opacity-[0.08] active:before:opacity-[0.10] before:transition-opacity before:duration-micro motion-reduce:before:transition-none',
          isAllDone && !isExpanded
            ? 'before:bg-[var(--md-on-success-container)] text-on-success-container'
            : 'before:bg-[var(--md-on-surface)] text-on-surface-variant',
        )}
      >
        <div className="flex items-center gap-2 font-medium text-[11px] tracking-[0.1px]">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
          )}
          <span className={cn(isAllDone && !isExpanded ? 'text-on-success-container' : 'text-on-surface-variant')}>
            {aiName} Tool Activity
          </span>
          <Badge variant={isAllDone ? 'neutral' : 'warning'} size="sm">
            {completedCount}/{toolCalls.length} Complete
          </Badge>
        </div>
        <span className={cn('text-[10px]', isAllDone && !isExpanded ? 'text-on-success-container opacity-80' : 'text-on-surface-variant')}>
          {isExpanded ? 'Hide activity' : 'Show details'}
        </span>
      </button>

      {/* Expanded Timeline Items — rows with state-layer hover */}
      {isExpanded && (
        <div className="p-2.5 pt-1 border-t space-y-1.5 font-mono text-[11px] bg-surface-container border-outline-variant">
          {toolCalls.map((call) => (
            <div
              key={call.id}
              className="flex items-start justify-between p-2 rounded-sm border bg-surface-container-high border-outline-variant relative isolate overflow-hidden before:absolute before:inset-0 before:bg-[var(--md-on-surface)] before:opacity-0 hover:before:opacity-[0.08] active:before:opacity-[0.10] before:transition-opacity before:duration-micro motion-reduce:before:transition-none before:rounded-sm transition-colors duration-micro ease-emphasized motion-reduce:transition-none outline-none focus-within:shadow-[var(--md-focus-ring)]"
            >
              <div className="flex items-start gap-2 min-w-0 relative z-10">
                <span className="mt-0.5 shrink-0">{renderStatusIcon(call.status)}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-on-surface text-xs leading-none font-sans">{call.tool_name}</p>
                  {call.input && (
                    <p className="text-[10px] text-on-surface-variant font-sans truncate max-w-sm mt-0.5">
                      {JSON.stringify(call.input)}
                    </p>
                  )}
                </div>
              </div>

              {/* Approval Gating for HIGH-risk tools (§134A.1, §164A) */}
              {call.status === 'PENDING' && (
                <div className="flex items-center gap-1.5 shrink-0 ml-2 font-sans relative z-10">
                  <button
                    onClick={() => onDenyTool?.(call.id)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-medium cursor-pointer outline-none focus-visible:shadow-[var(--md-focus-ring)] relative isolate overflow-hidden before:absolute before:inset-0 before:bg-current before:opacity-0 hover:before:opacity-[0.08] active:before:opacity-[0.10] before:transition-opacity before:duration-micro motion-reduce:transition-none motion-reduce:before:transition-none transition-colors duration-micro ease-emphasized text-on-surface-variant border border-transparent"
                    aria-label={`Deny ${call.tool_name}`}
                  >
                    Deny
                  </button>
                  <button
                    onClick={() => onApproveTool?.(call.id)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold cursor-pointer outline-none focus-visible:shadow-[var(--md-focus-ring)] bg-primary text-on-primary relative isolate overflow-hidden before:absolute before:inset-0 before:bg-[var(--md-on-primary)] before:opacity-0 hover:before:opacity-[0.08] active:before:opacity-[0.10] before:transition-opacity before:duration-micro motion-reduce:before:transition-none motion-reduce:transition-none transition-colors duration-micro ease-emphasized"
                    aria-label={`Approve ${call.tool_name}`}
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
