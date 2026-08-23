import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealtimeClient, type RealtimeSocketLike } from '@/realtime/connection';
import type { ConnectionReadyPayload } from '@/realtime/events';

/**
 * Regression tests for the P0 smoke-T4 WS stall: the handshake deadlocked
 * because hello/room.subscribe were gated on `connected`, and an enveloped
 * `connection.ready` (BE §17 framing) was never recognized.
 */

interface FakeSocketHarness {
  socket: RealtimeSocketLike;
  /** Frames the "server" received from the client. */
  received: string[];
  /** Deliver a raw server frame to the client. */
  serverSend(frame: unknown): void;
  close(): void;
}

function makeFakeSocket(): FakeSocketHarness {
  const received: string[] = [];
  const socket: RealtimeSocketLike = {
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
    send: (data: string) => {
      received.push(data);
    },
    close: () => {
      socket.onclose?.({ code: 1000, reason: 'test close' });
    },
  };
  return {
    socket,
    received,
    serverSend(frame) {
      socket.onmessage?.({ data: JSON.stringify(frame) });
    },
    close() {
      socket.close();
    },
  };
}

function envelope(eventType: string, payload: unknown): unknown {
  return {
    protocol_version: 1,
    event_id: 'evt_test_1',
    event_type: eventType,
    sequence: 1,
    group_id: '',
    actor_id: 'srv',
    visibility: 'GROUP',
    occurred_at: new Date().toISOString(),
    payload,
  };
}

const READY_PAYLOAD: ConnectionReadyPayload = {
  minimum_client_version: '0.0.0',
  recommended_client_version: '0.0.0',
  protocol_version: 1,
};

describe('RealtimeClient handshake (smoke-T4 regression)', () => {
  let harness: FakeSocketHarness;

  function makeClient(): RealtimeClient {
    const client = new RealtimeClient({
      getToken: async () => 'tok',
      onStatus: () => {},
      onEvent: () => {},
      onReady: () => {},
      onProtocolRequired: () => {},
      onSequenceGap: () => {},
    });
    // Inject the fake socket factory path
    (
      client as unknown as { opts: { socketFactory?: (url: string) => RealtimeSocketLike } }
    ).opts.socketFactory = () => harness.socket;
    return client;
  }

  beforeEach(() => {
    harness = makeFakeSocket();
    vi.useFakeTimers();
  });

  it('completes hello→ready when ready arrives as an ENVELOPE (BE §17)', () => {
    const client = makeClient();
    const onReady = vi.fn();
    (client as unknown as { opts: { onReady: typeof onReady } }).opts.onReady = onReady;
    client.connect(['grp_a']);

    harness.socket.onopen?.();
    // hello MUST be sent while still connecting — the old gate dropped it
    expect(harness.received.some((f) => f.includes('connection.hello'))).toBe(true);

    harness.serverSend(envelope('connection.ready', READY_PAYLOAD));

    expect(client.status).toBe('connected');
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ protocol_version: 1 }));
    // room subscription flows right after ready
    expect(harness.received.some((f) => f.includes('room.subscribe'))).toBe(true);
    client.disconnect();
  });

  it('completes the handshake when ready arrives as a PLAIN control frame', () => {
    const client = makeClient();
    client.connect(['grp_a']);
    harness.socket.onopen?.();
    harness.serverSend({ type: 'connection.ready', payload: READY_PAYLOAD });
    expect(client.status).toBe('connected');
    client.disconnect();
  });

  it('app-level send is refused until connected; allowed after', () => {
    const client = makeClient();
    client.connect(['grp_a']);
    harness.socket.onopen?.();
    expect(client.send({ type: 'presence.update', request_id: 'r1' })).toBe(false);
    harness.serverSend(envelope('connection.ready', READY_PAYLOAD));
    expect(client.send({ type: 'presence.update', request_id: 'r2' })).toBe(true);
    expect(harness.received.some((f) => f.includes('presence.update'))).toBe(true);
    client.disconnect();
  });

  it('CLIENT_UPDATE_REQUIRED hard-stops to terminal idle + fires onProtocolRequired (no reconnect loop)', () => {
    const onProtocolRequired = vi.fn();
    const statuses: string[] = [];
    const client = new RealtimeClient({
      getToken: async () => 'tok',
      onStatus: (s) => statuses.push(s),
      onEvent: () => {},
      onReady: () => {},
      onProtocolRequired,
      onSequenceGap: () => {},
    });
    (
      client as unknown as { opts: { socketFactory?: (url: string) => RealtimeSocketLike } }
    ).opts.socketFactory = () => harness.socket;

    client.connect(['grp_a']);
    harness.socket.onopen?.();
    harness.serverSend(
      envelope('error', { code: 'CLIENT_UPDATE_REQUIRED', message: 'Update required' }),
    );

    expect(client.status).toBe('idle');
    expect(statuses[statuses.length - 1]).toBe('idle');
    expect(onProtocolRequired).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CLIENT_UPDATE_REQUIRED' }),
    );
    // No reconnect timer may linger after a protocol stop
    void client;
    vi.advanceTimersByTime(20_000);
    expect(harness.received.filter((f) => f.includes('connection.hello'))).toHaveLength(1);
  });
});
