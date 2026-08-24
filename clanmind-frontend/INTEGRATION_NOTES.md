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

