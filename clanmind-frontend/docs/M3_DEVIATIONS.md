# M3 Deviations — Exceptions to DO-NOT-TOUCH rules

> Documented per standing rule: exceptions must be explicitly recorded.

## Phase 9 (CONT1)

### 3.6 — Multi-window outbox sync

- **File:** `src/sync/outbox.ts`
- **Rule suspended:** "DO NOT touch `src/sync/`"
- **Reason:** Spec §307 explicitly requires multi-window readiness so two
  windows/tabs sharing the same account IndexedDB queue never double-flight
  the same queued mutation. The fix is minimal — wraps the existing
  `replayPendingOperations` with `BroadcastChannel` + `navigator.locks`
  coordination, no logic change to the queue itself.
- **What changed:** `acquireReplayLock()` gate (BroadcastChannel signalling +
  `navigator.locks.query()` cross-tab check) + `broadcastReplayState('start'/'end')`
  around the replay cycle. `resetOutboxForTesting` also resets `peerReplaying`.
- **Audit ref:** 3.6
