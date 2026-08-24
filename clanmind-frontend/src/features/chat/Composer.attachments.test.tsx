/**
 * Composer attachment-entry tests — FE §52 (drag & drop overlay + non-drag
 * alternative), §53 (paste routing), §47 (picker entry) and the send gate
 * that keeps §51 failures / §50 in-flight uploads off sent messages.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Composer } from '@/features/chat/Composer';
import type { Attachment } from '@/types';

function chip(overrides: Partial<Attachment>): Attachment {
  return {
    id: 'att_x',
    file_name: 'requirements.pdf',
    file_size: 1024,
    mime_type: 'application/pdf',
    sync_state: 'LOCAL_ONLY',
    upload_state: 'selected',
    ...overrides,
  };
}

const baseProps = {
  text: '',
  onChangeText: vi.fn(),
  onSend: vi.fn(),
  attachments: [] as Attachment[],
  onAddFiles: vi.fn(),
  onRemoveAttachment: vi.fn(),
  replyTarget: null,
  onClearReplyTarget: vi.fn(),
  visibility: 'GROUP' as const,
  onClearPrivateMode: vi.fn(),
  onSetPrivateMode: vi.fn(),
  members: [],
  aiName: 'Odin',
};

function paste(text: string | null, files: File[] = []) {
  const clipboardData = {
    getData: () => text ?? '',
    files: files as unknown as FileList,
    types: files.length > 0 ? ['Files'] : ['text/plain'],
  };
  fireEvent.paste(screen.getByRole('textbox'), { clipboardData });
}

describe('Composer — §53 paste behavior', () => {
  it('routes pasted image/file to attachments and never auto-sends', () => {
    const onAddFiles = vi.fn();
    const onSend = vi.fn();
    render(<Composer {...baseProps} onAddFiles={onAddFiles} onSend={onSend} />);

    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    paste(null, [file]);

    expect(onAddFiles).toHaveBeenCalledWith([file]);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('keeps pasted text as text — even when it looks like a URL', () => {
    const onChangeText = vi.fn();
    const onAddFiles = vi.fn();
    render(
      <Composer
        {...baseProps}
        text="https://example.com/spec"
        onChangeText={onChangeText}
        onAddFiles={onAddFiles}
      />,
    );

    paste('https://example.com/spec');

    expect(onAddFiles).not.toHaveBeenCalled();
    // The textarea keeps the URL; no send was triggered.
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'https://example.com/spec',
    );
  });
});

describe('Composer — §52 drag & drop overlay', () => {
  it('shows "Drop files to attach" while dragging files over the composer', async () => {
    const user = userEvent.setup({ delay: null });
    const onSend = vi.fn();
    render(<Composer {...baseProps} onSend={onSend} />);
    const composer = screen.getByRole('textbox').closest('div')!;

    // Only file drags arm the overlay.
    fireEvent.dragEnter(composer, { dataTransfer: { types: ['text/plain'] } });
    expect(screen.queryByText('Drop files to attach')).not.toBeInTheDocument();

    fireEvent.dragEnter(composer, { dataTransfer: { types: ['Files'] } });
    expect(await screen.findByText('Drop files to attach')).toBeInTheDocument();

    // Keyboard alternative exists regardless: the Attach files button.
    await user.click(screen.getByRole('button', { name: 'Attach files' }));
    // (native picker opens via hidden input — nothing to assert beyond no-crash)

    fireEvent.drop(composer, { dataTransfer: { types: ['Files'], files: [] } });
    expect(screen.queryByText('Drop files to attach')).not.toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled(); // empty drop sends nothing
  });
});

describe('Composer — send gating on upload state (§48/§50/§51)', () => {
  it('disables send with a hint while an upload is in flight', () => {
    const onSend = vi.fn();
    render(
      <Composer
        {...baseProps}
        text="hello"
        attachments={[chip({ upload_state: 'uploading', upload_progress: 42 })]}
        onSend={onSend}
      />,
    );
    expect(screen.getByTestId('upload-send-hint')).toHaveTextContent('Finishing upload…');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables send with the failure hint until Retry or Remove resolves the chip', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    const props = {
      ...baseProps,
      text: 'hello',
      attachments: [chip({ upload_state: 'failed' as const })],
      onRetryAttachment: onRetry,
    };
    render(<Composer {...props} />);
    expect(screen.getByTestId('failed-upload-hint')).toBeInTheDocument();
    const send = screen.getByRole('button', { name: 'Send message' });
    expect(send).toBeDisabled();

    // §51 — Retry is reachable straight from the chip.
    await user.click(screen.getByRole('button', { name: /Retry upload of requirements\.pdf/ }));
    expect(onRetry).toHaveBeenCalledWith('att_x');
    expect(send).toBeDisabled(); // still failed → gated
  });

  it('enables send once every chip is uploaded', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(
      <Composer
        {...baseProps}
        text="see attached"
        attachments={[
          chip({ upload_state: 'uploaded', index_state: 'READY', sync_state: 'SYNCED' }),
        ]}
        onSend={onSend}
      />,
    );
    const send = screen.getByRole('button', { name: 'Send message' });
    await user.click(send);
    expect(onSend).toHaveBeenCalledOnce();
  });
});
