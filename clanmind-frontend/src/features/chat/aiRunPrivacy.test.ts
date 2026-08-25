/**
 * Regression guard for FINAL_PREKEY_VERIFICATION blockers 1 & 2 (audit A2/A4).
 *
 * Blocker 1 (A2/B1): the live `/private @Odin` handoff. `spawnAiRun` must
 * carry the composer's privacy scope — `visibility`,
 * `private_conversation_id`, `input_message_id` — to POST /ai/runs using the
 * SERVER-authoritative ids from the message POST response. Before the fix
 * the run start omitted all three, so the backend defaulted the run to GROUP
 * and Odin's answer to a private question was persisted + broadcast
 * Group-visible (orchestrator persistAiMessage / completion broadcast).
 *
 * Blocker 2 FE leg (A4/B2): uploaded chips ride the message POST as
 * `attachment_ids` (§43 row ids) for the §122 transactional
 * `message_attachments` insert. The body contract here is what the Worker
 * zod schema must accept — this test fails if the client ever stops sending
 * it.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChatStore } from '@/state/useChatStore';
import { useArtifactStore } from '@/state/useArtifactStore';
import { useAuthStore } from '@/state/useAuthStore';
import { useGroupStore } from '@/state/useGroupStore';
import { setTransportOverride } from '@/api/transport';
import type { Transport, TransportRequest, TransportResponse } from '@/api/transport';
import { useChatController } from '@/features/chat/useChatController';
import type { Attachment, Group, Message, User } from '@/types';

const ME: User = { id: 'u1', email: 'u@x.io', name: 'Arun', created_at: new Date().toISOString() };
const GROUP: Group = {
  id: 'g1',
  name: 'Flight Controller',
  status: 'ACTIVE',
  ai_name: 'Odin',
  ai_proactivity: 'off',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/** Server §39 row returned by the live POST /messages handler. */
const SERVER_ROW = {
  id: '9f1c3b2a-1111-4222-8333-444455556666',
  group_id: 'g1',
  project_id: null,
  sender_type: 'USER',
  sender_user_id: ME.id,
  sender_ai_id: null,
  visibility: 'PRIVATE_AI',
  private_conversation_id: 'aaabbbaa-0000-4000-8000-00000000aaaa',
  body: 'secret question about the bus map',
  body_format: 'markdown',
  reply_to_id: null,
  client_message_id: 'op_test',
  server_sequence: 12,
  created_at: new Date().toISOString(),
  edited_at: null,
  deleted_at: null,
};

function resetStores(): void {
  useChatStore.setState({
    messages: [],
    typingUsers: [],
    presenceOnlineCount: null,
    composerText: '',
    composerAttachments: [],
    replyTarget: null,
    visibility: 'GROUP',
    pendingMessages: [],
  });
  useArtifactStore.setState({ aiRunsByMessage: {}, artifacts: [], aiRunByArtifact: {} });
}

function primeIdentity(): void {
  useAuthStore.setState({ user: ME, isAuthenticated: true });
  useGroupStore.setState({ activeGroup: GROUP });
}

interface Harness {
  requests: TransportRequest[];
  /** Response the stub serves for POST …/messages. */
  messageResponse: () => TransportResponse;
}

function installTransport(overrides: Partial<Harness> = {}): Harness {
  const harness: Harness = {
    requests: [],
    messageResponse: () => ({ status: 201, ok: true, json: SERVER_ROW }),
    ...overrides,
  };
  const stub: Transport = {
    async send(req) {
      harness.requests.push(req);
      if (req.method === 'POST' && /\/messages$/.test(req.path)) {
        return harness.messageResponse();
      }
      // ai/runs answers without run_id → bindRunId dynamic import never runs.
      return { status: 202, ok: true, json: {} };
    },
  };
  setTransportOverride(stub);
  return harness;
}

afterEach(() => {
  setTransportOverride(null);
});

async function flush(): Promise<void> {
  // Real timers; every hop on this path is a microtask except jsdom's
  // act() bookkeeping — a macrotask tick settles all of them.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('Blocker 1 regression — live AI-run start carries the privacy scope', () => {
  it('/private @Odin: POST /ai/runs mirrors PRIVATE_AI + conversation + input message ids', async () => {
    resetStores();
    primeIdentity();
    const harness = installTransport();

    // §58 — composer scope selected via PrivateRecipientChooser (/private).
    useChatStore.getState().setVisibility('PRIVATE_AI');
    useChatStore.getState().setComposerText('@odin secret question about the bus map');

    const { result } = renderHook(() => useChatController());
    await act(async () => {
      result.current.sendMessage();
    });
    await flush();

    const msgPost = harness.requests.find(
      (r) => r.method === 'POST' && /\/messages$/.test(r.path),
    );
    expect(msgPost).toBeDefined();
    expect(msgPost?.body).toMatchObject({ private_to: 'ai' });

    const runPost = harness.requests.find(
      (r) => r.method === 'POST' && r.path.endsWith('/groups/g1/ai/runs'),
    );
    expect(runPost).toBeDefined();
    // The audit trace: these three fields were previously OMITTED entirely,
    // defaulting the run — and Odin's persisted answer — to GROUP-visible.
    expect(runPost?.body).toMatchObject({
      visibility: 'PRIVATE_AI',
      private_conversation_id: SERVER_ROW.private_conversation_id,
      input_message_id: SERVER_ROW.id,
      message: 'secret question about the bus map',
    });
  });

  it('GROUP sends scope the run explicitly as GROUP with no private linkage', async () => {
    resetStores();
    primeIdentity();
    const harness = installTransport({
      messageResponse: () => ({
        status: 201,
        ok: true,
        json: { ...SERVER_ROW, visibility: 'GROUP', private_conversation_id: null },
      }),
    });

    useChatStore.getState().setComposerText('@odin plan the sprint');

    const { result } = renderHook(() => useChatController());
    await act(async () => {
      result.current.sendMessage();
    });
    await flush();

    const runPost = harness.requests.find(
      (r) => r.method === 'POST' && r.path.endsWith('/groups/g1/ai/runs'),
    );
    expect(runPost).toBeDefined();
    expect(runPost?.body).toMatchObject({ visibility: 'GROUP' });
    const body = runPost?.body as Record<string, unknown>;
    expect(body.private_conversation_id).toBeUndefined();
    // The server message id is legitimate reply linkage for Group runs too
    // (orchestrator persists the answer with reply_to_id = input_message_id).
    expect(body.input_message_id).toBe(SERVER_ROW.id);
  });

  it('a failed message POST still starts the run scoped by visibility — never degraded', async () => {
    resetStores();
    primeIdentity();
    const harness = installTransport({
      messageResponse: () => ({
        status: 400,
        ok: false,
        json: { error: { code: 'VALIDATION_FAILED', message: 'nope' } },
      }),
    });

    useChatStore.getState().setVisibility('PRIVATE_AI');
    useChatStore.getState().setComposerText('@odin will this reach the group?');

    const { result } = renderHook(() => useChatController());
    await act(async () => {
      result.current.sendMessage();
    });
    await flush();

    const runPost = harness.requests.find(
      (r) => r.method === 'POST' && r.path.endsWith('/groups/g1/ai/runs'),
    );
    expect(runPost).toBeDefined();
    const body = runPost?.body as Record<string, unknown>;
    // Privacy scope survives even when the triggering message could not be
    // linked — the run is PRIVATE_AI or it does not happen honestly.
    expect(body.visibility).toBe('PRIVATE_AI');
    expect(body.private_conversation_id).toBeUndefined();
    expect(body.input_message_id).toBeUndefined();
  });

  it('retrying an AI response keeps the original shell privacy scope', async () => {
    resetStores();
    primeIdentity();
    const harness = installTransport();

    const source: Message = {
      id: 'm_old_ai',
      group_id: 'g1',
      sender_type: 'AI',
      sender_id: 'odin_ai',
      sender_name: 'Odin',
      body: 'old completed answer',
      visibility: 'PRIVATE_AI',
      pinned: false,
      edited: false,
      deleted: false,
      attachments: [],
      reactions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    useChatStore.getState().addMessage(source);
    useArtifactStore.getState().setAiRunByMessage('m_old_ai', {
      id: 'run_old',
      group_id: 'g1',
      status: 'COMPLETED',
      mode: 'ASSIST',
      prompt: 'earlier secret prompt',
      tool_calls: [],
      sources: [],
      created_artifacts: [],
      created_at: new Date().toISOString(),
    });

    const { result } = renderHook(() => useChatController());
    await act(async () => {
      result.current.retryAiResponse('m_old_ai');
    });
    await flush();

    const runPost = harness.requests.find(
      (r) => r.method === 'POST' && r.path.endsWith('/groups/g1/ai/runs'),
    );
    expect(runPost).toBeDefined();
    expect(runPost?.body).toMatchObject({
      visibility: 'PRIVATE_AI',
      message: 'earlier secret prompt',
    });
  });
});

describe('Blocker 2 regression (FE leg) — uploaded chips ride the message POST', () => {
  it('delivered POST body carries attachment_ids with BE §43 server row ids', async () => {
    resetStores();
    primeIdentity();
    const harness = installTransport();

    const uploadedChip: Attachment = {
      id: 'chip_1',
      file_name: 'requirements.pdf',
      file_size: 1024,
      mime_type: 'application/pdf',
      sync_state: 'SYNCED',
      upload_state: 'uploaded',
      server_attachment_id: '43aaaaaa-0000-4000-8000-000000000001',
    };
    useChatStore.setState({ composerAttachments: [uploadedChip] });
    useChatStore.getState().setComposerText('see attached');

    const { result } = renderHook(() => useChatController());
    await act(async () => {
      result.current.sendMessage();
    });
    await flush();

    const msgPost = harness.requests.find(
      (r) => r.method === 'POST' && /\/messages$/.test(r.path),
    );
    expect(msgPost).toBeDefined();
    // This exact field is what the §122 transaction links — the Worker zod
    // schema MUST accept it (blocker 2 backend leg covers that side).
    expect(msgPost?.body).toMatchObject({
      attachment_ids: ['43aaaaaa-0000-4000-8000-000000000001'],
    });
  });
});
