/**
 * P4 upload controller tests — FE §47–§53 lifecycle against a fake transport
 * speaking the exact BE §43/§102 contracts (same shapes as handlers/
 * attachments.ts). The demo/live transport seam makes the controller fully
 * testable without XHR or network.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  renderHook,
  act,
  waitFor,
  cleanup,
  screen,
} from '@testing-library/react';
import { ToastProvider } from '@/design-system/components/Toast';
import {
  setTransportOverride,
  type Transport,
  type TransportUploadRequest,
} from '@/api/transport';
import { useAttachmentUploads } from './useAttachmentUploads';
import { useChatStore } from '@/state/useChatStore';
import { useGroupStore } from '@/state/useGroupStore';
import { useSyncStore } from '@/state/useSyncStore';
import { ATTACHMENTS_PER_MESSAGE_MAX, ATTACHMENT_MAX_BYTES } from '@/config/limits';
import type { Group, Project } from '@/types';

const group: Group = {
  id: 'grp_test_1',
  name: 'Test Group',
  status: 'ACTIVE',
  ai_name: 'Odin',
  ai_proactivity: 'balanced',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const project: Project = {
  id: 'proj_test_1',
  group_id: group.id,
  name: 'Firmware',
  project_type: 'firmware',
  status: 'active',
  pulse_progress: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/** §43 wire row exactly as the real Worker answers (status SYNCED on insert). */
const row = (id = 'att_server_1') => ({
  id,
  group_id: group.id,
  project_id: project.id,
  owner_user_id: 'user_test',
  object_ref: `groups/${group.id}/objects/${id}/1`,
  object_storage: 'R2',
  mime_type: 'application/pdf',
  byte_size: 640 * 1024,
  checksum: null,
  original_name: 'requirements.pdf',
  status: 'SYNCED',
  created_at: new Date().toISOString(),
  deleted_at: null,
});

type UploadCall = { req: TransportUploadRequest; index: number };

function makeFakeTransport() {
  const uploads: UploadCall[] = [];
  let failMode = false;
  const transport: Transport = {
    async send() {
      return { status: 404, ok: false, json: null };
    },
    async upload(req) {
      uploads.push({ req, index: uploads.length + 1 });
      req.onProgress?.(30);
      req.onProgress?.(64);
      if (failMode) {
        return {
          status: 500,
          ok: false,
          json: { error: { code: 'INTERNAL', message: 'storage down', request_id: 'req_1' } },
        };
      }
      req.onProgress?.(100);
      return { status: 201, ok: true, json: row(`att_server_${uploads.length}`) };
    },
  };
  return {
    transport,
    uploads,
    setFailMode(on: boolean) {
      failMode = on;
    },
  };
}

function makeFile(name = 'requirements.pdf', size = 640 * 1024, type = 'application/pdf'): File {
  // jsdom derives File.size from content; tests need exact sizes without
  // allocating 25 MB buffers, so override the size property directly.
  const file = new File([new Uint8Array(8)], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

async function setup() {
  const fake = makeFakeTransport();
  setTransportOverride(fake.transport);
  useGroupStore.setState({ activeGroup: group, activeProject: project });
  useChatStore.setState({ composerAttachments: [] });
  useSyncStore.getState().setStatus('connected');
  const { result } = renderHook(() => useAttachmentUploads(), {
    wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
  });
  return { fake, controller: result };
}

describe('useAttachmentUploads — §48 chip lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    setTransportOverride(null);
    useGroupStore.setState({ activeGroup: null, activeProject: null });
    useChatStore.setState({ composerAttachments: [] });
    cleanup();
  });

  it('uploads on add: selected → uploading(%) → uploaded with BE §43 server id', async () => {
    const { fake, controller } = await setup();

    act(() => controller.current.addFiles([makeFile()]));
    expect(fake.uploads).toHaveLength(1);
    expect(fake.uploads[0]!.req.path).toBe('/groups/grp_test_1/attachments');
    // Multipart field name mirrors handlers/attachments.ts.
    expect(fake.uploads[0]!.req.form.get('file')).toBeInstanceOf(File);
    expect(fake.uploads[0]!.req.form.get('project_id')).toBe(project.id);

    expect(useChatStore.getState().composerAttachments[0]).toMatchObject({
      upload_state: 'uploading',
      sync_state: 'UPLOADING',
    });

    await waitFor(() => {
      const chipNow = useChatStore.getState().composerAttachments[0];
      expect(chipNow.upload_state).toBe('uploaded');
      expect(chipNow.server_attachment_id).toBe('att_server_1');
      expect(chipNow.sync_state).toBe('SYNCED');
    });
    // Progress ticks landed on the chip (§50 `name · %`).
    expect(useChatStore.getState().composerAttachments[0]!.upload_progress).toBeGreaterThan(0);
  });

  it('marks transfer complete while indexing stays orthogonal (§127/§212)', async () => {
    const { controller } = await setup();
    act(() => controller.current.addFiles([makeFile()]));
    await waitFor(() => {
      expect(useChatStore.getState().composerAttachments[0]?.upload_state).toBe('uploaded');
    });
    // No demo runtime in unit tests → live-truthful INDEXING until BE exposes it.
    expect(useChatStore.getState().composerAttachments[0]!.index_state).toBe('INDEXING');
  });

  it('surfaces failure on the chip (§51) and Retry re-uploads to success', async () => {
    const { fake, controller } = await setup();
    fake.setFailMode(true);

    act(() => controller.current.addFiles([makeFile()]));
    await waitFor(() => {
      expect(useChatStore.getState().composerAttachments[0]?.upload_state).toBe('failed');
    });
    expect(useChatStore.getState().composerAttachments[0]).toMatchObject({
      sync_state: 'LOCAL_ONLY',
      error_message: 'storage down',
    });

    fake.setFailMode(false);
    act(() => controller.current.retryAttachment(useChatStore.getState().composerAttachments[0]!.id));
    await waitFor(() => {
      expect(useChatStore.getState().composerAttachments[0]?.upload_state).toBe('uploaded');
    });
    expect(fake.uploads).toHaveLength(2);
  });

  it('cancel removes the chip and aborts the in-flight request (§50)', async () => {
    const { fake, controller } = await setup();
    act(() => controller.current.addFiles([makeFile()]));
    const chipId = useChatStore.getState().composerAttachments[0]!.id;

    act(() => controller.current.cancelAttachment(chipId));
    expect(useChatStore.getState().composerAttachments).toHaveLength(0);
    expect(fake.uploads[0]!.req.signal?.aborted).toBe(true);
  });

  it('rejects over-size files visibly — never silently dropped (§178/§236)', async () => {
    const { fake, controller } = await setup();
    render(<div aria-label="toast-root" />);
    const tooBig = makeFile('huge.zip', ATTACHMENT_MAX_BYTES + 1, 'application/zip');

    act(() => controller.current.addFiles([tooBig]));

    expect(await screen.findByText("Couldn't add this file.")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB`))).toBeInTheDocument();
    expect(useChatStore.getState().composerAttachments).toHaveLength(0);
    expect(fake.uploads).toHaveLength(0);
  });

  it('enforces the per-message attachment cap (§178)', async () => {
    const { fake, controller } = await setup();
    render(<div aria-label="toast-root" />);

    const full = Array.from({ length: ATTACHMENTS_PER_MESSAGE_MAX }, (_, i) =>
      makeFile(`f${i}.pdf`),
    );
    act(() => controller.current.addFiles(full));
    expect(useChatStore.getState().composerAttachments).toHaveLength(ATTACHMENTS_PER_MESSAGE_MAX);

    act(() => controller.current.addFiles([makeFile('extra.pdf')]));
    expect(await screen.findByText("Couldn't add this file.")).toBeInTheDocument();
    expect(useChatStore.getState().composerAttachments).toHaveLength(ATTACHMENTS_PER_MESSAGE_MAX);
    expect(fake.uploads).toHaveLength(ATTACHMENTS_PER_MESSAGE_MAX);
  });

  it('keeps offline files as selected chips instead of failing (§183/P11)', async () => {
    const { fake, controller } = await setup();
    useSyncStore.getState().setStatus('offline');

    act(() => controller.current.addFiles([makeFile()]));

    expect(useChatStore.getState().composerAttachments[0]).toMatchObject({
      upload_state: 'selected',
      sync_state: 'QUEUED',
    });
    expect(fake.uploads).toHaveLength(0);
    useSyncStore.getState().setStatus('connected');
  });
});
