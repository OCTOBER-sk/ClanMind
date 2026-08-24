import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttachmentTray } from '@/features/chat/AttachmentTray';
import type { Attachment } from '@/types';

function chip(overrides: Partial<Attachment>): Attachment {
  return {
    id: `att_${Math.random().toString(36).slice(2)}`,
    file_name: 'requirements.pdf',
    file_size: 640 * 1024,
    mime_type: 'application/pdf',
    sync_state: 'LOCAL_ONLY',
    upload_state: 'selected',
    ...overrides,
  };
}

describe('AttachmentTray — FE §48/§49/§50/§51', () => {
  it('renders icon + filename + size + remove for a selected chip (§48)', () => {
    const onRemove = vi.fn();
    render(
      <AttachmentTray
        attachments={[chip({ upload_state: 'selected' })]}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByText('requirements.pdf')).toBeInTheDocument();
    expect(screen.getByText(/KB · Queued/)).toBeInTheDocument();
    const remove = screen.getByRole('button', { name: /Remove requirements\.pdf/ });
    expect(remove).toBeInTheDocument();
  });

  it('shows §50 progress copy while uploading and offers Cancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <AttachmentTray
        attachments={[chip({ upload_state: 'uploading', upload_progress: 64 })]}
        onRemove={vi.fn()}
        onCancel={onCancel}
      />,
    );
    // `requirements.pdf · 64%`
    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-chip')).toHaveAttribute('data-upload-state', 'uploading');
    await user.click(screen.getByRole('button', { name: /Cancel upload of requirements\.pdf/ }));
    expect(onCancel).toHaveBeenCalledWith(expect.any(String));
  });

  it('shows Uploaded, then "Uploaded · Preparing for Odin…" while indexing (§50/§127)', () => {
    const { rerender } = render(
      <AttachmentTray
        attachments={[chip({ upload_state: 'uploaded', index_state: 'INDEXING' })]}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('Uploaded · Preparing for Odin…')).toBeInTheDocument();

    rerender(
      <AttachmentTray
        attachments={[chip({ upload_state: 'uploaded', index_state: 'READY' })]}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
  });

  it('shows the exact §51 failure copy with Retry and Remove actions', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onRemove = vi.fn();
    render(
      <AttachmentTray
        attachments={[chip({ upload_state: 'failed' })]}
        onRemove={onRemove}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText("Couldn't upload this file.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Retry upload of requirements\.pdf/ }));
    expect(onRetry).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: /^Remove requirements\.pdf$/ }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('shows a small image thumbnail instead of a large card (§49)', () => {
    const { container } = render(
      <AttachmentTray
        attachments={[
          chip({
            mime_type: 'image/png',
            file_name: 'board.png',
            file_url: 'blob:http://localhost/xyz',
          }),
        ]}
        onRemove={vi.fn()}
      />,
    );
    // alt="" keeps decorative thumbnails out of the a11y tree (§7).
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'blob:http://localhost/xyz');
    // Chip-sized, never a large card.
    expect(img!.className).toContain('h-7');
    expect(screen.getByText('board.png')).toBeInTheDocument();
  });

  it('renders nothing when there are no chips', () => {
    render(<AttachmentTray attachments={[]} onRemove={vi.fn()} />);
    expect(screen.queryByTestId('attachment-tray')).not.toBeInTheDocument();
  });
});
