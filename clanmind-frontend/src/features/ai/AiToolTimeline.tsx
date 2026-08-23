import React, { useState } from 'react';
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

  if (!toolCalls || toolCalls.length === 0) return null;

  const completedCount = toolCalls.filter((t) => t.status === 'SUCCEEDED').length;
  const isAllDone = completedCount === toolCalls.length;

  const renderStatusIcon = (status: AiToolCallStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-3.5 h-3.5 text-gray-400" />;
      case 'APPROVED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />;
      case 'EXECUTING':
        return <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />;
      case 'SUCCEEDED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'FAILED':
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      case 'DENIED':
        return <XCircle className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  return (
    <div className="my-2 rounded-lg border border-[var(--color-border)] bg-gray-50/70 dark:bg-gray-900/60 overflow-hidden text-xs">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100/60 dark:hover:bg-gray-800/40 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 font-semibold text-[var(--color-text-secondary)] text-[11px]">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
          <span>Odin Tool Activity</span>
          <Badge variant={isAllDone ? 'neutral' : 'warning'} size="sm">
            {completedCount}/{toolCalls.length} Complete
          </Badge>
        </div>
        <span className="text-[10px] text-gray-400">
          {isExpanded ? 'Hide activity' : 'Show details'}
        </span>
      </button>

      {/* Expanded Timeline Items */}
      {isExpanded && (
        <div className="p-3 pt-1 border-t border-gray-200/60 dark:border-gray-800/60 space-y-2 font-mono text-[11px]">
          {toolCalls.map((call) => (
            <div
              key={call.id}
              className="flex items-start justify-between p-2 rounded-md bg-white dark:bg-gray-950 border border-[var(--color-border)]/80"
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="mt-0.5 shrink-0">{renderStatusIcon(call.status)}</span>
                <div>
                  <p className="font-semibold text-[var(--color-text)]">
                    {call.tool_name}
                  </p>
                  {call.input && (
                    <p className="text-[10px] text-gray-500 font-sans truncate max-w-sm">
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
                    className="px-2 py-0.5 rounded text-[10px] font-medium text-gray-500 hover:bg-[var(--color-surface-hover)] cursor-pointer"
                  >
                    Deny
                  </button>
                  <button
                    onClick={() => onApproveTool?.(call.id)}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-900 text-white dark:bg-white dark:text-gray-900 cursor-pointer"
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
