import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Paperclip,
  Lock,
  X,
  FolderKanban,
  AtSign,
  WifiOff,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Square,
} from 'lucide-react';
import { cn } from '@/design-system/utils';
import { AttachmentTray } from './AttachmentTray';
import {
  MentionPicker,
  type MentionItem,
  type MentionPickerHandle,
} from './MentionPicker';
import { PrivateRecipientChooser, type PrivateRecipientChooserHandle } from './PrivateRecipientChooser';
import {
  SlashCommandPickerWithKeyboard as SlashCommandPicker,
  type SlashCommand,
  type SlashCommandPickerHandle,
} from './SlashCommandPicker';
import { Tooltip } from '@/design-system/components/Tooltip';
import { getCaretLineBox, computePickerPosition } from './caretGeometry';
import type { Attachment, GroupMember, MessageVisibility, ServerFeatureFlags, SyncStateStatus } from '@/types';

export interface ComposerProps {
  text: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  attachments: Attachment[];
  /**
   * §47/§52/§53 — files enter via native picker, drag-drop or paste; the
   * upload controller owns validation, progress and failure (FE §48–51).
   */
  onAddFiles: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  /** §51 — retry a failed chip. */
  onRetryAttachment?: (id: string) => void;
  /** §50 — cancel an in-flight upload. */
  onCancelAttachment?: (id: string) => void;
  replyTarget: { messageId: string; senderName: string; preview: string } | null;
  onClearReplyTarget: () => void;
  visibility: MessageVisibility;
  privateRecipientId?: string | null;
  privateRecipientName?: string | null;
  onClearPrivateMode: () => void;
  /**
   * §55 — choosing a recipient switches scope: Odin → PRIVATE_AI,
   * teammate → PRIVATE_PAIR. The composer owns nothing about authorization.
   */
  onSetPrivateMode: (
    visibility: Extract<MessageVisibility, 'PRIVATE_PAIR' | 'PRIVATE_AI'>,
    recipientId?: string,
    recipientName?: string
  ) => void;
  members: GroupMember[];
  aiName: string;
  activeProjectName?: string;
  isSending?: boolean;
  /**
   * §137 — an AI run is active in this conversation. While true the send
   * control becomes Stop, so cancelling never hides behind hover (§325 #8).
   */
  isAiResponding?: boolean;
  /** §137 — stop the active run; partial content is preserved. */
  onStopAi?: () => void;
  /** §165A.2 — slash commands gated by per-Group flags */
  featureFlags?: Partial<ServerFeatureFlags>;
  /** §183 offline-aware composer */
  syncStatus?: SyncStateStatus;
}

const MENTION_PICKER_WIDTH = 288;
const MENTION_PICKER_HEIGHT = 224;

export function Composer({
  text,
  onChangeText,
  onSend,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  onRetryAttachment,
  onCancelAttachment,
  replyTarget,
  onClearReplyTarget,
  visibility,
  privateRecipientId,
  privateRecipientName,
  onClearPrivateMode,
  onSetPrivateMode,
  members,
  aiName,
  activeProjectName,
  isSending = false,
  isAiResponding = false,
  onStopAi,
  featureFlags = {},
  syncStatus = 'connected',
}: ComposerProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  /** §60 — viewport placement of the mention picker, tracking the caret. */
  const [mentionPlacement, setMentionPlacement] = useState<{ left: number; top: number } | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  /** §55 — a `/private` command is waiting for the recipient choice. */
  const [awaitingRecipient, setAwaitingRecipient] = useState(false);
  /** §52 — drag depth counter so child enter/leave doesn't flicker the overlay. */
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepthRef = useRef(0);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mentionPickerRef = useRef<MentionPickerHandle | null>(null);
  const commandPickerRef = useRef<SlashCommandPickerHandle | null>(null);
  const privateChooserRef = useRef<PrivateRecipientChooserHandle | null>(null);
  /** Last known caret offset in the textarea — anchor for §60 tracking. */
  const caretPosRef = useRef(0);

  const isOffline = syncStatus === 'offline' || syncStatus === 'reconnecting';

  // ─── §58 stale-selection protection ─────────────────────────────────────
  // A private send REQUIRES an intact selection. If the recipient was never
  // chosen, was cleared, or left the Group, sending stays blocked — it can
  // never fall through to a public send by accident.
  const selectedRecipientIsValid =
    visibility === 'PRIVATE_PAIR'
      ? Boolean(privateRecipientId) &&
        members.some((m) => m.user_id === privateRecipientId)
      : visibility === 'PRIVATE_AI';
  const privateSendBlocked = visibility !== 'GROUP' && !selectedRecipientIsValid;

  // §43 Auto-grow: 44–52px min, 220–280px cap
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 46), 240);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 240 ? 'auto' : 'hidden';
  }, [text]);

  // ─── §60 caret tracking ────────────────────────────────────────────────────
  const updateMentionPlacement = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !showMentions) return;
    const lineBox = getCaretLineBox(textarea, caretPosRef.current);
    const placement = computePickerPosition(
      lineBox,
      { width: window.innerWidth, height: window.innerHeight },
      { width: MENTION_PICKER_WIDTH, height: MENTION_PICKER_HEIGHT },
    );
    setMentionPlacement({ left: placement.left, top: placement.top });
  }, [showMentions]);

  // Reposition on resize (§60) and on scroll of any scrollable ancestor —
  // resize is spec-mandated; scroll keeps the picker glued to the caret.
  useEffect(() => {
    if (!showMentions) return;
    const handleResize = () => updateMentionPlacement();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [showMentions, updateMentionPlacement]);

  const trackCaret = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    caretPosRef.current = textarea.selectionStart ?? 0;
  };

  // §45/§58 — send enabled only with content AND an intact private selection.
  // §48/§50/§51 — sending also waits until every chip resolves so uploads are
  // never silently dropped. Offline is the exception: §183 keeps `selected`
  // chips queued WITH their message until replay (P11).
  const hasUploadInFlight = attachments.some((a) =>
    isOffline ? a.upload_state === 'uploading' : a.upload_state === 'uploading' || a.upload_state === 'selected',
  );
  const hasFailedUpload = attachments.some((a) => a.upload_state === 'failed');
  const canSend =
    (text.trim().length > 0 || attachments.length > 0) &&
    !isSending &&
    !privateSendBlocked &&
    !hasUploadInFlight &&
    !hasFailedUpload;

  // §44 / §63: Enter send, Shift+Enter newline; ↑↓ Enter Esc in pickers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    trackCaret();
    if (awaitingRecipient) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        privateChooserRef.current?.selectNext();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        privateChooserRef.current?.selectPrev();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        privateChooserRef.current?.selectCurrent();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAwaitingRecipient(false);
        return;
      }
    }
    if (showMentions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        mentionPickerRef.current?.selectNext();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        mentionPickerRef.current?.selectPrev();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        mentionPickerRef.current?.selectCurrent();
        return;
      }
      if (e.key === 'Escape') {
        setShowMentions(false);
        return;
      }
    }
    if (showCommands) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        commandPickerRef.current?.selectNext();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        commandPickerRef.current?.selectPrev();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commandPickerRef.current?.selectCurrent();
        return;
      }
      if (e.key === 'Escape') {
        setShowCommands(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        onSend();
        setShowMentions(false);
        setShowCommands(false);
      }
    }
  };

  const openMentionsAtCaret = useCallback(() => {
    setShowMentions(true);
    // Placement needs the fresh caret box; measure after this tick's DOM work.
    requestAnimationFrame(updateMentionPlacement);
  }, [updateMentionPlacement]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChangeText(val);

    // §54: '/' at the start of the composer opens the command picker
    if (val.startsWith('/') && !val.includes(' ')) {
      setShowCommands(true);
      setCommandQuery(val.slice(1));
    } else {
      setShowCommands(false);
    }

    // §34: '@' opens the mention picker, anchored to the live caret (§60)
    const cursor = e.target.selectionStart || 0;
    caretPosRef.current = cursor;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt !== -1 && !textBeforeCursor.slice(lastAt).includes(' ')) {
      setShowMentions(true);
      setMentionQuery(textBeforeCursor.slice(lastAt + 1));
      requestAnimationFrame(updateMentionPlacement);
    } else {
      setShowMentions(false);
      setMentionPlacement(null);
    }
  };

  const handleSelectMention = (item: MentionItem) => {
    const cursor = caretPosRef.current || textareaRef.current?.selectionStart || text.length;
    const textBefore = text.slice(0, cursor);
    const lastAt = textBefore.lastIndexOf('@');
    const textAfter = text.slice(cursor);
    onChangeText(text.slice(0, lastAt) + `@${item.name} ` + textAfter);
    setShowMentions(false);
    setMentionPlacement(null);
    // §46: focus stays in composer
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleSelectCommand = (cmd: SlashCommand) => {
    if (cmd.command === '/private') {
      onChangeText('');
      setShowCommands(false);
      // §55 — open the recipient chooser FIRST; the privacy header appears
      // only once a recipient is actually picked. Esc cancels back to GROUP.
      setAwaitingRecipient(true);
      return;
    }
    if (cmd.command === '/odin') {
      onChangeText(`@${aiName} `);
    } else {
      onChangeText(`${cmd.command} `);
    }
    setShowCommands(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleSelectRecipient = (item: { id: string; name: string }) => {
    if (item.id === 'odin_ai') {
      // §57 — Private AI conversation: requester + the Group AI only.
      onSetPrivateMode('PRIVATE_AI', item.id, aiName);
    } else {
      onSetPrivateMode('PRIVATE_PAIR', item.id, item.name);
    }
    setAwaitingRecipient(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const cancelRecipientChoice = useCallback(() => {
    setAwaitingRecipient(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const addFiles = (files: FileList | File[]) => {
    if (files.length === 0) return;
    // §47/§52/§53 — the upload controller (validation, progress, failure)
    // lives in the feature layer; the composer only routes file entry.
    onAddFiles(Array.from(files));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFiles(e.target.files);
    e.target.value = '';
  };

  /** §52 — only real file drags show the overlay; text/URL drags do not. */
  const hasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes('Files');

  const handleDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  // §53: paste — image/copied file → attachment, text and URLs → text.
  // Never auto-sends; the pasted content waits in the composer.
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files.length > 0) {
      e.preventDefault();
      addFiles(e.clipboardData.files);
    }
  };

  const recipientLabel = visibility === 'PRIVATE_AI' ? aiName : privateRecipientName || '';

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative border rounded-xl transition-all shadow-[var(--shadow-sm)] mx-4 mb-4',
        isDragOver
          ? 'border-[var(--color-info)]'
          : visibility !== 'GROUP'
            ? 'border-[var(--color-info)]'
            : 'border-[var(--color-border)] focus-within:border-[var(--color-border-strong)]'
      )}
      style={{
        background: 'var(--color-surface-raised)',
        // §58 — unmistakable privacy state: the whole surface carries it.
        ...(visibility !== 'GROUP'
          ? { boxShadow: '0 0 0 1px var(--color-info), var(--shadow-sm)' }
          : {}),
      }}
    >
      {/* §52 Drag and Drop overlay */}
      {isDragOver && (
        <div
          className="absolute inset-0 z-40 rounded-xl flex items-center justify-center text-sm font-semibold pointer-events-none"
          style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}
        >
          Drop files to attach
        </div>
      )}

      {/* Pickers */}
      {awaitingRecipient && (
        <PrivateRecipientChooser
          ref={privateChooserRef}
          members={members}
          aiName={aiName}
          onSelect={handleSelectRecipient}
          onClose={cancelRecipientChoice}
        />
      )}
      {showMentions && !awaitingRecipient && (
        <MentionPicker
          ref={mentionPickerRef}
          query={mentionQuery}
          members={members}
          aiName={aiName}
          onSelect={handleSelectMention}
          onClose={() => {
            setShowMentions(false);
            setMentionPlacement(null);
          }}
          placement={mentionPlacement}
        />
      )}
      {showCommands && !awaitingRecipient && (
        <SlashCommandPicker
          ref={commandPickerRef}
          query={commandQuery}
          featureFlags={featureFlags}
          onSelect={handleSelectCommand}
          onClose={() => setShowCommands(false)}
        />
      )}

      {/* §59 Reply Preview Header */}
      {replyTarget && (
        <div
          className="flex items-center justify-between px-3 py-1.5 border-b rounded-t-xl text-xs"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <span className="truncate">
            Replying to <span className="font-semibold">{replyTarget.senderName}</span>:{' '}
            <span className="italic">“{replyTarget.preview}”</span>
          </span>
          <button
            onClick={onClearReplyTarget}
            aria-label="Cancel reply"
            className="p-0.5 rounded cursor-pointer hover:opacity-80"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* §55/§58 Private Scoped Mode Header — unmistakable, recipient always
          visible; switching away is explicit. */}
      {visibility !== 'GROUP' && (
        <div
          data-testid="privacy-header"
          role="status"
          className="flex items-center justify-between px-3 py-1.5 border-b rounded-t-xl text-xs font-semibold"
          style={{
            background: 'var(--color-info-bg)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-info)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              🔒 Private with{' '}
              <span data-testid="privacy-recipient" className="underline decoration-dotted">
                {visibility === 'PRIVATE_AI'
                  ? aiName
                  : privateRecipientName || 'Unknown recipient'}
              </span>
              {privateSendBlocked && ' — choose a valid recipient before sending'}
            </span>
          </div>
          <button
            onClick={onClearPrivateMode}
            className="text-[11px] hover:underline cursor-pointer opacity-80 hover:opacity-100 shrink-0 ml-2"
          >
            Switch to Public Group
          </button>
        </div>
      )}

      {/* §48 chips — states, progress, retry/remove (§49–51) */}
      <AttachmentTray
        attachments={attachments}
        onRemove={onRemoveAttachment}
        onRetry={onRetryAttachment}
        onCancel={onCancelAttachment}
      />

      {/* §7/§218: accessible textarea + status live region */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onClick={trackCaret}
        onKeyUp={trackCaret}
        onSelect={trackCaret}
        aria-label={
          visibility === 'GROUP'
            ? 'Message the group'
            : `Private message to ${recipientLabel || 'unselected recipient'}`
        }
        placeholder={
          awaitingRecipient
            ? 'Choose a recipient above…'
            : visibility === 'GROUP'
              ? activeProjectName
                ? `Message #${activeProjectName} or type / for commands, @ for teammates…`
                : 'Message team or type / for commands…'
              : recipientLabel
                ? `Send private message to ${recipientLabel}…`
                : 'Pick a private recipient first (/private)'
        }
        rows={1}
        className="w-full px-3.5 py-3 text-xs bg-transparent outline-none resize-none select-text leading-relaxed"
        style={{ color: 'var(--color-text)' }}
      />

      {/* Bottom Composer Toolbar */}
      <div
        className="flex items-center justify-between px-2.5 py-2 border-t"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            className="hidden"
          />

          {/* §47 Attach files */}
          <Tooltip content="Attach files">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg cursor-pointer hover:bg-[var(--color-surface-hover)]"
              aria-label="Attach files"
            >
              <Paperclip className="w-4 h-4" aria-hidden="true" />
            </button>
          </Tooltip>

          {/* §54 Commands */}
          <Tooltip content="Commands (/)">
            <button
              type="button"
              onClick={() => {
                setShowCommands(true);
                setCommandQuery('');
              }}
              className="p-1.5 rounded-lg cursor-pointer hover:bg-[var(--color-surface-hover)] text-xs font-mono font-bold"
              aria-label="Commands"
            >
              /
            </button>
          </Tooltip>

          {/* §34 Mention — opens at the caret (§60) */}
          <Tooltip content="Mention teammate (@)">
            <button
              type="button"
              onClick={() => {
                setMentionQuery('');
                openMentionsAtCaret();
              }}
              className="p-1.5 rounded-lg cursor-pointer hover:bg-[var(--color-surface-hover)]"
              aria-label="Mention a teammate"
            >
              <AtSign className="w-4 h-4" aria-hidden="true" />
            </button>
          </Tooltip>

          {/* §267 Project Context Chip */}
          <div
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 ml-2 rounded-md text-[10px] font-medium"
            style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}
          >
            <FolderKanban className="w-3 h-3" aria-hidden="true" />
            <span>{activeProjectName ? `Project: ${activeProjectName}` : 'Group chat'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* §48/§50/§51 — why send is waiting on attachment chips */}
          {hasUploadInFlight && (
            <span
              data-testid="upload-send-hint"
              className="inline-flex items-center gap-1 text-[10px] font-medium"
              style={{ color: 'var(--color-info)' }}
            >
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              Finishing upload…
            </span>
          )}
          {!hasUploadInFlight && hasFailedUpload && (
            <span
              data-testid="failed-upload-hint"
              className="inline-flex items-center gap-1 text-[10px] font-medium"
              style={{ color: 'var(--color-danger)' }}
            >
              <AlertCircle className="w-3 h-3" aria-hidden="true" />
              Resolve the failed file first
            </span>
          )}

          {/* §183 offline composer status */}
          {isOffline && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <WifiOff className="w-3 h-3" aria-hidden="true" />
              Queued · Offline
            </span>
          )}
          {syncStatus === 'syncing' && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium"
              style={{ color: 'var(--color-info)' }}
            >
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              Syncing
            </span>
          )}

          {/* §45 Send — becomes §137 Stop while an AI run is active */}
          {isAiResponding && onStopAi ? (
            <button
              type="button"
              onClick={onStopAi}
              aria-label="Stop generating"
              title="Stop generating"
              className={cn(
                'inline-flex items-center justify-center p-2 rounded-lg transition-all select-none cursor-pointer',
                'border bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] active:scale-95'
              )}
              style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text)' }}
            >
              <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!canSend}
              onClick={onSend}
              aria-label="Send message"
              title={
                privateSendBlocked
                  ? 'Choose a valid private recipient before sending'
                  : hasUploadInFlight
                    ? 'Finishing upload…'
                    : hasFailedUpload
                      ? 'Resolve the failed file first'
                      : undefined
              }
              className={cn(
                'inline-flex items-center justify-center p-2 rounded-lg transition-all select-none',
                canSend
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:opacity-90 active:scale-95 cursor-pointer'
                  : 'cursor-not-allowed opacity-40'
              )}
              style={!canSend ? { background: 'var(--color-surface-hover)' } : undefined}
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* §218/§7: composer status live region — aggregate states only */}
      <span className="sr-only" role="status" aria-live="polite">
        {isSending ? 'Sending message' : ''}
        {isAiResponding ? `${aiName} is responding. You can stop generating.` : ''}
        {isOffline ? 'You are offline. Messages will queue.' : ''}
        {privateSendBlocked ? 'Private mode needs a valid recipient. Sending is disabled.' : ''}
        {hasUploadInFlight ? 'Uploading files. Send waits until uploads finish.' : ''}
        {hasFailedUpload ? 'A file failed to upload. Retry or remove it to send.' : ''}
      </span>
    </div>
  );
}
