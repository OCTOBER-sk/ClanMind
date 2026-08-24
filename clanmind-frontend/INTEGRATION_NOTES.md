# Integration Notes — Frontend ↔ Backend ledger

Running log of contract decisions and any divergence between the backend
specification, the real backend implementation (parallel workstream), and the
frontend. Append-only; newest last.

---

## 2026-08-23 — P0 foundations

### D1 — Demo transport instead of MSW
The build bible originally specified MSW for the mock backend. Implemented as an
in-process `Transport` override (`src/api/transport.ts` +
`src/mocks/transportRoutes.ts`) plus a protocol-faithful WS hub
(`src/mocks/wsHub.ts`) instead. Reasons: no service-worker binary to manage in a
Tauri shell, identical behavior inside vitest/jsdom (where SWs are unavailable),
and zero prod-bundle surface (dynamic-import gated by `VITE_DEMO_MODE`). The
contract-first goal is unchanged: handlers implement BE §104–113 shapes with
BE §102 error envelopes.

### D2 — Demo AI runs flow through the REAL socket pipeline
The old `mockAiService.ts` mutated stores directly on timers. Replaced by
`wsHub.startAiRun`, which broadcasts §134A lifecycle events (`ai.status`,
`ai.tool`, `ai.delta`, `ai.completed`) as proper BE §17 envelopes through
`RealtimeClient`, projected into stores by `src/mocks/demoDispatch.ts`. Demo and
live mode therefore share one dispatch pathway; P5 replaces only the hub.

### D3 — Nav section moved from store state to URL
`activeNavSection` removed from `useUiStore`; sections are URL segments
(`/group/:id/:section`, `/group/:id/project/:pid/:section`). Deep links resolve
via `ObjectRedirect` routes. Store selection is synced FROM the route, never the
reverse.

### D4 — Auth session shape (pre-Supabase wiring)
Demo `/auth/login|signup` return `{ access_token, user }`. P1 will replace token
issuance with Supabase Auth sessions client-side while keeping this response
shape for profile hydration via `GET /api/v1/me`.

### Open questions for the backend stream
- Q1: Does `POST /groups/:groupId/messages` accept `client_message_id` in the
  body AND `Idempotency-Key` header, or strictly one of them? Client sends both.
- Q2: Exact payload of WS `connection.ready` beyond BE §165 metadata
  (e.g. presence snapshot?) so demo hub matches byte-for-byte.
- Q3: Confirm `sync.request(from_sequence)` response arrives as `sync.events`
  with `payload.events[]` ordered by sequence.

---

## 2026-08-23 — Integration pass (FE ↔ BE code-level wiring)

Integration engineer session connecting the frontend LIVE path to the real
backend contracts. Verification: backend `pnpm -r typecheck` + `pnpm -r test`
green (15 pkgs / 262 tests); frontend `tsc -b`, `lint`, `test` (34), `build`
all green; production bundle verified mock-free (`demo-token` /
`installDemoMode` absent from `dist/assets`).

### D5 — WS transport framing: the client accepts BOTH server framings
The real GroupRoom wraps broadcast envelopes as `{type:"event", envelope:{…}}`,
sends handshake/error replies as plain `{type:"connection.ready"…}` /
`{type:"error", code, message}` control objects with TOP-LEVEL fields, replies
to `sync.request` with a plain `{type:"sync.events", events:[envelope…]}`, and
confirms the sender's `message.send` with a plain
`{type:"message.created", source:"self", message}`. The demo hub speaks bare
envelopes + enveloped ready/error. Neither framing violates §17/§114 outright,
so per protocol rule "never paper over": `RealtimeClient.handleFrame` now
accepts every frame kind in BOTH framings — unwrap `{type:"event"}`, merge
top-level vs nested `payload` ready fields, hard-stop on `CLIENT_UPDATE_REQUIRED`
from either error framing, route inner envelopes of plain `sync.events` replies,
and normalize the self-confirm into the event stream (fields derived only from
the actual frame). Regression-tested against the exact group-room.ts shapes.

### D6 — C→S builders now mirror `@clanmind/contracts` exactly
Every FE frame previously failed the room's zod validation (no
`client_operation_id`; `device_id` missing; OFFLINE sent by clients;
`through_sequence` instead of `up_to_sequence`). Fixed in `src/realtime/events.ts`:
- all commands carry `client_operation_id` (≥8 chars, §19);
- `connection.hello` carries persistent per-device `device_id` (uuid) and
  optional `last_server_sequence` for reconnect resume;
- `presence.update` restricted to ONLINE|IDLE|AWAY (offline is server-derived,
  BE §16 disconnect debounce);
- `sync.ack` uses `up_to_sequence`;
- `message.send` mirrors `messageSendSchema` (body/project_id/reply_to_id/
  mention_user_ids); private scope stays REST-only (room is group-scoped).

### D7 — Event vocabulary: FE consumes both §114 names and the §18 fan-out set
The real outbox→room broadcaster publishes §18 taxonomy event_types verbatim
(`ai.run.started`, `ai.response.delta/completed/failed`,
`presence.typing.started/stopped`, …), while the demo hub uses the §114
protocol names (`ai.status/tool/delta/completed/failed`, `typing.updated`).
Both are spec-sanctioned sets (§18 domain taxonomy vs §114 WS list); renaming
the backend wholesale would churn 262 green tests without an arbiter ruling.
Decision: `src/realtime/dispatch.ts` (new shared module, replaces
`src/mocks/demoDispatch.ts` per D2) handles both vocabularies with one store
projection each. Mapping recorded:
- `ai.run.started {run_id}` → RUNNING status (needs runId→shell binding from REST start)
- `ai.response.delta {run_id, delta}` ≡ `ai.delta` (run-keyed)
- `ai.response.completed {run_id, message_id}` ≡ `ai.completed` (final text arrives via the persisted AI `message.created`)
- `ai.response.failed {run_id, failure_code}` ≡ `ai.failed`
- `presence.typing.started|stopped {user_id}` ≡ `typing.updated {user_id, typing}`
Unbound live runs buffer their deltas until the REST response binds run_id →
bubble (`bindRunToMessage`), so early streams are never lost.

### D8 — LIVE mode is now wired end-to-end (was entirely unwired)
Previously `initRealtime()` was ONLY called by the demo installer — live mode
had no socket, no dispatch, and no data fetch. New `src/live/liveRuntime.ts`:
- bootstraps stores from the real API (GET `/groups`, `/groups/:id/projects`,
  `/groups/:id/members`, `/groups/:id/messages?limit=50`), all zod-validated;
- connects the per-group Durable-Object room via `wsRoomEndpoint(groupId)`
  (derives `ws(s)://<API origin>/api/v1/groups/:id/ws` from VITE_API_BASE_URL;
  VITE_WS_URL overrides the origin). One room per socket — the active group;
  switching groups re-points via `connectToGroup()`;
- feeds `dispatchRealtimeEvent`, wires `markProtocolUpdateRequired`
  (§309A.2) and a §17.1 gap handler that emits `sync.request`;
- fetches GET `/client-versions` for the §309A.1 recommended-update banner.
`App.tsx` branches demo (hub) vs live (bootstrap + realtime) at runtime;
demo remains behind the compile gate and untouched behaviorally.

### D9 — Messages POST body aligned to handlers/messages.ts (+ Q1 resolved)
FE sent `visibility`/`recipient_id`/`reply_to_message_id`/`attachment_ids`;
the backend schema expects `private_to` ("ai" | teammate uuid, §2.4),
`reply_to_id`, and resolves mention tokens server-side. Controller fixed.
Unknown keys were silently stripped before — reply targets were being LOST.
**Q1 RESOLVED:** both are accepted and serve different layers — the
`Idempotency-Key` header drives operation-level replay dedupe
(middleware/idempotency.ts falls back to `client_operation_id` in the JSON
body), while body `client_message_id` is the message identity inside the §122
RPC. Client keeps sending both (header = op identity, body = message id).

### D10 — Error contract wired end-to-end (BE §102/§94/§178)
- `ApiError.retryAfterSeconds` parses `details.error.details.retry_after_seconds`;
  `api/client` honors it for RATE_LIMITED 429 retries (capped 30s) instead of
  blind backoff.
- `quotaExhaustionOf(err)` extracts APPLICATION_AI_QUOTA_EXHAUSTED +
  `can_continue_with_byok` from ALL three real orchestrator shapes
  (`details.error.details.body`, `.details` itself, JSON-in-message).
- The live AI-start path surfaces quota exhaustion onto the failed shell run
  so MessageRow renders AiQuotaCard with the BYOK branch exactly like demo.
- CLIENT_UPDATE_REQUIRED (REST 426 / WS error frame) reaches the existing
  blocking gate unchanged.

### D11 — Profile schema: `email_snapshot` (BE §23)
GET /me returns `email_snapshot`, not `email`; the old strict FE schema would
have thrown CONTRACT_VIOLATION on every live profile fetch. Schema loosened +
consumer reconciles display_name/email_snapshot.

### D12 — List/pagination envelopes aligned to real BE shapes
Real lists wrap as `{items:[…]}` and message pages as `Page<Message>` =
`{items, next_cursor}` (BE §156). FE `MessagePageSchema` updated from the
invented `{data, next_before}`; demo transport routes rewritten to the real
shapes (groups/projects `{items}`, messages `{items,next_cursor}`, AI start
moved to the canonical POST `/groups/:id/ai/runs` returning 202
`{run_id, response, tool_calls, truncated}`).

### D13 — Backend additive changes (spec-arbitrated)
1. `handlers/messages.ts`: `message.created` publish payload now carries the
   FULL §39 row alongside `preview` — clients must be able to render the
   realtime message after persistence (§105) without a fetch-back; the stub
   payload made live chat rendering impossible.
2. `group-room.ts` hello reply now includes `minimum_client_version` /
   `recommended_client_version` (§165 metadata on EVERY connect, per FE
   §309A's check-on-every-connection requirement).
No other backend behavior changed; worker tests stay green.

### D14 — Feature-flag simulation confined to demo
`useGroupStore.refetchFeatureFlags` faked a 200 ms server response in ALL
modes. The real Worker has no §165A flags endpoint yet, so live mode now keeps
the safe all-off DEFAULT_FLAGS synchronously (§165A: never assume enabled) and
the fake latency exists only under the compile-time demo gate. Open item for
the backend stream: expose per-group feature flags.

### Q2 RESOLVED
`connection.hello` → `{type:"connection.ready", protocol_version, sequence,
minimum_client_version, recommended_client_version}` (plain control frame;
metadata added this pass). After `room.subscribe` → same shape plus a
top-level `presence` snapshot array. No enveloped variant is emitted by the
real room; the demo hub's enveloped form continues to be accepted.

### Q3 RESOLVED — answer differs from the question's assumption
The real room answers `sync.request` with a PLAIN control frame
`{type:"sync.events", from_sequence, events: [§17 envelopes…], fallback?}`
— NOT an enveloped event with `payload.events[]`. Events ARE ordered by
sequence ascending; `fallback:true` + empty `events[]` means the ring window
was exhausted (client should page Postgres history per §157). The client now
delivers each inner envelope directly through its validated pipeline. The
demo hub does not implement sync.request yet (no gap injection in demo).

### D15 — OPEN backend gap: artifact content is unreachable over the wire
`artifact.created` fan-out payloads are stubs (`{artifact_id, version}`) and
every §109 artifacts route returns metadata-only rows — `content_ref` points
into object storage; no endpoint returns inline version content. The FE
artifact viewer consumes inline content (FE §97/§98), so a live artifact
cannot be rendered contract-honestly today. The dispatch therefore ignores
`artifact.created` (unknown-type tolerance) instead of projecting half-filled
rows. Needed from the backend: either inline `content` on version GETs or a
signed-URL surface the client can resolve. Demo mode is unaffected (the hub
emits full §75-style rows).

Related open items observed during this pass (backend stream):
- No §165A feature-flags endpoint exists yet (see D14).
- `task.created` / `decision.proposed` / `github.*` fan-out payloads are
  notify-stubs; live store projections for Tasks/Decisions/GitHub remain
  phase P7/P8 work (vocabulary itself is consumed by the shared dispatch's
  unknown-type tolerance).

---

## 2026-08-24 — P4 uploads & attachments (FE §47–§53; BE §43/§81–84/§127)

### D16 — Attachment wiring: upload is live-ready; message↔attachment LINK has a backend gap
FE now uploads through the REAL Worker contract: `POST
/api/v1/groups/:groupId/attachments` (multipart field `file`, optional
`project_id`), response validated against the exact §43 row
(`AttachmentRowSchema`; worker answers `status:"SYNCED"`). Transport gained an
optional `upload()` capability (XHR — the only browser API with upload
progress) with BE §19 Idempotency-Key + X-Request-Id headers, no timeout, and
abort → `AbortedError`. Demo `transportRoutes.upload()` reproduces the same
route incl. §178 limits with handlers' own VALIDATION_FAILED messages,
§50-style progress ticks, and a deterministic failure injection (filename
starting with `fail`) for E2E per bible P4 exit. §84 sign + download demo
routes exist (`demo.<id>.<expiry>` token stand-in); binary byte-serving lands
with the P6 viewer.

Two contract gaps recorded for the backend stream — nothing papered over:
1. **Linking.** The Worker only inserts `message_attachments` when
   `message_id` rides the UPLOAD form; but a composer cannot know the server
   message id before `POST /messages`. The FE therefore sends
   `attachment_ids: [§43 ids…]` in the message POST body (BE §122 puts link
   inserts inside the message transaction, so this matches the spec's intent).
   Today's Worker zod strips unknown body keys silently → live sends store
   objects WITHOUT links until the backend accepts `attachment_ids` (or offers
   a link endpoint). Demo implements §122 fully (links on message POST).
2. **Index axis.** BE §127 INDEXING/READY/FAILED/STALE/DELETED is not exposed
   by any endpoint/event yet. Live chips therefore hold `index_state:
   INDEXING` after transfer ("Uploaded · Preparing for Odin…", FE §50) and
   never fake READY; demo flips to READY deterministically behind the runtime
   seam. When the backend exposes the axis (event or GET), the chip consumes
   it verbatim.

Client pre-flight limits mirror BE §178 from one config site
(`src/config/limits.ts`: 25 MB/file, 10/message) and exist for UX rejection
only (§236 toast, never silent); the server remains authoritative.

---

## 2026-08-24 — P6 artifacts & Garage (FE §87–§111, §250–§257; BE §44–§46/§74–§75/§109)

### D17 — Artifact content & live-stream contract (extends D15)
1. **Structured content is the render contract.** DIAGRAM-family versions are
   consumed as BE §74 `{nodes[], edges[]}` domain schemas
   (`DiagramContent` in `src/types`). The client owns ALL layout/rendering
   (@xyflow/react); a tolerant legacy adapter converts old mermaid-flavoured
   text rows into the same schema so historical versions stay viewable.
   CHART versions use typed `{chart_type, x_key, series[], data[]}` rows.
2. **BE §75 vocabulary consumed end-to-end.** `dispatch` now projects
   `artifact.created / node.created / node.updated / edge.created /
   render_state.updated / completed` into a dedicated construction store
   (progressive arrival, one-shot edge draw §98/§99, single completion glow
   §100, textual status for reduced motion §219). The legacy demo envelope
   `artifact.event {kind created|updated|version}` keeps working unchanged.
3. **Demo emits full inline rows on the granular events** (`artifact.created`
   metadata + EMPTY content first; `artifact.completed` carries the complete
   version row) — documented parity until the real backend ships an inline-
   content surface. **D15 stands for live mode**: stub `{artifact_id,
   version}` payloads open an honest construction trace and store nothing;
   they never auto-open a panel.
4. **§252 auto-open gate:** creation events resolve their chat bubble via
   explicit `message_id`, else `run_id`→bubble binding, else the legacy
   created_artifacts scan; ONLY run-bound creations with describable content
   auto-open (§251 newest-active), and opening never moves keyboard focus
   (§253).
5. **§109 REST wired both modes:** GET `/projects/:id/artifacts`,
   GET `/artifacts/:id`, POST `/artifacts/:id/restore {version_number}`,
   POST `/artifacts/:id/pin {pinned}`, DELETE (soft). Demo transport answers
   identical shapes over the dataset incl. BE §102 envelopes. Pin/restore go
   through `useArtifactController` with optimistic updates + rollback.
6. **Exports (§254):** Markdown/SVG/PNG/JSON/source are REALLY generated
   client-side per type (diagram SVG from the same deterministic layout used
   on screen; PNG via canvas rasterization). PDF is deliberately NOT offered
   — no honest PDF producer exists client-side and §254 forbids advertising
   unsupported formats.
7. **Presence removed from the artifact header.** The previous hard-coded
   "2 viewing" violated FE §109 (realtime-only presence); it is gone rather
   than faked. Real viewer/editing presence lands when the room exposes it.
8. `PdfViewer.tsx` (visual mockup, G12) was deleted — its only entry point
   was a `.pdf`-title hack in the panel that P6's honest renderer routing
   removed. Real pdf.js viewing remains recorded under G12/P14 scope.

Open items observed during this pass (backend stream):
- Inline version `content` or a signed-URL resolver is still required for
  live-mode artifact rendering (D15/D17.3).
- No artifact comments/presence endpoints exist yet (FE §108/§109 remain
  UI-ready but unwired rather than faked).

---

## 2026-08-24 — P7 approvals & GitHub (FE §156–§165A, §231; BE §107/§113/§140)

### D18 — Endpoint parity: aiConfig + GitHub/approval REST all hit REAL contracts
The P7 surfaces read/write through the same §113 modules used elsewhere, never
hard-coded demo values:

| FE surface | Endpoint (FE §9 module) | BE contract | Demo transport parity |
|---|---|---|---|
| BYOK config read/write | `GET`/`PATCH /groups/:g/ai/config` (`aiConfig.ts`) | §107 ai-config routes (§32 slots) | `transportRoutes` reproduces both shapes incl. §102 envelopes |
| Provider key validation | `POST /groups/:g/ai/providers/validate` | §107 validate | demo route mirrors response shape (validate → config + models) |
| Provider model refresh | `POST /groups/:g/ai/providers/:id/models` | §107 models re-discover | demo route mirrors (no key sent) |
| GitHub status | `GET /groups/:g/github/status` → `{connected, connection}` | §76.2 (one Group = one repo) | demo handler derives from dataset (connected = connection && !disconnected_at && installation_id) |
| GitHub connect | `POST /groups/:g/github/connect` | §160 App-installation body (201 → connection row) | demo handler persists to dataset + broadcasts `github.connected` |
| GitHub disconnect | `POST /groups/:g/github/disconnect` → `{ok}` | §231 (history rows kept server-side) | demo marks `disconnected_at`, nulls `installation_id` |
| GitHub actions list | `GET /projects/:p/github/actions` → `{items}` | §78 join (status/risk via `ai_actions`) | demo returns joined rows with §78A.2 payload/hash NOT echoed |
| GitHub action propose | `POST /projects/:p/github/actions` → 202 | §78 create_branch/apply_patch/create_pr | demo validates connected+installation, broadcasts `github.action.proposed` |
| Approve / Reject | `POST /github/actions/:id/approve\|reject` | §164A.2/§164A.3 | demo answers `{executed, reason?, action}` / `{ok}` |

### D19 — Approval bindings follow §164A.2 exactly (hash+version, never a boolean)
`approveGithubAction(actionId, payloadHash, payloadVersion)` posts
`displayed_payload_hash` + `displayed_payload_version` — the payload the human
SAW, not an `approved: true`. An `ACTION_EXPIRED` answer means the payload
changed since render; the caller must surface re-review (§164A.4) and never
silently retry with the stale hash. Reject is terminal (§164A.3). `ApprovalCard`
(§163/§164A) is reused by `GitHubPanel` with the generic approve/reject/review
handlers; the diff viewer opens via `onViewDiff` (no fetch-back).

### D20 — Demo-only surfaces (never shipped in live mode)
- **Inline line hunks (`payload.file_diffs`)** — a demo-only extension. The real
  backend ships per-file `changed_files` stats only (§140 `buildDiffPreview`
  shape); there is NO line-hunk endpoint. `GitHubDiffViewer` therefore renders
  line hunks when present and otherwise shows the honest "Line-level changes not
  available for this file — stats above are authoritative." state instead of
  inventing content. The `file_diffs` fixture lives only in `mocks/dataset.ts`.
- **§165A feature flags** — no backend flags endpoint exists yet (D14). Live
  mode keeps the safe all-off `DEFAULT_FLAGS` (§165A: never assume enabled),
  so `github_write`/`github_merge` default ON is a DEMO dataset choice only;
  live defaults to the conservative flags from the store. The flags hide
  (never disable) the risky affordances per §165A.2.
- **`NEEDS_REAUTH`** — token expiry is not exposed by the backend (no signal).
  It stays in the §165 status union for protocol completeness and is never
  fabricated by `deriveGithubStatus`; only demo/test fixtures exercise it.
- **BYOK raw key** — a saved provider key is never revealed (§325.11/§63.1);
  only `••••last4` metadata renders and the raw key is dropped from client
  state once validation finishes.

### D21 — Open gaps (backend stream)
- **No line-hunk endpoint** for GitHub diffs (§162 requires diff; FE shows
  stats-only with honest fallback until the backend ships inline hunks or a
  preview content surface).
- **No §165A feature-flags endpoint** (extends D14) — flags remain
  demo/compile-gated.
- **No token-expiry signal** for `NEEDS_REAUTH`.
- `github.*` fan-out events (`github.action.proposed`, `github.connected`,
  `github.disconnected`) are demo broadcasts; the shared dispatch consumes them
  via unknown-type tolerance (vocabulary is handled, live projections for
  Tasks/Decisions/GitHub remain phase-scoped per D15's related items).



---

## 2026-08-24 — P8 tasks, decisions, memory, pulse (FE §83–86, §116–122; BE §108/§110/§111)

### D22 — Endpoint parity: Tasks/Decisions/Memory REST all hit REAL contracts
The P8 surfaces read/write through new §9 endpoint modules (`api/endpoints/
tasks.ts`, `decisions.ts`, `memory.ts`) mirroring handlers/intel.ts and
handlers/memory.ts exactly; every response is zod-validated at the boundary.
Demo `transportRoutes` reproduces each shape over the dataset.

| FE surface | Endpoint | BE contract | Demo parity |
|---|---|---|---|
| Task list / create | `GET`/`POST /projects/:p/tasks` → `{items}` / 201 row | §111 (server defaults TODO · MEDIUM · version 1) | identical incl. VALIDATION_FAILED on title 0/300+ |
| Status / owner / due edits | `PATCH /tasks/:id {expected_version, patch}` | §48 + §21.2 CAS | stale version → 409 CONFLICT "Task changed elsewhere; reload and retry." |
| Complete | `POST /tasks/:id/complete {expected_version}` | §111 | CAS-guarded; stamps completed_at |
| Decision log / propose | `GET`/`POST /projects/:p/decisions` | §110 (always PROPOSED v1) | identical |
| Approve / reject | `POST /decisions/:id/approve\|reject {expected_version}` | §21.2 CAS from PROPOSED | approve supersedes sibling APPROVED rows + stamps approver/approved_at; stale → 409 "Decision changed; reload and retry." |
| Group memory | `GET /groups/:g/memory` → GROUP-scope rows only | §108 (mirrors listGroupMemories) | identical scope filter |
| Project memory | `GET /projects/:p/memory` → PROJECT-scope rows only | §108 | identical |
| Candidates | `GET /groups/:g/memory/candidates` (PENDING) | §36 | identical |
| Save candidate | `POST /memory/:candId/accept` → 201 memory row | §108 (scope/type/confidence ride recommended values) | identical; second accept 404s like the handler |
| Dismiss candidate | `POST /memory/:candId/reject` → `{ok}` | §108 | identical |
| Edit / delete memory | `PATCH`/`DELETE /memory/:memoryId` | §108 (content/importance/confidence ranges) | identical validation messages |

**Realtime fan-out:** dispatch now projects the full §18 vocabulary
(`task.created/updated/assigned/completed/cancelled`,
`decision.proposed/approved/rejected/updated`,
`memory.candidate.created/approved/updated/archived/deleted`). The real
backend's payloads are notify-stubs today (D15 related item), so projections
apply ONLY full validated rows; sparse stubs flip statuses of already-held
rows or are ignored — nothing half-rendered. Demo broadcasts carry complete
rows so both modes share one pathway.

### Honest gaps recorded this pass (nothing papered over)
1. **USER_PRIVATE memory has no list route.** §108 documents ownership
   enforcement but the Worker ships no private-memory feed. The §116 "Your
   Private Memory" section renders client-held rows only and stays empty in
   live mode until the backend exposes it.
2. **No user-initiated memory create endpoint** (FE §118 "Remember this").
   `createMemory()` posts to `POST /groups/:g/memory`, a DEMO-PARITY route;
   live mode surfaces the honest NOT_FOUND instead of faking a save.
3. **§119 related decision / §120 sources have no §47/§48 columns.**
   `related_decision_id` and `sources` render only when a row carries them
   (demo fixtures exercise both); live rows show an honest absence.
4. **§122 `options` rides the propose body but the real create handler does
   not parse it yet** — same shape as message `attachment_ids` (D16). Demo
   persists into the §47 jsonb column; live drops it silently server-side.
5. **§121 source-message links stay client-side.** The §48/§47 tables carry
   no source column, so the dialog keeps the link visible but cannot persist
   it; no invented column shipped.
6. **Decision numbering is derived** — chronological log position per
   project (oldest = #1), one shared derivation for Decisions view,
   Overview, command palette. No `decision_number` column exists.
7. **Pulse/digest:** FE spec defines Pulse only as part of Project Overview
   (§84–85); there is no separate digest surface, so none was built. The §84
   Odin notice count is computed from the real decision log (was hardcoded).
8. **Memory pinning is SPEC-SILENT** — FE §116 lists no pin affordance for
   memory items; none was added. (Pinning exists for artifacts §257 and
   messages §33, both previously wired.)

---

## 2026-08-24 — P9 meetings (FE §123–§128, §124A, §213, §165A; BE §50/§50A/§72/§73/§112)

### D23 — Endpoint parity: Meetings REST hits the REAL §112 contract; candidate lifecycle realigned to §50A

The P5-era meeting UI was client-side fiction: an invented `MeetingSession`
shape (`is_active/is_paused/elapsed_seconds/live_notes`), candidates keyed by a
nonexistent `meeting_id` column with `content: string`, and acceptance done by
calling the §110/§111 task/decision endpoints directly from the shell — the
server never knew the meeting or its promoted ids. P9 replaced all of it with
the wire contract:

| FE surface | Endpoint (`api/endpoints/meetings.ts`) | BE contract | Demo parity |
|---|---|---|---|
| Start meeting (§126) | `POST /projects/:p/meetings` body `{}` → 201 §50 session | §112 (project-scoped; no project → no start) | identical over `ds.meetingSessions` |
| Session detail | `GET /meetings/:id` → `{session, candidates}` | §112 + §50A trail | identical |
| End meeting (§127) | `POST /meetings/:id/end {summary_text}` → `{ok}` | §112/§73 (min-1 summary_text) | identical incl. VALIDATION_FAILED message |
| Detect intake (demo seeds) | `POST /meetings/:id/candidates {candidate_type, content, confidence, source_message_id?}` → 201 row | §50A extra in handlers/intel.ts | identical validation (type enum, 0..1 confidence, record content), 409 when session not ACTIVE |
| Accept (§124A.2) | `POST /meetings/:id/candidates/:cid/accept {promote:'task'\|'decision'}` → 201 `{promoted_id}` | §50A promote callback creates the REAL task/decision and stamps `promoted_to_type/id` | identical, promoting into genuine `ds.tasks`/`ds.decisions` rows with server defaults |

**Contract corrections shipped with this:** FE types are now byte-shaped to BE
(`meeting_session_id`, jsonb `content` records, lowercase `'decision'|'task'`
promote types, `confidence`, `resolved_at`; sessions carry
`started_by/status ACTIVE|ENDED/summary_artifact_id`). The §123 timer and the
§213 "paused" state are CLIENT-derived presentations — the server enum has no
paused value. §124A.2's no-optimistic-accept rule is enforced: the card flips
to ACCEPTED only after `{promoted_id}` returns.

**Realtime fan-out:** dispatch consumes the room's `meeting.started` /
`meeting.ended` system broadcasts (plus the §114 `meeting.event` name) by
hydrating from the validated §112 GET — notify payloads are id-only stubs, so
nothing half-filled is ever projected; a locally-started session (REST response
won the race) is not clobbered. Demo REST routes stay SILENT on purpose: the
real Worker publishes meeting events only on WS-frame paths (backend AUDIT #35),
so parity means no demo-side broadcasts either.

**§128 Garage artifact:** "Review & Save" now ends the session AND, when the
user keeps the checkbox ticked ("if chosen"), creates a REAL artifact via
`POST /projects/:projectId/artifacts` (`{name, artifact_type: MARKDOWN,
content_type, content}` → 201 `{artifact, version}`) merged into the artifact
store. The previous LESSON-memory-row stand-in is gone.

**Honest gaps recorded this pass (nothing papered over):**
1. **No backend route resolves a candidate as REJECTED/MERGED/EXPIRED before
   end** — only detect + accept exist. Dismiss/Skip/Edit-markers therefore stay
   CLIENT-held until the session ends (the server then expires leftovers,
   §50A). A rejected candidate that never sees POST /end would remain PENDING
   server-side.
2. **§124 "Edit" is implemented as re-detect**: there is no update-candidate
   route, so Edit persists the refinement as a NEW §50A row (real server row,
   promotable with its own content) and marks the original MERGED locally per
   §124A.2. An edit control that could not affect what the server promotes
   would have been theater, so none was shipped.
3. **Scheduling/agenda are SPEC-SILENT**: neither the FE spec nor the BE spec
   defines any scheduling/calendar/agenda surface for meetings (grep verified;
   only BE line about "short-lived scheduling information" exists without an
   object). Nothing was invented. Meeting Mode covers start → live panel →
   end → summary exactly as specified.
4. **Live notes have no backend column** — §124's Live Notes section stays
   client-held for the session and is included nowhere in the persisted
   summary beyond what the user confirms in the summary_text.
5. **Meeting summaries list endpoint**: §112 defines no list-sessions route,
   so `/meeting/:id` deep links resolve via held state or a direct GET; an
   unknown id falls back to the safest shared surface (§177 pattern).

Verification: `tsc -b` clean; oxlint no new warnings; vitest 41 files / 330
tests green (P9 adds p9Routes parity, dialogs, panel lifecycle, TopBar/
ChatHeader flag-gating, dispatch projections); production build passes with
the canonical purity greps still clean (`demo-token` / `installDemoMode` /
dataset ids absent from dist/assets).

---

## 2026-08-24 — P10 notifications & activity (FE §36, §171–§174, §171A, §276–§278; BE §95/§95A/§98A/§143)

### D24 — Endpoint parity: Notifications REST hits the REAL handlers/search.ts contract; delivery_state verbatim; OS pipeline gated end-to-end

The notification surface previously rendered only client-held store rows with
a local `is_read` flag and no server round-trip. P10 rewired it to the wire:

| FE surface | Endpoint (`api/endpoints/notifications.ts`) | BE contract (real Worker) | Demo parity |
|---|---|---|---|
| Notification list / badge counts | `GET /notifications?limit=&unread=` → `{items: §95A[]}` | handlers/search.ts (limit clamp ≤100 default 50, recipient-scoped, `created_at DESC`, `unread=true` → `read_at IS NULL`) | identical over dataset wire rows |
| Mark read (§277) | `POST /notifications/:id/read → {ok}` | stamps `read_at`; answers `{ok:true}` EVEN for unknown/foreign ids (UPDATE matches zero rows silently) — demo reproduces this exactly instead of inventing a 404 | identical |
| Activity feed (§172/§98A) | `GET /groups/:groupId/activity?limit=` → `{items: §98A[]}` | membership-checked (`requireMember`) | identical incl. 403 GROUP_PERMISSION_DENIED for non-members |

**Shape corrections shipped:** FE `NotificationItem` is now byte-shaped to the
BE §95A row (`recipient_user_id`, `project_id`, `subject_type/subject_id`,
nullable `body`, `read_at` replacing the invented `is_read`). Read state IS
the server column; local writes are optimistic projections of the POST with
ROLLBACK on failure (an item the server still holds unread keeps its badge).
`target_route` is derived client-side from `(subject_type, subject_id)` per
the §193 stable routes (message/artifact/task/decision/meeting; unknown
subjects fall back to the Group Activity surface). The demo dataset now
stores §95A WIRE rows and hydration maps them through the same mapper as
live responses — demo and live stores cannot drift.

**Realtime fan-out:** dispatch projects `notification.created` carrying a
FULL validated §95A row (demo hub broadcasts it on the §143 semantic
creation sites below), enforces §95A per-recipient targeting client-side too
(rows addressed to another member never enter the cache; no session → no
projection), dedupes by id, then runs the OS pipeline. The real backend has
NO WS frame for notifications today (rows are read back via GET only;
`delivered_realtime` is a delivery_state value, not a socket push) — when it
gains one, the same projection consumes it unchanged. Demo semantic creation
sites mirror the notification-worker consumer: `mention_tokens` (or @tokens
extracted from the body, resolved against THIS Group's roster names,
handlers/messages.ts algorithm) → MENTION; task assignment → TASK_ASSIGNMENT
for the assignee; GitHub proposal → AI_ACTION_APPROVAL to Owners/Admins
except the proposing actor. Self-actions never notify.

**OS pipeline (FE §173/§174/§194/§278):** a row reaches the Tauri bridge only
when ALL gates agree — category ∈ {MENTION, PRIVATE_MESSAGE,
AI_ACTION_APPROVAL, TASK_ASSIGNMENT, SYSTEM} (§174); per-category in-app +
client-derived desktop toggles both on for that Group (§171/§276);
window visible (while away events accumulate into ONE aggregate
"2 new notifications · Mention ×1, Task ×1" flushed on return, §173);
content-hidden preview pref ships title-only bodies (§278). §194's permission
request fires at the ONE clear moment: enabling any Desktop toggle in
Settings. In non-Tauri contexts the bridge no-ops silently.

**Preferences matrix:** Settings' §171 matrix (exact backend category ids ×
In-app/Desktop/Email) now reads/writes through one shared storage module that
osNotify consumes — the matrix actually drives behavior instead of decorating.

**Quiet hours are SPEC-SILENT:** neither the FE nor the BE spec defines quiet
hours/schedules anywhere (grep verified across both authority files). Nothing
was invented; away-time noise is handled by §173 batching exactly as
specified.

**Honest gaps recorded this pass (nothing papered over):**
1. **No notification_preferences REST route exists on the Worker** — prefs
   are read internally by NotificationService.notify only. The §171 matrix
   therefore stays a client-local mirror under `cm_notif_<groupId>`; until
   GET/PATCH routes ship, the SERVER-side suppression (SUPPRESSED_BY_PREFERENCE
   delivery_state) reflects defaults, not the user's toggles.
2. **No WS notification frame from the real backend** (above) — live badges
   refresh on controller fetch/staleness, not push; demo exercises the push
   pathway so the future frame drops in without FE changes.
3. **mention_tokens ride the REST create body but the FE composer does not
   send them yet** — the demo route accepts both mention_tokens AND body
   extraction (real handler algorithm); wiring composer tokens into the POST
   body is chat-surface work, not notification-phase work.

Verification: `tsc -b` clean; oxlint exit 0 (only pre-existing warnings);
vitest 44 files / 367 tests green (P10 adds p10Routes parity ×12, dispatch
projections ×6 incl. per-recipient gate, controller/panel/pipeline/diagnostics
flows ×19); production build passes with purity greps clean (`demo-token`,
`installDemoMode`, dataset ids absent from dist/assets).

---

## 2026-08-24 — P13 accessibility pass (FE §7, §6, §25, §63–§66, §217–§222)

### LEDGER GAP — D25/D26 were never written to this file
The P11 (sync engine) and P12 (settings) commits reference ledger entries that
do not exist here: `src/api/endpoints/sync.ts` and `src/mocks/p11Routes.test.ts`
cite "INTEGRATION_NOTES D25" for the missing backend sync endpoints, and the
P11/P12 commit messages carry their summaries, but no D25/D26 section was ever
appended to this ledger. Recorded here so the gap is visible; the authoritative
sources for those phases remain the commit messages and code comments. P13's
own entry follows as D27.

### D27 — Accessibility audit-and-fix across the whole app

Audit against FE §7 baseline, §8 primitives, §25, §44/§46, §63–§66,
§217–§222 and §6. Findings fixed per category:

**Keyboard navigation (§7/§25):**
1. MessageRow action toolbar was `hidden group-hover:flex` — Reply/React/
   Copy/More were display:none for keyboard users entirely. Rows are now
   focus entry points (`tabIndex={0}`) and the toolbar also surfaces via
   `group-focus-within` (MessageRow.tsx / MessageActions.tsx).
2. ProjectOverview "Recent Artifacts" cards were click-divs; now real
   `<button type="button">` with focus ring.
3. CommandPalette Tab is trapped inside the dialog (Tab/Shift+Tab cycle);
   verified Escape still closes (§63).

**Focus management (§66/§7):**
4. CommandPalette: focus moves into the search input on open (autoFocus
   removed — it raced the restore-target capture) and returns to the
   pre-open trigger on close.
5. AppShell: skip link ("Skip to main content", first tabbable element)
   targets `<main id="cm-main-content" tabindex="-1">`; route changes move
   focus to the main target while initial mount never steals focus (§253).

**ARIA (§64/§65/§217/§218):**
6. Toasts: Radix sets NO default role on Toast.Root — non-error toasts now
   declare explicit `role="status"`; error variant announces `role="alert"`.
7. TopBar group/project switchers, global search and Start Meeting gained
   visible `focus-visible` rings (§7 visible focus); switcher ARIA state
   was already injected by Radix DropdownMenu.Trigger.

**Contrast (§222) — token-level fixes in index.css (both themes verified by
computed WCAG ratios in src/design-system/tokens.a11y.test.ts):**
8. Light `--color-text-tertiary` #9ca3af → #6b7280 (was 2.54:1).
9. Dark `--color-text-tertiary` #6b7280 → #8b95a4 (was 3.56–4.09:1; stays
   dimmer than secondary #9ca3af so the three-step hierarchy survives).
10. Light semantics re-tuned to AA-as-text on white AND their -bg tints:
    success #10b981 → #047857, warning #f59e0b → #b45309, danger
    #ef4444 → #b91c1c (#dc2626 first tried, 4.41:1 on danger-bg — under),
    info #3b82f6 → #2563eb. Dark semantics already passed, untouched.
11. 33 hard-coded Tailwind gray text classes (text-gray-400/500) across 10
    feature files swapped to the tertiary/secondary tokens — they bypassed
    §4 and failed §222 in at least one theme each.
12. Diagram SVG edge labels #6b7280 → #4b5563 (4.09 → 7.56:1 at 10px).

**Reduced motion (§6):**
13. `.spectral-text` collapsed to a STATIC rainbow under reduced motion —
    segments ≈1.8:1. Now falls back to solid `var(--color-text)` (label
    information kept, contrast restored).
14. MessageList "Jump to latest" gates JS smooth scrolling on
    prefers-reduced-motion (the CSS scroll-behavior override cannot reach
    the scrollTo option). Sweep confirmed no decorative rAF/interval loops;
    remaining rAF uses are functional scroll anchoring.

**SPEC-SILENT (recorded honestly):**
- Chart series palette (ChartViewer SERIES_COLORS) and onboarding avatar
  gradients left untouched: categorical data encodings / decorative picks
  with named labels elsewhere — not §222 text, restyle risk outweighs.
- Diagram edge STROKES stay #9ca3af (graphical objects, not text; WCAG
  1.4.11 is arguably implicated but §222 scopes this spec to text).
- No axe/playwright runtime was added — bible lists it for exit tooling but
  the repo has no playwright harness yet (P2 note); coverage is delivered
  as vitest behavioral + computed-ratio assertions instead.

Verification: `pnpm exec tsc -b` clean (exit 0); oxlint exit 0 with 16
warnings = exactly the pre-P13 baseline (no new); vitest 52 files / 448
tests green (400 prior + 48 new a11y assertions covering skip link, main
target, route-change focus, dialog trap/restore/Escape, §25 toolbar reach,
toast roles, computed AA ratios both themes, reduced-motion contract, and
smooth-scroll gating); production build passes; dist purity greps clean
(`demo-token` / `installDemoMode` / dataset ids absent from dist/assets).

---

## 2026-08-24 — P14 performance pass (FE §201–§206, §288–§291)

### D28 — Measured performance work; SPEC-SILENT numeric budgets documented

**Measurement method.** Bundle composition attributed by decoding the
production sourcemap (`vite build --sourcemap`, generated bytes per original
source; maps NOT shipped — rebuilt clean afterwards). Render isolation
measured by counting invocations of an always-mounted child component;
`<Profiler>` commit counts were empirically proven unusable for this (React 19
reports a commit even when a memoized child bails out — inner renders stayed
at 1 while Profiler counted 2).

**Bundle (scope 1) — verified clean, advisory documented SPEC-SILENT:**
1. Main `App` chunk (927.21 kB min / 256.65 kB gzip pre-P14) composition:
   ~47% first-party source (438.5 kB mapped), react-router 88.5 kB, markdown
   pipeline (micromark/mdast/hast/unified stack via react-markdown+remark-gfm)
   ~112 kB, tailwind-merge 27 kB, @tanstack/virtual-core 21.9 kB,
   lucide-react 20.8 kB, remainder Radix/floating-ui/cmdk/zod. react-dom and
   supabase-js already live in their own chunks.
2. Heavy-renderer laziness verified end-to-end in DIST: `App-*.js` contains
   ZERO `recharts-`/`react-flow` markers; the lazy `DiagramViewer-*.js` chunk
   holds @xyflow/react (3 markers) and lazy `ChartViewer-*.js` holds recharts
   (16 markers). Lazy boundaries sit at ArtifactPanel.tsx (§201).
3. **pdfjs: no such dependency exists** — PdfViewer was deleted in P6 (D17.8);
   there is no PDF renderer to lazy-load and none was invented (§254 honesty).
4. The >500 kB chunk-size advisory REMAINS. Neither authority file sets any
   numeric bundle/startup budget (FE §288 is qualitative priority ordering
   only; BE §154/§155 are backend-only targets), so per the measurable-changes
   rule NO speculative route splitting was performed. Composition above is the
   recorded measurement for whoever gets a budget ruling.
5. `mdast-util-to-markdown` (~11 kB) flagged during audit: unavoidable
   transitive dep of remark-gfm's mdast-util-gfm (serializer half); removing
   it would require dependency surgery — not done.

**Render performance (scope 2) — one real cascade found and fixed:**
AppShell subscribes to whole stores (no selectors), so EVERY composer
keystroke re-rendered the entire shell — including the then-unmemoized
ArtifactPanel, whose DocumentViewer re-parsed the artifact Markdown on each
keystroke with the panel open (violates §203 "do not rerender … full artifact
tree" and §288 priority 1). Fixes, all behavior-preserving:
1. `ArtifactPanel` export wrapped in `React.memo` (default shallow compare —
   safe because every callback prop is referentially stable upstream).
2. AppShell's two inline lambdas (`onAskOdinAboutNode`, `onSendToChat`)
   hoisted to `useCallback`.
3. Toast context value memoized (`useMemo`) — previously ANY toast firing
   anywhere re-rendered every `useToast()` consumer app-wide (Composer,
   panels, settings) because the provider built `{ toast, dismiss }` inline.
MessageRow's §203 machinery (memo comparator ignoring callback identity +
per-message aiStreamStore subscription) from P3/P5 was audited and left
untouched — it already satisfies "only active response changes per batch".

**Startup (scope 3):** boot graph verified — main.tsx stages everything
behind dynamic imports (env → mocks/client → supabase → session → react/App);
nothing heavy is statically imported before first paint. No startup budget is
defined by either spec; no trimming performed beyond the audit.

**Memory / object URLs (scope 4) — audited clean, zero fixes needed:** the
only createObjectURL sites are `svgToPngBlob` (revoke in `finally`, covers
error/early-return paths), `downloadExport` (deferred revoke 1 s after click),
and upload chips in useAttachmentUploads (revoked on remove AND cancel). A
sent chip's URL intentionally transfers ownership to the sent message's
thumbnail (one URL per upload, bounded by held messages — not a leak).

**§205 search debounce:** N/A today — command-palette search filters cmdk's
in-memory items client-side; no server search endpoint is consumed, so there
is no request to debounce or cancel. Recorded honestly; no fake debounce added.

**Tests (scope 5) — +5, all spec-mandated regressions:** §203's "only active
response component should change on each stream batch" had NO prior coverage.
New `messageRenderIsolation.test.tsx` (stream delta commits ONLY the active
row; comparator ignores fresh callback identities; body edits still commit)
and `artifactPanelMemo.test.tsx` (keystroke-shaped parent render costs ZERO
viewer work; real input changes still re-render). No existing tests weakened.

Verification: `pnpm exec tsc -b` exit 0; oxlint exit 0 with 16 warnings =
exactly the P13 baseline (diffed warning-for-warning); vitest 54 files /
453 tests green (448 + 5); production build 726 ms (pre-P14 ~745 ms), App
chunk 927.36 kB (+0.15 kB from memo/useCallback wrappers); dist purity greps
clean (`demo-token` / `installDemoMode` / dataset ids absent from
dist/assets); no sourcemaps shipped.

### D29 — P15 final: security audit + Tauri packaging prep; phase-close

**Security findings and fixes (both authority files binding: FE §156/§232/§287/
§292/§293/§294/§295/§296/§297, BE §63/§187):**

1. **FIXED — phantom `@tauri-apps/*` dependencies.** `src/tauri/bridge.ts`
   imports `@tauri-apps/api` + six plugins, but they were declared ONLY in the
   repo-root package.json — the frontend resolved them by Node walking up into
   `/ClanMind/node_modules/`. A standalone `pnpm install` of this package would
   not resolve them (packaging blocker). All seven are now declared in
   clanmind-frontend/package.json at the same ranges the shell was tested
   against (api ^2.11.1, dialog ^2.7.2, fs ^2.5.1, notification ^2.3.3,
   shell ^2.3.5, store ^2.4.4, updater ^2.10.1); lockfile updated.

2. **FIXED — §295 gap: rendered links bypassed the controlled mechanism.**
   Markdown anchors in chat bubbles/document artifacts rendered as bare `<a>`
   (a click would navigate the webview away), ResearchDrawer source cards were
   plain anchors, and `bridge.openExternalUrl` had ZERO callers. New
   `src/tauri/externalLinkPolicy.ts` (`isSafeHttpUrl`,
   `handleExternalLinkClick`) + component-only `src/tauri/externalLinks.tsx`
   (`SafeMarkdownLink`). http(s) links preventDefault() FIRST and route through
   the bridge (shell open in Tauri; `window.open(...,'noopener,noreferrer')`
   otherwise); non-http(s) schemes render href-less (defense-in-depth under
   react-markdown's own URL transform). Wired into MessageRow, DocumentViewer,
   ResearchDrawer. Splitting policy/component kept oxlint at the 16-warning
   baseline exactly.

3. **Verified clean (no change needed):** BYOK key lifecycle is memory-only —
   raw key lives in one React state field, is dropped immediately after server
   validate (`setByokKey('')`, §63.1/§325.11), only `key_last4` ever renders,
   never persisted anywhere (SettingsView.tsx ByokCard). No
   `dangerouslySetInnerHTML`/innerHTML in app code; no rehype-raw — both
   markdown surfaces are react-markdown+remark-gfm only, raw HTML skipped
   (§296); GitHubDiffViewer highlights via its own React-span tokenizer.
   No eval/new Function/document.write. localStorage holds only UI prefs +
   window state + device UUID + Supabase auth session (SDK-standard, required
   by §196 session restore; NOT a BYOK secret per §325.11). env.ts carries only
   publishable anon key. No iframes/srcDoc anywhere (§293/§297). osNotify
   enforces §278 title-only preview gate. dist purity greps clean; no
   sourcemaps; secret-pattern scan (sk-/ghp_/AKIA/PEM) clean across src, dist,
   src-tauri. CSP identical in index.html + tauri.conf.json: script-src
   'self' (no unsafe-inline for scripts, no eval need), style-src 'self'
   'unsafe-inline' (Tauri-standard, covers React style attrs), built
   dist/index.html has exactly one external module <script> and zero inline
   handlers. Dependency list manually reviewed: all mainstream, maintained,
   no typosquat/unusual packages.

**Packaging prep status:** tauri.conf.json matches spec — identifier
io.clanmind.desktop, 1440×900 default / minWidth 1024 × minHeight 700 (FE spec
sets no numeric minimums; values keep ≥900 two-pane band usable, recorded per
measurable-changes rule), §195 window-state persistence via store plugin +
browser fallback, updater stub present (pubkey + endpoints) satisfying §309
shape, bundle targets nsis+msi. Capabilities least-privilege vs §294:
core/dialog/fs/notification/store/updater defaults + `shell:allow-open` ONLY
(no exec) — every permission maps to a registered plugin in lib.rs/Cargo.toml;
no broad filesystem or shell grants.

**Tests:** +6 security regressions (453 → 459), all green:
`src/features/chat/markdownSecurity.test.tsx` locks §296 sanitize-on-render
(raw HTML `<script>/<img onerror>/<iframe>` never materializes on either
markdown surface) and §295 link routing (http(s) clicks go through the bridge
path with noopener; `javascript:` links never become clickable). No existing
test weakened or skipped.

Verification: `pnpm exec tsc -b` exit 0; oxlint exit 0, 16 warnings = exact
P14 baseline (diffed warning-for-warning); vitest 55 files / 459 tests passed;
production build ✓ 718 ms, App chunk 925.17 kB (−2.19 kB vs P14);
dist purity greps clean (`demo-token`/`installDemoMode`/dataset ids absent),
0 sourcemaps, secret-pattern scan clean. P15 close: ALL FE-spec phases
(P0–P15) committed green.
