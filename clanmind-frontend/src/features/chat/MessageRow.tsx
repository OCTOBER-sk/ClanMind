import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/design-system/utils';
import { Avatar } from '@/design-system/components/Avatar';
import { MessageActions } from './MessageActions';
import { AiToolTimeline } from '@/features/ai/AiToolTimeline';
import { AiQuotaCard } from '@/features/ai/AiQuotaCard';
import { AiErrorCard, AiStoppedStrip } from '@/features/ai/AiErrorCard';
import { useAiStreamStore } from '@/features/ai/aiStreamStore';
import { Pin, Reply, Check, Copy, Bot, Clock, RotateCcw, Globe, FileText } from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { copyToClipboard } from '@/tauri/bridge';
import { SafeMarkdownLink } from '@/tauri/externalLinks';
import { formatBytes } from '@/config/limits';
import odinAvatar from '@/assets/brand/odin-avatar.png';
import type { Message, AiRun, GroupRole } from '@/types';

export interface MessageRowProps {
  message: Message;
  currentUserId: string;
  isConsecutive?: boolean;
  /** §134A — the AI run driving this message (tool calls, sources, fallback) */
  aiRun?: AiRun;
  /** §129 — the Group's configured AI name */
  aiName?: string;
  /** §134A STREAMING — animated cursor + §218 lifecycle announcements */
  isStreaming?: boolean;
  /** §184/§245 — retry a failed message */
  onRetry?: (messageId: string) => void;
  /** §138/§139 — Retry / Regenerate: start a NEW run, keep the old response */
  onRegenerate?: (messageId: string) => void;
  canModerate?: boolean;
  /** §141 — role drives whether the quota card offers "Open AI settings" */
  userRole?: GroupRole;
  onOpenSettings?: () => void;
  onReply: (message: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
  onEditSave: (messageId: string, newBody: string) => void;
  onDelete: (messageId: string) => void;
  onTogglePin: (messageId: string) => void;
  onCreateTask: (message: Message) => void;
  onCreateDecision: (message: Message) => void;
  onUseAsContext: (message: Message) => void;
  onOpenThread?: (message: Message) => void;
}

function MessageRowInner({
  message,
  currentUserId,
  isConsecutive = false,
  aiRun,
  aiName = 'Odin',
  isStreaming = false,
  onRetry,
  onRegenerate,
  canModerate = false,
  userRole = 'MEMBER',
  onOpenSettings,
  onReply,
  onReact,
  onEditSave,
  onDelete,
  onTogglePin,
  onCreateTask,
  onCreateDecision,
  onUseAsContext,
  onOpenThread,
}: MessageRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.body);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  // §135/§203 — mid-stream text lives in the dedicated stream store; this row
  // subscribes per message id, so a batch re-renders ONLY this bubble. The
  // chat-store body stays empty until the terminal event commits it once.
  const streamedBody = useAiStreamStore((s) => s.bodiesByMessage[message.id]);
  const displayBody =
    isStreaming && typeof streamedBody === 'string' && streamedBody !== ''
      ? streamedBody
      : message.body;

  const isAi = message.sender_type === 'AI';
  const runFailed = aiRun?.status === 'FAILED' || message.is_failed === true;
  const runCancelled = aiRun?.status === 'CANCELLED';

  const handleSaveEdit = () => {
    // §31: save only when text actually changed
    if (editText.trim() && editText !== message.body) {
      onEditSave(message.id, editText.trim());
    }
    setIsEditing(false);
  };

  // §27: code copy must preserve code exactly; key must be stable (no Math.random)
  const handleCopyCode = async (code: string, blockOffset: number) => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopiedCodeIndex(blockOffset);
      setTimeout(() => setCopiedCodeIndex(null), 1800);
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (message.deleted) {
    // §32: soft delete — no empty vertical space
    return (
      <div
        className="group relative flex items-center px-4 py-1.5 text-xs italic pl-14"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        <span className="select-none">This message was deleted.</span>
      </div>
    );
  }

  const failed = message.is_failed;

  return (
    <div
      className={cn(
        'group relative flex gap-3 px-4 py-1.5 transition-colors duration-100',
        !isConsecutive ? 'mt-2 pt-2' : 'mt-0.5',
        message.pinned && 'bg-[var(--color-warning-bg)]/40',
        'hover:bg-[var(--color-surface-hover)]/50 focus-visible:bg-[var(--color-surface-hover)]/50'
      )}
      // §7 keyboard access — the row is the focus entry point that reveals
      // its §25 action toolbar via group-focus-within; without a stop here
      // the toolbar (display:none until hover) was unreachable by keyboard.
      tabIndex={0}
      // §218 — NO aria-live here: streamed tokens must never be announced.
      // Lifecycle announcements come from AiStreamAnnouncer only.
      data-streaming={isStreaming || undefined}
    >
      {/* Action Toolbar on Hover (§25) */}
      {!isEditing && (
        <MessageActions
          message={message}
          currentUserId={currentUserId}
          canModerate={canModerate}
          onReply={onReply}
          onReact={(emoji) => onReact(message.id, emoji)}
          onEdit={() => {
            setEditText(message.body);
            setIsEditing(true);
          }}
          onDelete={() => onDelete(message.id)}
          onTogglePin={() => onTogglePin(message.id)}
          onCreateTask={onCreateTask}
          onCreateDecision={onCreateDecision}
          onUseAsContext={onUseAsContext}
        />
      )}

      {/* Avatar column */}
      <div className="w-8 shrink-0 flex flex-col items-center pt-0.5">
        {!isConsecutive ? (
          <Avatar
            name={message.sender_name}
            src={isAi ? odinAvatar : message.sender_avatar}
            size="md"
            isAi={isAi}
            isAiActive={isAi && isStreaming}
          />
        ) : (
          <span
            className="text-[10px] opacity-0 group-hover:opacity-60 transition-opacity duration-100 select-none pt-1.5 tabular-nums"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {formatTimestamp(message.created_at)}
          </span>
        )}
      </div>

      {/* Message Content column */}
      <div className="flex-1 min-w-0">
        {/* Reply Quote Banner (§59) */}
        {message.reply_to_preview && !isConsecutive && (
          <div
            className="flex items-center gap-1.5 text-[11px] mb-0.5 pl-2 border-l-2"
            style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-strong)' }}
          >
            <Reply className="w-3 h-3 rotate-180 shrink-0 opacity-60" aria-hidden="true" />
            <span className="truncate italic opacity-80">"{message.reply_to_preview}"</span>
          </div>
        )}

        {/* Sender Name & Timestamp Header */}
        {!isConsecutive && (
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-[13px] font-semibold flex items-center gap-1.5 leading-none"
              style={{ color: 'var(--color-text)' }}
            >
              {message.sender_name}
              {isAi && (
                <span
                  className="inline-flex items-center gap-0.5 px-1 py-px rounded text-[10px] font-medium"
                  style={{
                    background: 'var(--color-surface-hover)',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  <Bot className="w-2.5 h-2.5" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
                  AI
                </span>
              )}
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
              {formatTimestamp(message.created_at)}
            </span>
            {message.pinned && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-medium"
                style={{ color: 'var(--color-warning)' }}
              >
                <Pin className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
                Pinned
              </span>
            )}
            {message.edited && (
              <span className="text-[10px] italic" style={{ color: 'var(--color-text-tertiary)' }}>
                (edited)
              </span>
            )}
            {/* §184 pending / §245 failed indicators */}
            {message.is_pending && !failed && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <Clock className="w-2.5 h-2.5 animate-pulse" aria-hidden="true" />
                Sending…
              </span>
            )}
            {failed && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold"
                style={{ color: 'var(--color-danger)' }}
              >
                Not sent
              </span>
            )}
          </div>
        )}

        {/* Message Body or Inline Editor (§31) */}
        {isEditing ? (
          <div className="mt-1 space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveEdit();
                } else if (e.key === 'Escape') {
                  setIsEditing(false);
                }
              }}
              rows={3}
              className="w-full text-[13px] p-2.5 rounded-lg border outline-none select-text leading-relaxed focus:ring-2 focus:ring-[var(--color-info)]/30"
              style={{
                borderColor: 'var(--color-border-strong)',
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text)',
              }}
              autoFocus
              aria-label="Edit message"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="primary" onClick={handleSaveEdit}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <span className="text-[10px] ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
                Esc to cancel · Enter to save
              </span>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'text-[13px] leading-relaxed selectable-text',
              isStreaming && !displayBody && 'odin-working rounded-md px-1.5 py-0.5 -ml-1.5',
              isStreaming && displayBody && 'streaming-cursor'
            )}
            style={{ color: 'var(--color-text)' }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: SafeMarkdownLink,
                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                h1: ({ children }) => (
                  <h1 className="text-base font-bold my-3 leading-tight" style={{ color: 'var(--color-text)' }}>
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-sm font-semibold my-2.5 leading-tight" style={{ color: 'var(--color-text)' }}>
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-[13px] font-semibold my-2 leading-tight" style={{ color: 'var(--color-text)' }}>
                    {children}
                  </h3>
                ),
                ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote
                    className="border-l-2 pl-3 my-2 italic"
                    style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text-secondary)' }}
                  >
                    {children}
                  </blockquote>
                ),
                code: ({ className, children, node, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');
                  const isBlock = match || codeString.includes('\n');
                  if (isBlock) {
                    // §27 stable key: message id + block start offset — no Math.random
                    const blockOffset = node?.position?.start.offset ?? 0;
                    return (
                      <div
                        className="my-2.5 rounded-lg overflow-hidden border font-mono text-[12px] leading-relaxed"
                        style={{
                          borderColor: 'var(--color-border)',
                          background: 'var(--color-surface-raised)',
                        }}
                      >
                        <div
                          className="flex items-center justify-between px-3 py-1.5 border-b"
                          style={{
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-text-tertiary)',
                          }}
                        >
                          <span className="text-[11px] font-medium">{match ? match[1] : 'code'}</span>
                          <button
                            onClick={() => handleCopyCode(codeString, blockOffset)}
                            className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity text-[11px]"
                            aria-label={`Copy ${match ? match[1] : 'code'} block`}
                          >
                            {copiedCodeIndex === blockOffset ? (
                              <>
                                <Check className="w-3 h-3" style={{ color: 'var(--color-success)' }} aria-hidden="true" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" aria-hidden="true" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="p-3 overflow-x-auto">
                          <code>{children}</code>
                        </pre>
                      </div>
                    );
                  }
                  return (
                    <code
                      className="px-1.5 py-0.5 rounded font-mono text-[12px]"
                      style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {displayBody}
            </ReactMarkdown>
          </div>
        )}

        {/* §23/§49 — attachments: compact chips, never huge cards.
            Own uploads keep their local thumbnail URL; received files show
            a typed glyph until the §84 signed-URL viewer lands (P6). */}
        {message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.attachments.map((file) => (
              <span
                key={file.id}
                className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 max-w-[240px] transition-colors hover:bg-[var(--color-surface-hover)]"
                style={{
                  borderColor: 'var(--color-border)',
                  background: 'var(--color-surface)',
                }}
                title={`${file.file_name} · ${formatBytes(file.file_size)}`}
              >
                {file.file_url && file.mime_type.startsWith('image/') ? (
                  <img
                    src={file.file_url}
                    alt=""
                    className="h-5 w-5 rounded object-cover shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <FileText
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    aria-hidden="true"
                  />
                )}
                <span
                  className="truncate text-[11px] font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {file.file_name}
                </span>
                <span
                  className="shrink-0 text-[10px] tabular-nums"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {formatBytes(file.file_size)}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* ── AI metadata (§133, §140, §141, §142, §143) ──
            Tool timeline renders DURING and AFTER the run (§133); terminal
            cards render only once the run has settled. */}
        {isAi && aiRun && (
          <div className="mt-2 space-y-1.5">
            {/* §133 — live tool timeline; collapses after completion */}
            {aiRun.tool_calls && aiRun.tool_calls.length > 0 && (
              <AiToolTimeline toolCalls={aiRun.tool_calls} />
            )}

            {/* §141 quota exhaustion — exact error contract, its own card */}
            {aiRun.status === 'FAILED' && aiRun.error_code === 'APPLICATION_AI_QUOTA_EXHAUSTED' && (
              <AiQuotaCard
                canContinueWithByok={aiRun.can_continue_with_byok ?? false}
                userRole={userRole}
                onOpenSettings={onOpenSettings ?? (() => {})}
              />
            )}

            {/* §137/§134A CANCELLED — partial content preserved above */}
            {runCancelled && !runFailed && (
              <AiStoppedStrip
                aiName={aiName}
                hasPartial={displayBody.length > 0}
                onRetry={onRegenerate ? () => onRegenerate(message.id) : undefined}
              />
            )}

            {/* §140 — provider reason + Retry / Try fallback (non-quota) */}
            {aiRun.status === 'FAILED' &&
              aiRun.error_code !== 'APPLICATION_AI_QUOTA_EXHAUSTED' &&
              onRegenerate && (
                <AiErrorCard
                  aiName={aiName}
                  errorCode={aiRun.error_code}
                  errorMessage={aiRun.error_message}
                  onRetry={() => onRegenerate(message.id)}
                  onTryFallback={() => onRegenerate(message.id)}
                />
              )}
            {/* §139 — completed responses offer Regenerate: new run, previous
                response preserved. Visible, not hover-gated (§325 #8). */}
            {isAi && aiRun.status === 'COMPLETED' && onRegenerate && !isStreaming && (
              <div>
                <Button size="sm" variant="ghost" onClick={() => onRegenerate(message.id)}>
                  <RotateCcw className="w-3 h-3 mr-1" aria-hidden="true" />
                  Regenerate
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
              {aiRun.sources && aiRun.sources.length > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}
                >
                  <Globe className="w-2.5 h-2.5" aria-hidden="true" />
                  Web research · {aiRun.sources.length} sources
                </span>
              )}
              {/* §142 — subtle fallback model indicator from AI response
                  metadata; deliberately calm secondary color, never an alarm */}
              {aiRun.is_fallback && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  title={`Served by fallback model${aiRun.model_used ? ` (${aiRun.model_used})` : ''}`}
                >
                  {aiName} · fallback model
                </span>
              )}
              {aiRun.is_byok && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {aiName} · BYOK
                </span>
              )}
            </div>
          </div>
        )}

        {/* §245 failed message — never discard, keep text, offer Retry */}
        {!isAi && runFailed && onRetry && (
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => onRetry(message.id)}>
              <RotateCcw className="w-3 h-3 mr-1" aria-hidden="true" />
              Retry
            </Button>
            <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Your message is kept — resend when ready.
            </span>
          </div>
        )}

        {/* Reactions Row (§28, §29 — tiny scale/fade, no bounce) */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {message.reactions.map((reaction) => {
              const hasReacted = reaction.user_ids.includes(currentUserId);
              return (
                <button
                  key={reaction.emoji}
                  onClick={() => onReact(message.id, reaction.emoji)}
                  aria-pressed={hasReacted}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] border transition-all duration-100 cursor-pointer select-none',
                    hasReacted
                      ? 'border-[var(--color-info)]/40 font-medium'
                      : 'hover:bg-[var(--color-surface-hover)]'
                  )}
                  style={{
                    borderColor: hasReacted ? 'var(--color-info)' : 'var(--color-border)',
                    color: hasReacted ? 'var(--color-info)' : 'var(--color-text-secondary)',
                    background: hasReacted ? 'var(--color-info-bg)' : 'transparent',
                  }}
                >
                  <span aria-hidden="true">{reaction.emoji}</span>
                  <span className="text-[11px] font-medium tabular-nums">{reaction.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Thread replies button (§30) */}
        {message.thread_count && message.thread_count > 0 ? (
          <button
            onClick={() => onOpenThread?.(message)}
            className="flex items-center gap-1.5 mt-1.5 text-[12px] font-medium cursor-pointer hover:underline transition-colors"
            style={{ color: 'var(--color-info)' }}
          >
            <Reply className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{message.thread_count} {message.thread_count === 1 ? 'reply' : 'replies'}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

// §203: only the active streaming message should re-render on each stream
// batch. Streamed deltas bypass props entirely (stream-store subscription),
// so this comparator keeps every OTHER row inert while one bubble updates.
export const MessageRow = React.memo(
  MessageRowInner,
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.body === next.message.body &&
    prev.message.reactions === next.message.reactions &&
    prev.message.attachments === next.message.attachments &&
    prev.message.pinned === next.message.pinned &&
    prev.message.edited === next.message.edited &&
    prev.message.deleted === next.message.deleted &&
    prev.message.is_pending === next.message.is_pending &&
    prev.message.is_failed === next.message.is_failed &&
    prev.isStreaming === next.isStreaming &&
    prev.isConsecutive === next.isConsecutive &&
    prev.aiName === next.aiName &&
    prev.aiRun?.status === next.aiRun?.status &&
    prev.aiRun?.tool_calls?.length === next.aiRun?.tool_calls?.length &&
    prev.aiRun?.error_code === next.aiRun?.error_code &&
    prev.aiRun?.error_message === next.aiRun?.error_message &&
    prev.aiRun?.is_fallback === next.aiRun?.is_fallback &&
    prev.aiRun?.model_used === next.aiRun?.model_used &&
    prev.aiRun?.sources?.length === next.aiRun?.sources?.length &&
    prev.onRegenerate === next.onRegenerate
);