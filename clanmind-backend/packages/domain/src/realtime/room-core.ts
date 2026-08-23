import type { PresenceState, RealtimeEnvelope } from "@clanmind/contracts";

/**
 * Pure realtime-room logic (§15–§17, §96–§97) with no Cloudflare
 * dependencies so it is unit-testable; the Durable Object in
 * apps/worker delegates to this core.
 *
 * The room owns: per-group monotonic sequence (§17.1), a bounded event ring
 * for gap recovery (`sync.from_sequence`, §157 short-window path), protocol
 * gating (§149), and ephemeral presence/typing state (§96). Postgres stays
 * canonical (Correction 2) — the ring is a cache, not the database.
 */

const RING_LIMIT = 500;
const TYPING_TTL_MS = 8000;
const VIEWING_TTL_MS = 30_000;
const OFFLINE_DEBOUNCE_MS = 30_000;

/** §97: transient viewing signal — subject being looked at right now. */
export interface ViewingEntry {
  user_id: string;
  subject_type: string;
  subject_id: string;
  expires_at: number;
}

export type ProtocolGateResult =
  | { ok: true }
  | { ok: false; code: "CLIENT_UPDATE_REQUIRED"; message: string };

/**
 * §149 protocol gating against the CONFIGURED minimum version — never a
 * hard-coded floor, or old clients can never be rejected.
 */
export function gateProtocolVersion(
  clientVersion: number,
  minimumSupported = 1,
): ProtocolGateResult {
  if (!Number.isInteger(clientVersion) || clientVersion < minimumSupported) {
    return {
      ok: false,
      code: "CLIENT_UPDATE_REQUIRED",
      message: "Unsupported protocol version.",
    };
  }
  return { ok: true };
}

export interface PresenceEntry {
  user_id: string;
  state: PresenceState;
  updated_at: number;
}

export class RoomCore {
  private sequence = 0;
  private readonly ring: RealtimeEnvelope[] = [];
  private readonly presence = new Map<string, PresenceEntry>();
  /** Disconnect generation per user: reconnects bump it, cancelling the
   * pending offline debounce (§16 grace period must be race-free). */
  private readonly presenceGeneration = new Map<string, number>();
  private readonly typing = new Map<string, number>();
  private readonly viewing = new Map<string, ViewingEntry>();

  /** §17.1 per-group, strictly increasing sequence numbers. */
  nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  currentSequence(): number {
    return this.sequence;
  }

  hydrate(sequence: number): void {
    this.sequence = Math.max(this.sequence, sequence);
  }

  /** Records a broadcast envelope in the catch-up ring. */
  remember(envelope: RealtimeEnvelope): void {
    this.ring.push(envelope);
    if (this.ring.length > RING_LIMIT) this.ring.splice(0, this.ring.length - RING_LIMIT);
  }

  /**
   * §17.1 gap recovery: events with sequence > from. Returns null when the
   * requested window fell out of the ring — callers then fall back to the
   * Postgres history API (§157). The boundary is derived from the ring's
   * oldest event, not the allocator counter, so it stays correct even if
   * envelopes arrive from an external sequencer.
   */
  eventsSince(fromSequence: number, limit = 100): RealtimeEnvelope[] | null {
    const oldest = this.ring[0]?.sequence ?? this.sequence + 1;
    if (fromSequence + 1 < oldest) return null;
    return this.ring.filter((e) => e.sequence > fromSequence).slice(0, limit);
  }

  // --- §96/§97 presence + typing (ephemeral) ---

  setPresence(userId: string, state: PresenceState, now = Date.now()): PresenceEntry[] {
    if (state === "OFFLINE") {
      this.presence.delete(userId);
      this.typing.delete(userId);
      this.presenceGeneration.set(userId, (this.presenceGeneration.get(userId) ?? 0) + 1);
    } else {
      // Any fresh state (reconnect, heartbeat, explicit update) invalidates a
      // pending offline debounce for this user.
      this.presence.set(userId, { user_id: userId, state, updated_at: now });
      this.presenceGeneration.set(userId, (this.presenceGeneration.get(userId) ?? 0) + 1);
    }
    return this.snapshot();
  }

  /**
   * §16 disconnect: go offline only after the reconnect grace period AND only
   * if the user has not reconnected in the meantime (generation check).
   * Returns the affected userId when an offline transition actually happened
   * — the caller broadcasts it (spec: "broadcast only after debounce").
   */
  scheduleOffline(
    userId: string,
    now: Date,
    setTimeoutFn: (fn: () => void, ms: number) => void,
  ): void {
    const generationAtDisconnect = this.presenceGeneration.get(userId) ?? 0;
    setTimeoutFn(() => {
      const generationNow = this.presenceGeneration.get(userId) ?? 0;
      if (generationNow !== generationAtDisconnect) return; // reconnected meanwhile
      if (!this.presence.has(userId)) return;
      this.presence.delete(userId);
      this.typing.delete(userId);
      this.pendingOffline.push(userId);
    }, OFFLINE_DEBOUNCE_MS);
  }

  /** User ids whose debounced offline fired since the last drain. */
  drainOfflineTransitions(): string[] {
    const drained = [...this.pendingOffline];
    this.pendingOffline = [];
    return drained;
  }

  private pendingOffline: string[] = [];

  /**
   * §96 heartbeat sweep: presence entries not refreshed within maxAgeMs are
   * stale (socket died without close event / DO hibernation). Returns the
   * removed user ids so the caller can broadcast. Called opportunistically —
   * never persisted to Postgres.
   */
  sweepStalePresence(now: number, maxAgeMs: number): string[] {
    const stale: string[] = [];
    for (const [userId, entry] of this.presence) {
      if (now - entry.updated_at > maxAgeMs) {
        this.presence.delete(userId);
        this.typing.delete(userId);
        stale.push(userId);
      }
    }
    return stale;
  }

  snapshot(): PresenceEntry[] {
    return [...this.presence.values()].sort((a, b) => a.user_id.localeCompare(b.user_id));
  }

  typingStart(userId: string, now = Date.now()): void {
    this.typing.set(userId, now + TYPING_TTL_MS);
  }

  typingStop(userId: string): void {
    this.typing.delete(userId);
  }

  /** Typing users whose TTL has not expired. */
  activeTyping(now = Date.now()): string[] {
    const active: string[] = [];
    for (const [userId, expiresAt] of this.typing) {
      if (expiresAt > now) active.push(userId);
      else this.typing.delete(userId);
    }
    return active;
  }

  // --- §97 viewing presence (transient; never persisted as history) ---

  viewingChanged(
    userId: string,
    subjectType: string | null,
    subjectId: string | null,
    now = Date.now(),
  ): ViewingEntry[] {
    if (subjectType === null || subjectId === null) {
      this.viewing.delete(userId);
    } else {
      this.viewing.set(userId, {
        user_id: userId,
        subject_type: subjectType,
        subject_id: subjectId,
        expires_at: now + VIEWING_TTL_MS,
      });
    }
    return this.snapshotViewing(now);
  }

  snapshotViewing(now = Date.now()): ViewingEntry[] {
    const active: ViewingEntry[] = [];
    for (const [userId, entry] of this.viewing) {
      if (entry.expires_at > now) active.push(entry);
      else this.viewing.delete(userId);
    }
    return active;
  }
}
