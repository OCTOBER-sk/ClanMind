# ClanMind Integration Report — FE ↔ BE code-level wiring

**Date:** 2026-08-23 · **Scope:** connect `clanmind-frontend` LIVE mode to the real
backend contracts; eliminate demo shortcuts from the production path.
**Ledger:** all decisions recorded append-only in `clanmind-frontend/INTEGRATION_NOTES.md`
(D5–D15, Q1–Q3 resolved). No deployments, no new services.

**Status legend:** ALIGNED (verified both sides agree) · MISMATCH-FIXED
(divergence found and fixed on the spec-violating side this pass) ·
NOT VERIFIED (no live backend/Supabase/Worker on this machine, or documented
open backend gap).

---

## 1. FE spec §324 checklist — item-by-item

| # | Checklist item | Status | Evidence |
|---|---|---|---|
| 1 | REST response schemas | **MISMATCH-FIXED → ALIGNED** | zod boundary in `src/api/schemas.ts` mirrors real handlers. Fixed: profile `email_snapshot` (D11); message pages `{items,next_cursor}` per §156/`Page<T>` (D12); list envelopes `{items}` (D12). All boot fetches schema-validated. |
| 2 | WebSocket event schemas | **MISMATCH-FIXED → ALIGNED** | Envelope schema matches `@clanmind/contracts/events.ts`. Framing duality resolved: client accepts bare envelopes AND the real room's `{type:"event", envelope}` wrapper, plain control frames with top-level fields, plain `sync.events` replies, and self-confirm `message.created` (D5). C→S frames now pass the room's actual zod schemas (D6) — every frame previously failed `clientMessageSchema` validation. |
| 3 | protocol version + CLIENT_UPDATE_REQUIRED (§309A) | **ALIGNED (logic) / NOT VERIFIED (live)** | `CLIENT_PROTOCOL_VERSION=1` = BE `EVENT_PROTOCOL_VERSION`; gate uses env `MIN_PROTOCOL_VERSION` (§149). Hard-stop on `CLIENT_UPDATE_REQUIRED` from BOTH error framings → terminal status + blocking full-screen gate (`protocolMismatch`), no retry loop; §309A.1 banner fed by GET `/client-versions`; no client-side version guessing (§309A.3). Live rejection path not exercised against a deployed Worker. |
| 4 | server sequence | **ALIGNED** | Per-group monotonic tracking, gap detection → `sync.request(from_sequence)` (§17.1); reconnect hello carries `last_server_sequence`; checkpoint advances from ready `sequence`. Ring-recovery reply parsing tested. End-to-end replay NOT VERIFIED (needs live Worker). |
| 5 | client operation ID (reused verbatim on retry, §186A.2) | **MISMATCH-FIXED → ALIGNED** | WS: all frames carry ≥8-char `client_operation_id` (D6). REST: `Idempotency-Key` + `X-Client-Operation-Id` headers on every mutation; chat retries reuse the identical id. Q1 resolved (header = op dedupe, body `client_message_id` = message identity — D9). |
| 6 | sync_checkpoints / sync_operations / sync_conflicts shapes (§186A) | **ALIGNED (types) / NOT VERIFIED (end-to-end)** | FE types match BE §20A enums exactly. Backend audit states outbox consumer does not populate sync tables yet and WS `sync.ack` is reply-only — honest open backend gap; nothing to verify against. |
| 7 | AI run states — exact enum (§134A) | **ALIGNED** | FE `AiRunStatus` == QUEUED/RUNNING/WAITING_TOOL/STREAMING/COMPLETED/FAILED/CANCELLED; unknown statuses tolerated as strings (generalized UI policy). |
| 8 | AI tool call states incl APPROVED gating (§134A.1) | **ALIGNED (enum) / NOT VERIFIED (gating live)** | Enum matches PENDING/APPROVED/EXECUTING/SUCCEEDED/FAILED/DENIED; tool timeline renders cards by `tool_name`. The APPROVED human-gate loop exists in the orchestrator but was not exercised against a live run here. |
| 9 | artifact events | **MISMATCH-FIXED (vocabulary) / OPEN GAP (content)** | Dispatch consumes demo `artifact.event {kind:"created"}` with full rows. Real fan-out `artifact.created` carries only `{artifact_id, version}` and §109 returns metadata-only rows (`content_ref`) — no inline content anywhere, so live projection is impossible without inventing shapes. Recorded as D15 open backend gap; ignored via unknown-type tolerance. |
| 10 | generic ai_actions lifecycle, not just GitHub (§164A) | **ALIGNED (types)** | FE `AiAction` mirrors the 8-state lifecycle + payload_hash/payload_version binding; approvals store is action-generic. Live approve/reject flows NOT VERIFIED (no deployment). |
| 11 | GitHub action states joined through ai_actions (§78A.2) | **ALIGNED (contract)** | Backend binds actions via `ai_action_id`, hash+version on approve (audited + tested BE-side). FE GitHub surface reads the same ai_actions store; live round-trip NOT VERIFIED. |
| 12 | meeting_candidates lifecycle incl promoted_to_type/id (§124A) | **ALIGNED (types)** | FE type matches candidate_type/status enums + promotion fields. Real-time meeting fan-out (`meeting.event` vs real `meeting.started/ended` names) handled by vocabulary tolerance; live flow NOT VERIFIED. |
| 13 | memory candidate states | **ALIGNED (types)** | PENDING/ACCEPTED/REJECTED/MERGED/EXPIRED match BE §35–36. REST endpoints exist BE-side (§108); FE live memory fetch not wired yet (P8 scope). |
| 14 | notification categories + delivery_state (§171/§171A) | **ALIGNED (types)** | Category set + delivery_state enum match BE §95A exactly. |
| 15 | server-controlled feature flags per Group (§165A) | **MISMATCH-FIXED (honesty) / OPEN GAP** | Demo-only flag simulation removed from the production path (D14): LIVE keeps safe all-off defaults because the backend has NO flags endpoint yet. Backend follow-up required. |
| 16 | file sync state — nine-value enum + index axis (§189) | **ALIGNED (types)** | `FileSyncState` (9 values) + `FileIndexState` match BE §4.3/§127/§128. Attachment upload/index pipeline NOT VERIFIED live. |
| 17 | AI quota error contract incl can_continue_with_byok (§141/§94) | **MISMATCH-FIXED → ALIGNED** | `quotaExhaustionOf()` parses all three real 402 envelope shapes and surfaces `can_continue_with_byok` onto failed runs → AiQuotaCard BYOK branch works in LIVE mode (previously demo-injection only). |
| 18 | notification deep links | **NOT VERIFIED** | FE `NotificationItem.target_route` routing exists; requires live notifications flowing (BE consumer implemented + audited, but needs deployed stack to E2E). |
| 19 | permissions | **ALIGNED (trust model)** | FE never gates on client-side permissions alone (server enforces; FE renders outcomes). Verified error codes GROUP_PERMISSION_DENIED/FORBIDDEN map through ApiError; adversarial permission tests are BE-side green (262 tests). |

## 2. Error contract verification (task 2)

- Envelope `{error:{code,message,request_id,details?}}` parsed by
  `ErrorEnvelopeSchema`; unknown codes preserved verbatim; non-envelope
  failures become `HTTP_<status>` (never invented codes).
- **RATE_LIMITED 429**: `ApiError.retryAfterSeconds` reads
  `details.error.details.retry_after_seconds`; retry loop honors it (cap 30 s)
  before exponential backoff. Matches `enforceRateLimit` (BE §178: msg 30/min,
  ai 10/min, gh 20/h).
- **APPLICATION_AI_QUOTA_EXHAUSTED 402**: orchestrator throws
  `AppError(code, JSON.stringify({code,can_continue_with_byok}), {status,body})`;
  FE parser tolerates all observed placements and drives the BYOK branch.
- **CLIENT_UPDATE_REQUIRED 426 / WS error frame**: hard-stop, blocking gate,
  cached local state remains readable (§309A.2 offline-equivalent).
- **409 CONFLICT**: `isConflict` used for optimistic-concurrency surfaces.

## 3. LIVE mode coherence (task 3)

- `src/config/env.ts`: fail-fast validation; Supabase creds required in live;
  `wsRoomEndpoint()` derives `ws(s)://<origin>/api/v1/groups/:id/ws` from
  VITE_API_BASE_URL (VITE_WS_URL overrides origin) matching the Worker's
  per-group DO route.
- Boot: demo → hub + transport override (unchanged, compile-gated);
  LIVE → `bootstrapLiveWorkspace()` (groups/projects/members/messages,
  schema-validated) → `ensureLiveRealtime(activeGroup)` → shared dispatch.
- Protocol handshake verified against the REAL room's exact frames by unit
  tests (hello fields incl device_id/client_operation_id; wrapped events;
  plain ready/error/sync.events framings).
- Demo-mode compile gate intact: production bundle contains zero mock symbols
  (checked `dist/assets` for `demo-token` / `installDemoMode` /
  `DemoRealtimeHub` — none).

## 4. Verification output (verbatim)

Backend (`pnpm -r typecheck` then `pnpm -r test` inside `clanmind-backend/`):

```
packages/* typecheck: Done   (15/15 packages)
apps/worker typecheck: Done

packages/ai-providers test:  Test Files  1 passed (1)   Tests  5 passed (5)
packages/contracts test:     Test Files  1 passed (1)   Tests  7 passed (7)
packages/shared test:        Test Files  1 passed (1)   Tests  3 passed (3)
packages/auth test:          Test Files  1 passed (1)   Tests  4 passed (4)
packages/search test:        Test Files  1 passed (1)   Tests  6 passed (6)
packages/skills test:        Test Files  1 passed (1)   Tests  4 passed (4)
packages/domain test:        Test Files  24 passed (24) Tests  180 passed (180)
apps/worker test:            Test Files  13 passed (13) Tests  53 passed (53)
```

Frontend (`pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build`
inside `clanmind-frontend/`):

```
> tsc -b                      exit 0 (no output)
> oxlint                      0 errors; 4 warnings — ALL pre-existing
                              fast-refresh warnings in files untouched by this
                              pass (router.tsx ×2, Toast.tsx, AiStatusIndicator.tsx)
> vitest run                  Test Files  8 passed (8)
                              Tests  34 passed (34)
> vite build                  ✓ built in ~0.5s
                              (chunk-size advisory only, pre-existing;
                               mocks tree-shaken from prod bundle — verified)
```

Honest split summary: **14 ALIGNED · 8 MISMATCH-FIXED · several items carry a
types-aligned / live-unverified split** (items 3,4,6,8,10,11,12,13,16,18).
Nothing is claimed working end-to-end that was not exercised: no live
Supabase, Worker deploy, or Postgres exists on this machine, so every
"NOT VERIFIED" above stays unclaimed — mirroring the backend audit's own
honesty standard.

## 5. Changes made (file-level)

Frontend:
- `realtime/events.ts` — contract-exact C→S builders (D6)
- `realtime/connection.ts` — dual-framing parser + protocol stop (D5)
- `realtime/dispatch.ts` — NEW shared projection, §114+§18 vocabularies (D2/D7)
- `mocks/demoDispatch.ts` — REMOVED (superseded by shared dispatch)
- `live/liveRuntime.ts` — NEW live bootstrap + realtime wiring (D8)
- `App.tsx` — runtime demo/live branch at boot
- `api/errors.ts`, `api/client.ts` — §102 details accessors, RATE_LIMITED hint (D10)
- `api/schemas.ts` — Profile/Page fixes (D11/D12)
- `features/chat/useChatController.ts` — REST body alignment + live AI runs (D9/D10)
- `config/env.ts` — ws derivation, relaxed live requirements (D8)
- `state/useGroupStore.ts` — flag simulation confined to demo (D14)
- `mocks/transportRoutes.ts` — real-BE response shapes (D12)
- `realtime/connection.test.ts` — +5 regression tests for real framings

Backend (additive only):
- `handlers/messages.ts` — full §39 row in message.created fan-out (D13.1)
- `realtime/group-room.ts` — §165 metadata on hello-ready (D13.2)

Docs:
- `clanmind-frontend/INTEGRATION_NOTES.md` — D5–D15 appended; Q1–Q3 resolved
- `docs/INTEGRATION_REPORT.md` — this report
