# ClanMind — FINAL PRE-KEY VERIFICATION

**Date:** 2026-08-25 · **Scope:** full end-to-end code + quality audit of `clanmind-backend` and `clanmind-frontend` against the two authority specifications, immediately before live infrastructure keys are installed.
**Method:** both authority files read in full first; every claim below verified in current code (`HEAD = f4ca09c`) and, for Part C, against the running app (Vite dev server, demo mode). No code was modified.

---

## PART A — E2E LOGIC CONTINUITY

### A1. Send message → validation → membership → transactional insert → outbox → `message.created` → dispatch → cache → render — **CONNECTED**

| Leg | Evidence |
|---|---|
| UI → controller | `clanmind-frontend/src/features/chat/useChatController.ts:161-308` — §241 pipeline: `client_message_id` minted (reused verbatim on retry, :192-197), §58 stale-recipient guard (:184-190), upload-state gates (:170-180), optimistic insert (:242), POST body mirrors backend zod field-for-field (:289-298). |
| Validation + membership | `clanmind-backend/apps/worker/src/handlers/messages.ts:28-43` — `requireMember` → per-user §178 rate limit → zod (`client_message_id`, `body`, `private_to: uuid\|"ai"`). Body cap 8,000 enforced in the service: `packages/domain/src/messages/message.service.ts:98-103` (config-driven via `limits.message_body_max_chars`). |
| §122 transaction | Postgres RPC `create_message_with_mentions` — `supabase/migrations/20260823000101_audit_remediations.sql:242-309`: one atomic function inserts message (+ `group_sequences` §17.1 counter), mention rows, and the `message.created` outbox row; duplicate `(group_id, client_message_id)` returns the original row (§19 idempotency, :277-285). Broadcast is async after persistence (`handlers/messages.ts:100-113` `void services.realtime.publish`) — §122 compliant. |
| Outbox → room | `packages/domain/src/realtime/broadcaster.ts:32-63` (§124 consumer; private rows get audience resolution); DO room `apps/worker/src/realtime/group-room.ts:528-572` — dedupes by `request_id/event_id`, builds full §17 envelope, fans out; private frames only to `audience_user_ids` (:561-570). |
| Socket → dispatch | `clanmind-frontend/src/realtime/connection.ts:248-380` — accepts both room framing and bare envelopes, validates `RealtimeEnvelopeSchema`, sequence-gap detection (:410-420), `CLIENT_UPDATE_REQUIRED` hard stop (:388-395). |
| Cache → render | `realtime/dispatch.ts:333-360` — dedupe against optimistic copy by id **or** `client_message_id`; `normalizeIncomingMessage` validates the full §39 row through `MessageSchema` (`api/schemas.ts:133-147` — has `server_sequence`, `body_format`, `sender_user_id`, passthrough for `sender_ai_id`) and maps via `api/messageRow.ts:18-49` (`reply_to_id→reply_to_message_id`, `deleted_at/edited_at` flags). `MessageRow.tsx` renders body/pending/failed/deleted/reactions/attachments (MessageRow.tsx:111-118, 232, 392-400, 536-560). |

Verdict: the loop UI→DB→broadcast→UI closes with matching field names and shapes in both demo and live modes.

### A2. `/private @Odin` → private conversation → PRIVATE_AI run → context → provider → deltas → completion → settle — **BROKEN AT THE RUN-START HANDOFF (live path)**

Verified correct:
- FE: `/private` → `PrivateRecipientChooser` → `visibility: 'PRIVATE_AI'`; send posts `private_to: "ai"` (`useChatController.ts:287-297`); §58 stale-selection cannot degrade to public.
- BE message leg: `handlers/messages.ts:61-71` — `findOrCreateAi` → `visibility: "PRIVATE_AI"`, conversation-scoped audience `[requester]`. Fan-out and notification respect it (`broadcaster.ts:65-69`, `consumers.ts:44-57,78-95`).
- Context engine: privacy filter runs before ranking on every slice (`packages/domain/src/ai/context-engine.ts:6,106-107`), §55A matrix fully negative-tested (`packages/domain/test/security-matrix.test.ts:66-276`).
- Demo mode: the AI shell message carries `PRIVATE_AI` (`useChatController.ts:72-90`) and the demo hub streams into that shell — private stays private.

**The break (live):** `spawnAiRun`'s REST call sends only `{ message, project_id, mode: 'ASSIST' }` — `useChatController.ts:122-127`. It omits `visibility`, `private_conversation_id`, and `input_message_id`, **which the backend explicitly accepts** (`handlers/ai.ts:16-18`). The run therefore defaults to `visibility: "GROUP"` (`handlers/ai.ts:66`), and the orchestrator persists the final AI response message with `run.visibility` (`packages/domain/src/ai/orchestrator.ts:463-472`) and broadcasts completion with it (:476-483). Consequence against a live backend: a user's private question gets a **Group-visible Odin answer** — a §2.4/§55A privacy crossing created by the client handoff, not by the domain engine. The demo seam masks it because the demo runtime receives `visibility` and never issues the REST call (`useChatController.ts:105-117`).

### A3. HIGH-risk action → approval → hash-bound approve → verified execution → events → initiator notification — **CONNECTED**

- Propose: `handlers/github.ts:117-184` — branch-safety (§139), §140 diff preview, §178 rate cap, `approvals.propose` → `WAITING_APPROVAL` with canonicalized-SHA256 `payload_hash` (`packages/domain/src/approval/approval-engine.ts:56-74,97-122`), full envelope on `github.action.proposed` outbox (:168-182).
- Card: `dispatch.ts:695-716` projects the envelope (sparse stubs ignored); `features/approvals/ApprovalCard.tsx` displays action kind, risk, payload summary, `payload_hash`/`payload_version` (:281, 387-388) and submits **the exact displayed hash+version, never a boolean** (:217; `api/endpoints/github.ts:110-112`). `GitHubActionCard` is a specialization of the same binding (:18-24,137).
- Backend verify: `handlers/github.ts:186-231` — OWNER/ADMIN gate + `approvalBody` requires `displayed_payload_hash/version`; engine re-checks hash+version (`approval-engine.ts:154-163`), HIGH/CRITICAL role gate (:164-170); `beginExecution` re-verifies binding and expires on mutation (:235-263) — the §78A.1 confused-deputy defense, proven by tests (`domain/test/approval-github.test.ts:102-138`, `security-matrix.test.ts:398-413`).
- Honest failure: without App credentials the action stays `APPROVED` with `executed:false, reason:"github_credentials_not_configured"`; with credentials but no executor it fails closed `executor_not_implemented` — never a fabricated success (`handlers/github.ts:206-230`).
- Events → notification: `ai.action.approved/rejected` outbox → `NotificationWorkerConsumer.notifyInitiator` → `AI_ACTION_APPROVAL` to the initiator (`consumers.ts:113-120,178-195`); proposal notifies OWNER/ADMIN reviewers (:100-111).

### A4. Upload attachment → link to message → render chips → offline queue — **BROKEN AT THE MESSAGE-LINK HANDOFF (live path)**

Verified correct:
- Upload: chip lifecycle `features/chat/useAttachmentUploads.ts` — §178 pre-flight rejects with §236 toast (:139-182), XHR progress/cancel/abort (:53-131), §51 failure keeps the chip with Retry/Remove (:112-129), §49 image thumbnails, §127 `INDEXING` after transfer. Backend: `handlers/attachments.ts:16-70` — membership, §81 multipart validation, §178 size/count caps, §84 signed URLs with membership re-check on download (:100-134).
- Offline: `selected` chips ride the queued message when offline (`useChatController.ts:170-180, 247-277`); unsettled/failed uploads block send.
- Render: `MessageRow.tsx:392-400` renders compact chips.

**The break (live):** the composer uploads attachments *before* the message exists, then sends `attachment_ids: [§43 ids]` on the message POST (`useChatController.ts:214-216, 295`). The live Worker's `sendMessageBody` zod (`handlers/messages.ts:11-20`) has **no `attachment_ids` field — unknown keys are silently stripped**, so no `message_attachments` row is ever created on live sends. The backend's own link path (`linkToMessageInGroup` with M3 authorization, `handlers/attachments.ts:48-68`) requires `message_id` on the *upload* form, which a composer cannot know pre-send. Recipients of live messages will render **no attachment chips**. This is honestly documented as gap D16 in `clanmind-frontend/INTEGRATION_NOTES.md:209-231` ("live sends store objects WITHOUT links until the backend accepts `attachment_ids`"); the demo transport implements §122 fully (`mocks/transportRoutes.ts:364-365`). It remains a live-path break.

### A5. Offline mutation → outbox persist → reconnect → replay with same `client_operation_id` → conflict handling — **CONNECTED for the production-reachable surface (`message.create`); generic sync REST is demo-only**

- Enqueue: `useChatController.ts:247-277` — payload mirrors the delivered POST field-for-field; `sync/outbox.ts:114-138` persists to the account-scoped IndexedDB store (`cm_<userId>` → `sync_ops`, §283/§284) with memory fallback.
- Replay trigger: `sync/connectivity.ts:46-60` — genuine transition into `connected` drains the queue; §185 banner states derive from real pending counts.
- Replay: `sync/outbox.ts:249-341` — `message.create` replays through the **real** idempotent POST with the SAME `client_message_id` **and** `Idempotency-Key` header (:265-279); backend dedupes via the `(group_id, client_message_id)` unique + RPC no-conflict path (migration :277-285). Strict FIFO with transient-halt ordering (:322-341, :356-371); REJECTED is terminal-but-visible (:187-200); 409 → `sync_conflicts` row + §186 card (:202-226, :329-331).
- Conflicts: backend task CAS is real — `handlers/intel.ts:311-323` → `project-intelligence.ts:340-351` (`compareAndUpdate` null → `CONFLICT` 409). Resolution writes back through the SAME row (`outbox.ts:405-474`); `client_wins` re-queues the identical `client_operation_id` and refreshes `expected_version` from the server first (:429-459). Store write-back tested (`state/useSyncStore.test.ts:17-24`).
- **Gap (live):** the Worker mounts **no sync routes** (`apps/worker/src/app.ts:105-120` — no sync router; `packages/sync/src/index.ts:1` is a §189 stub). `POST /groups/:id/sync/operations`, `GET .../sync/conflicts`, `POST /sync/conflicts/:id/resolve` exist only in the demo transport (`mocks/transportRoutes.ts:1487,1619,1631`). Harmless today only because `message.create` is the sole production enqueued op type; the FE engine's `task.update` offline path would be marked REJECTED (404) in live mode. Live conflict write-back is absent (documented D25) — the local record is authoritative per the code comment (`outbox.ts:413-421`).

---

## PART B — CODE QUALITY FINDINGS (severity-ranked)

**B1 · HIGH (privacy, live path)** — A2 run-start handoff omits `visibility`/`private_conversation_id` (`useChatController.ts:122-127` vs `handlers/ai.ts:16-18,66`): private AI answers become Group-visible rows against the live backend. Fix is small (pass the fields the schema already accepts) but it must land before keys.

**B2 · HIGH (data integrity, live path)** — A4 `attachment_ids` stripped by Worker zod (`handlers/messages.ts:11-20`): live messages never link attachments. Either accept `attachment_ids` in the message transaction (matches §122's "insert attachment links" clause) or expose a link endpoint; the frontend already sends the right data.

**B3 · HIGH (UI/a11y, verified on running app)** — Design-token drift: `var(--color-primary-fg)` is **undefined** (only `--color-primary-foreground` exists, `src/index.css:88,136`; the alias is `--color-cm-primary-fg`, :28). Commit f4ca09c fixed Button/IconButton/Switch but **nine call sites remain**: `MessageRow.tsx:206` (AI badge label invisible), `Composer.tsx:715` (send icon invisible in primary state), `AppShell.tsx:1138` (skip link text invisible when keyboard-focused — WCAG 2.4.7/1.4.3 failure), `LeftNav.tsx:86` (active nav label invisible), `SettingsView.tsx:268`, `MessageList.tsx:504`, `GarageView.tsx:247`, `DiagramViewer.tsx:398`, `Checkbox.tsx:28`. Computed-style proof in Part C: `color: rgb(249,250,251)` on `background-color: rgb(249,250,251)` (dark) and `rgb(17,24,39)` on `rgb(17,24,39)` (light).

**B4 · MEDIUM** — No live sync routes (A5): §20A push/pull/resolve loop is demo-only; `packages/sync` is an empty §189 stub.

**B5 · LOW** — Rate limiter is a per-isolate in-memory Map (`apps/worker/src/ai/index.ts:44-60`): resets on eviction/deploy, and `buckets.clear()` at 10,000 keys can flush all counters under a burst. §91 is best-effort until DO-backed limiting lands.

**B6 · LOW** — `mapMessageRow` always returns `attachments: []` (`api/messageRow.ts:39`): neither the §39 broadcast payload nor the history page projects attachment rows, so even with B2 fixed, chips require an additional join/hydrate on the read path.

**B7 · LOW** — Mention resolution keys members by `group_display_name ?? ""` (`handlers/messages.ts:49-51`): members with no Group display name can never be @-mentioned, and duplicate display names collide. The FE never sends `mention_tokens`, so server-side extraction is the only path.

**B8 · LOW** — No dedicated unit test for the outbox `replayOne` outcome matrix (applied/parked/halt); covered only indirectly via demo-route tests and store tests.

**B9 · INFO** — Frontend build emits a >500 kB chunk warning (`App-B1K2_YIg.js` 925 kB / 256 kB gzip).

**Error-path honesty (PASS):** 44 empty-catch sites on the FE were sampled (settings provider test → visible `failed` state, `SettingsView.tsx:1150-1160`; invites → honest empty list for non-admins, `useSettingsController.ts:325-330`; flags → documented all-off defaults, `useGroupStore.ts:97-102`; outbox persistence → progressive enhancement with in-session memory queue, `outbox.ts:95-110`). No swallowed user-facing failures found; failures surface states per §181/§225.

**Transaction boundaries (PASS):** §122 implemented as one atomic RPC (message+mentions+outbox, migration :242-309) with broadcast strictly post-commit (`handlers/messages.ts:100`); AI orchestration performs no in-transaction async work (run lifecycle = discrete repo writes; `orchestrator.ts` streams and persists sequentially). Outbox consumers mark failures with `retry_count` increments and leave rows pending (`jobs/outbox-processor.ts:53-60`).

**Type safety (PASS):** zero `any` in backend domain/worker code; one comment-only match in the FE outside mocks/tests. External payloads validated at the boundary (zod on REST + `RealtimeEnvelopeSchema`/row schemas on WS).

**Test honesty (10 spot-checks — all would fail if the code broke):**
1. `security-matrix.test.ts:66-276` — §55A rows against the real ContextEngine filter + `privacyAuthorizes`.
2. `security-matrix.test.ts:398-413` — forged approval refused (no approval row → `CONFLICT`).
3. `approval-github.test.ts:102-114` — stale displayed hash → `ACTION_EXPIRED`.
4. `approval-github.test.ts:117-138` — mutated payload after approval → execution refused + row `EXPIRED`.
5. `worker/test/schema-drift.test.ts` — static cross-check of repo column lists against actual migrations (would have caught the C1 quota-column bug).
6. `ApprovalCard.test.tsx:25-36` — exact hash+version submitted; :60-78 double-submit guard.
7. `privateLeakage.test.tsx:72-120,223-263` — foreign PRIVATE_PAIR/PRIVATE_AI rows never cached or rendered; search corpus excludes private rows.
8. `mocks/p11Routes.test.ts:71-79` — replaying the same `client_operation_id` never duplicates.
9. `useSyncStore.test.ts:17-24` — §186A.4 resolution writes back through the same row.
10. `tokens.a11y.test.ts:85-110` — reduced-motion CSS contract regression guard.
Weakness: several Worker handler tests stub repositories (standard for unit level), and the schema-drift test only covers `ai-runtime.repo.ts` — the B2 zod-stripping class of bug (contract drift between FE body and BE schema) has no cross-side contract test.

---

## PART C — UI/UX QUALITY (running app, demo mode)

Screenshots in `docs/prekey-screenshots/` (1440×900 unless noted; headless Chromium):

| Shot | Surface | Result |
|---|---|---|
| `01_login_1440.png` | Login (dark) | Clean, calm, centered; fields/labels/focus present. **Defect:** "Clan" half of the wordmark nearly invisible on dark background. |
| `02_after_signin_1440.png` | Main chat (dark) | Three-pane shell per §12; header answers "where am I" (Group ▸ Project); context chip, presence count, pinned indicator, AI response with Key Findings, artifact panel with diagram. Calm at rest — no idle spectral animation (live probe: none). **Defects:** active "Chat" nav item renders as an empty white pill (B3); project names collide with progress % ("Flight Controller Firmw78%"); Odin's AI badge shows sparkle only, label invisible (B3). |
| `04_chat_1440_light.png` | Main chat (light) | Same layout, tokens hold; active-nav pill now dark-with-dark-label (B3 in both themes). |
| `09_composer_typed_1440.png` | Composer with text | **Defect:** send button enters primary state = solid white circle, icon invisible (computed white-on-white; B3). |
| `12_skiplink_zoom.png` | Skip link focused | **Defect:** focused skip link = white pill, white text ("Skip to main content" computed `rgb(249,250,251)` on `rgb(249,250,251)`) — keyboard users see nothing (B3, WCAG failure). |
| `13_chat_600.png` | 600 px width | Artifact opens as a full-screen sheet over single-pane chat per §13; composer anchoring preserved. PASS. |
| `07_team_1440.png` | Team roster | Avatars, roles, emails, Private Chat actions, invite button. **Defects:** rainbow OWNER badge overlaps the member name; active "Team" nav = invisible-label pill (B3); member cards stretch very tall (minor). |
| `15_settings_1440.png` | Settings | Two-column §166 architecture with all sections incl. Danger Zone and Sync Diagnostics. **Defects:** active section ("Account") = white pill with invisible label (B3); OWNER badge is a rainbow fill (borderline vs §20 "compact and neutral" / §3.3 spectral restraint). |

State matrices, spectral restraint, motion:
- **Loading/empty/error/offline states** exist per surface in code (composer §208, message §209, AI §134A exact enum mapping `dispatch.ts:383-637`, artifact construction store, sync banner truth table `connectivity.ts:19-35`) and are exercised by the 462-test suite; spot-verified on the running app for chat/settings/team.
- **Spectral restraint:** PASS at rest — probe found no continuously animating spectral element while idle; spectral classes exist only for AI-active/artifact construction (`index.css:354+`), and the §6 reduced-motion block freezes gradients and collapses large motion (`index.css:439-470`), guarded by `tokens.a11y.test.ts`.
- **Focus states:** `--focus-ring` defined for both themes (`index.css:101,146`) and applied via `:focus-visible` (:515-517) — but the skip-link path defeats it via B3.
- **Contrast tokens:** semantic tokens used throughout (no scattered literals found in feature components); the B3 undefined-token bug is the one real contrast failure observed on live screens.

---

## PART D — FULL VERIFICATION OUTPUT (run in this session)

```
cd clanmind-backend
$ pnpm -r typecheck  → exit 0 (all 14 workspace packages)
$ pnpm -r test
  packages/ai-providers  Test Files 1 passed   Tests 5 passed
  packages/contracts     Test Files 1 passed   Tests 7 passed
  packages/shared        Test Files 1 passed   Tests 3 passed
  packages/auth          Test Files 1 passed   Tests 4 passed
  packages/search        Test Files 1 passed   Tests 6 passed
  packages/skills        Test Files 1 passed   Tests 4 passed
  packages/domain        Test Files 25 passed  Tests 209 passed
  apps/worker            Test Files 18 passed  Tests 84 passed
  TOTAL: 322/322 passed                                  ===TEST_EXIT:0===

cd clanmind-frontend
$ pnpm exec tsc -b   → exit 0                                    ===TSC_EXIT:0===
$ pnpm test
  Test Files 55 passed (55)
  Tests     462 passed (462)   (vitest v4.1.11, 97.04s)       EXIT:0
$ pnpm run build
  tsc -b && vite build → ✓ built in 1.20s, exit 0
  Warning: App-B1K2_YIg.js = 925.28 kB (gzip 256 kB) — chunk >500 kB
```

Honesty note: when backend and frontend suites were first launched **concurrently** in this session, the frontend vitest run crashed with zero test output (`[ELIFECYCLE] Test failed.` immediately after `RUN v4.1.11`) — resource contention, not a product failure. Re-run serially it passes 462/462 as reported above. The canonical sequential commands from the task pass clean.

---

## FINAL VERDICT: **NOT READY-FOR-LIVE-KEYS**

The architecture, domain engine, approval integrity, transaction discipline, and test culture are genuinely strong — the §122 atomic RPC, §78A hash-binding, §55A negative-test matrix, and honest error paths all verify. But three defects are live-path user-facing breaks that must land before keys:

**Blockers:**
1. **Private-AI run start drops privacy scope** — pass `visibility`/`private_conversation_id`/`input_message_id` from `spawnAiRun` to `POST /ai/runs` (fields the backend already accepts). Without it, `/private @Odin` answers are Group-visible. (A2/B1)
2. **Attachment links never persist on live sends** — accept `attachment_ids` inside the message transaction (or add a link endpoint + read-path projection). (A4/B2/B6)
3. **`--color-primary-fg` undefined at 9 call sites** — send button icon, focused skip link, AI badge label, active nav/section labels are invisible in both themes (verified by computed style and screenshot). Replace with `--color-primary-foreground` and add a lint/test guard for undefined token references. (B3)

**Should-fix before keys (not blocking demo, blocking polish/trust):**
4. Live sync routes (§20A) still absent — offline replay works only for messages; document or ship the router. (B4/A5)
5. Left-rail project rows: truncated name collides with % badge; Team page OWNER badge overlaps name; login wordmark "Clan" contrast. (Part C)
6. Per-isolate rate limiter; mention resolution for members without Group display names; missing outbox `replayOne` unit test; FE↔BE contract test for request bodies (the B2 class of bug). (B5, B7, B8)

With blockers 1–3 resolved and re-verified (each is a small, well-scoped change), this codebase is READY-FOR-LIVE-KEYS.
