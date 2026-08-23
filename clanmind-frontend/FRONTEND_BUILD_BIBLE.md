# ClanMind Frontend — Build Bible (Execution Plan for the Implementing Agent)

> **What this document is:** My personal execution authority. Every phase, file, and decision made while building `clanmind-frontend/` must trace back to this plan, which itself traces to the two master specifications.
>
> **Authority chain (in order):**
> 1. `../ClanMind_Frontend_Master_Implementation_Specification.md` — UX/interaction/frontend authority ("FE §n")
> 2. `../ClanMind Backend — Master Implementation Specification.md` — API/data/realtime contract authority ("BE §n")
> 3. This document — sequencing and engineering discipline only. **If this document ever conflicts with either spec, the spec wins.**
>
> **Bar:** This is a product, not a prototype. Nothing ships because a screenshot looks good (FE §328.39). The final quality bar is FE §328.40: *the whole product feels coherent when a real team uses it for hours.*

---

## 1. Ground Truth — Where We Actually Are (honest audit result, 2026-08-23)

**Exists and is good (keep, harden):**
- Design tokens (FE §4), motion keyframes + reduced-motion (FE §6), spectral discipline (FE §3.3)
- Radix primitive wrappers covering the FE §8/§310 foundational list
- Canonical types in `src/types/index.ts` — enums match BE exactly (`ai_runs.status` incl. APPROVED tool gating, `ai_actions` 8-state lifecycle, meeting candidates, notification categories + delivery_state, nine-value FileSyncState, feature flags, sync shapes)
- Spec-faithful components: ApprovalCard (FE §164A), SyncConflictCard (FE §186A), AiQuotaCard (FE §141), MeetingPanel (FE §124A), FileSyncIcon (FE §189/§212), Composer (FE §42–60 mostly), MessageList scroll behavior (FE §37–41)
- Safe markdown pipeline (react-markdown only; zero `dangerouslySetInnerHTML`/rehype-raw/iframes)
- Narrow Tauri capability set + bridge wrapper with URL validation (FE §294/§295)
- Update-flow UI shells (FE §309A), per-view error boundaries (FE §199), drafts scoped per user/group/project (FE §190)
- 6 test files; vitest+jsdom+RTL configured; oxlint; TS strict

**Missing or fake (this is the actual product to build):**

| # | Gap | Severity |
|---|---|---|
| G1 | Entire Integration layer absent: no `src/api`, `src/realtime`, `src/local`, `src/sync`. Zero `fetch()`, zero WS, zero Supabase client | P0 |
| G2 | Auth is a mock (`AuthScreen.tsx` sets a fake user). No Supabase Auth, no session lifecycle/expiry (BE §6, FE §67/68/197) | P0 |
| G3 | No router. Deep links are a switch statement inside AppShell (FE §193) | P0 |
| G4 | Offline/sync is theater — no connectivity detection, no queue replay engine, checkpoints never sent (BE §20/§20A) | P0 |
| G5 | AI streaming is `setTimeout` choreography — no WS consumption, no real cancel/retry (BE §106/§114/§115) | P0 |
| G6 | Responsive layout completely missing (FE §13) — fixed three-pane at all widths | P1 |
| G7 | No chat virtualization / cursor pagination (FE §202/§289, BE §156) | P1 |
| G8 | `AppShell.tsx` = 1,257-line monolith owning chat send, AI orchestration, approvals, meetings, deep links — violates FE §9/§311 | P1 |
| G9 | Mention picker doesn't track caret (FE §60); `/private` skips recipient chooser (FE §55); no Ctrl/Cmd+Enter preference (FE §44 optional) | P1 |
| G10 | Persist keys not account-scoped (`cm_auth`, `cm_chat`… global) — FE §283/§284 risk | P1 |
| G11 | Hard-coded demo content everywhere (seeded Robotics group, `'user_arun_1'`, hard-coded research drawer content) | P1 |
| G12 | PDF viewer is a visual mockup (no pdf.js, FE §92); attachment upload lifecycle states never transition (FE §48–51); diagram viewer not driven by structured artifact schema (BE §74) | P2 |
| G13 | OS notifications, presence, feature flags exist as UI but nothing real drives them (BE §95A, §96, §166) | P2 |
| G14 | Tauri capabilities use bare `fs:default`; local-folder access (FE §187) will need scoped runtime permissions or a Rust command | P2 |

---

## 2. Non-Negotiable Engineering Rules (violating any of these = rework)

1. **Layer boundaries (FE §9).** Components NEVER call `fetch()`/WS/Tauri APIs directly. Flow is always
   `component → feature hook/controller → api|realtime|local|sync layer → network`.
   Zustand stores hold UI/local/draft/sync state only. Server data lives ONLY in TanStack Query.
2. **Server cache ≠ UI state (FE §11).** Composer text, panel widths, theme = local/UI stores.
   Messages/projects/members/AI runs/artifacts/tasks/decisions/notifications = Query cache keyed stably.
3. **Backend is the security authority (FE rule 25).** The client renders permission-aware affordances from
   server-provided role/permissions but NEVER decides authorization. Hide unavailable actions (FE §111/§303).
4. **Private isolation (FE rule 26, BE §55A).** Private messages / private AI / user-private memory never enter
   shared caches, activity, notifications, or logs. Cache keys include visibility scope. Automated test asserts this.
5. **Canonical enums only (FE §134A/§164A/§165A/§171A/§189).** Never invent client-side statuses absent from BE.
   UI overlays (`fallback`, `approval pending`) are derived flags, not statuses.
6. **Idempotency identity (BE §19, FE §186A.2).** A retry reuses the identical `client_operation_id`. Never mint a new one.
7. **Approval integrity (BE §78A.1).** Approve submits the exact displayed `payload_hash` + `payload_version`.
   On mismatch/EXPIRED → re-fetch → fresh card (FE §164A.4). Never cache approve-button validity.
8. **No secrets in client (FE §292).** BYOK keys pass through admin settings POST once; never stored/logged/persisted client-side.
9. **Untrusted rendering (FE §296/§297).** Markdown via safe renderer defaults; interactive artifacts run sandboxed,
   zero Tauri/auth/secret bridge unless an explicit reviewed data bridge exists (FE §293).
10. **Motion communicates state (FE rule 28).** Spectral only for the FE §3.3 whitelist. Reduced motion removes movement, never information (FE §6).
11. **Every async op has loading/error/recovery; every screen has empty/loading/error/offline/permission states (FE §328.28/29).**
12. **No dead code ships.** Demo/mock code lives under `src/mocks/**`, loaded only via dynamic import when `VITE_DEMO_MODE=1`. Production bundle must not contain it (verified by grep on build output).

---

## 3. Target Architecture

### 3.1 Directory contract (extends FE §10; additions marked ★)

```text
src/
  app/                      # router, providers, boot sequence, error boundaries
    router.tsx              # ★ route tree (React Router v7 data router)
    providers.tsx           # ★ QueryClient, Toast, Tooltip, Theme providers
    bootstrap.ts            # ★ startup sequence orchestrator (FE §196/§308)
  design-system/            # tokens, primitives, components (exists; harden)
  features/                 # one folder per domain; exports <FeaturePage> + hooks/controllers
    auth/ groups/ projects/ chat/ ai/ artifacts/ approvals/ garage/
    tasks/ decisions/ meetings/ github/ settings/ search/ notifications/
    memory/ team/ onboarding/ sync/ shell/
  api/                      # ★ typed REST layer — the ONLY fetch site
    client.ts               # base client: auth header, idempotency key, request_id, error mapping (BE §102)
    schemas.ts              # zod contracts mirroring BE payloads (runtime-validated, BE §152)
    endpoints/              # one module per resource (groups, messages, ai, artifacts…)
    queries.ts              # query-key factory + shared options
  realtime/                 # ★ WebSocket layer — the ONLY socket site
    connection.ts           # connect/reconnect/backoff/jitter, heartbeat, version check (BE §114/§165)
    events.ts               # envelope schema (BE §17) + event-type union (BE §18/§114)
    dispatch.ts             # routes events into Query cache / stores / toasts
  sync/                     # ★ offline engine
    queue.ts                # durable op queue (idb-backed), client_operation_id reuse
    engine.ts               # checkpoint push/pull, replay, conflict intake (BE §20/§20A)
    connectivity.ts         # navigator.onLine + heartbeat-derived status
  local/                    # ★ device-local persistence
    db.ts                   # idb wrapper, per-account DB names (FE §283)
    prefs.ts                # window state, panel widths, view modes (Tauri store w/ localStorage fallback)
  tauri/                    # bridge.ts (exists) + capability additions
  state/                    # zustand stores: ui, composer/drafts, sync mirror
  hooks/ types/ mocks/      # mocks gated behind VITE_DEMO_MODE dynamic import
```

### 3.2 Startup sequence (implements FE §196/§308)

```text
boot → open local db (account-scoped) → restore session (Supabase) → render cached shell
     → restore last Group/Project/drafts/window → init router
     → connect WS (version handshake BE §165) → pull since checkpoint → replay queued ops → live updates
```

Remote sync must never block first paint.

---

## 4. Locked Technology Decisions

| Concern | Decision | Rationale (spec anchor) |
|---|---|---|
| Routing | **React Router v7** (data router, `BrowserRouter`) | Mature, loader-based gating. Verify Tauri SPA-fallback on the built binary in P0; if broken, switch to HashRouter (single-point change, decision recorded) |
| Server cache | **TanStack Query v5** (present) | FE §9/§11 separation; retry/stale semantics |
| Client state | **Zustand** (present), split stores | FE §11 |
| Validation | **Zod** for every external payload (responses, WS events, forms) | BE §152 "never trust TS types alone" |
| Auth | **@supabase/supabase-js** for auth ONLY (session, refresh, recovery). ALL domain data via `/api/v1` | BE §6/§86/§87 — no direct table writes from client |
| Local persistence | **idb** (IndexedDB) for message cache + sync queue + drafts backup; Tauri store plugin for small prefs | Works in browser dev + Tauri; account-namespaced DBs (FE §283) |
| Virtualization | **@tanstack/react-virtual** (chat list, Garage grid/list) | FE §202/§289/§318 |
| Markdown/code | react-markdown + remark-gfm (present) + **rehype-highlight** | Safe-by-default pipeline (FE §296); code copy toolbar (FE §27) |
| PDF | **pdfjs-dist**, worker via Vite, route-level lazy chunk | FE §92 |
| Diagrams/graphs | **@xyflow/react** rendering structured `{nodes[],edges[]}` payloads | BE §74: backend emits stable domain schemas, NOT DOM/mermaid; enables node/edge arrival animation (FE §98) |
| Charts | **recharts** (lazy chunk) | CHART artifact type (FE §101) |
| Forms | **react-hook-form + zodResolver** | Settings/onboarding/task forms; dirty-state discipline (FE §279) |
| Dates | **date-fns** | Timestamps, meeting timer formatting |
| E2E | **Playwright** against `vite dev` (bridge fakes for Tauri paths) | FE §312–318 flows in browser mode |
| Mock backend | **MSW** for `/api/v1/*` + in-repo fake WS hub | Full-stack dev before/alongside the backend AI (see §6) |

New deps: `react-router`, `@supabase/supabase-js`, `idb`, `@tanstack/react-virtual`, `rehype-highlight`,
`pdfjs-dist`, `@xyflow/react`, `recharts`, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `msw`,
`@playwright/test`.

---

## 5. Backend Binding Contract Sheet (the only network truth)

All client networking binds to these; deviations get logged in `INTEGRATION_NOTES.md`, never papered over:

- **Base:** `/api/v1` (BE §103). Cursor pagination `before=<cursor>&limit=50` (BE §156). Every mutating
  request carries `Idempotency-Key` / `client_operation_id` (BE §19).
- **Error envelope (BE §102):** `{ error: { code, message, request_id } }`. Special codes handled distinctly:
  `APPLICATION_AI_QUOTA_EXHAUSTED` + `can_continue_with_byok` (BE §94 / FE §141),
  `CLIENT_UPDATE_REQUIRED` (BE §165 / FE §309A.2), `409 CONFLICT` on optimistic-concurrency objects (BE §21.2).
- **REST surface used by UI (BE §104–113):**
  - me: GET/PATCH `/api/v1/me`
  - groups CRUD; members GET/PATCH/DELETE + `transfer-ownership`
  - invites POST/GET/accept/revoke
  - projects CRUD + archive/restore
  - messages POST/PATCH/DELETE/GET/search
  - AI runs POST/GET/cancel; AI config GET/PATCH + provider validate/models (admin-only)
  - memory GET/candidates/accept/reject/PATCH/DELETE
  - artifacts CRUD + versions/restore/pin/share
  - decisions CRUD/approve/reject; tasks CRUD/PATCH/complete
  - meetings POST/GET/end
  - github connect/status/disconnect/actions(+approve/reject)
- **WS protocol (BE §114).** C→S: `connection.hello, room.subscribe, message.send/edit/delete/react,
  typing.start/stop, presence.update, ai.run, ai.cancel, artifact.interaction, meeting.start/end,
  sync.ack, sync.request`. S→C: `connection.ready, message.created/updated/deleted, reaction.updated,
  presence.updated, typing.updated, ai.started/status/tool/delta/completed/failed, artifact.event,
  approval.requested, task.updated, decision.updated, github.updated, meeting.event, sync.events,
  sync.conflict, error`.
- **Envelope (BE §17):** `protocol_version, event_id, event_type, sequence, group_id, project_id,
  actor_id, visibility, occurred_at, payload, request_id`. Sequence gaps trigger `sync.request` from
  checkpoint (BE §17.1/§20.2).
- **AI run status enum:** QUEUED/RUNNING/WAITING_TOOL/STREAMING/COMPLETED/FAILED/CANCELLED;
  tool calls: PENDING/APPROVED/EXECUTING/SUCCEEDED/FAILED/DENIED (BE §52/§57A).
  WAITING_TOOL recurs within one run; tool cards show `tool_name`, not "thinking" (FE §134A).
- **Approvals:** `ai_actions` 8-state lifecycle + hash/version binding; GitHub actions join through
  `ai_action_id` — never their own status (BE §78/§78A). Approve endpoint submits hash+version.
- **Sync tables (BE §20A):**
  `sync_checkpoints(device_id, group_id, last_server_sequence, last_synced_at)`;
  `sync_operations(status ∈ PENDING/APPLIED/REJECTED/CONFLICT, result_reference)`;
  `sync_conflicts(conflict_type ∈ version_mismatch/concurrent_edit/deleted_upstream,
  resolution_strategy ∈ server_wins/client_wins/merged/manual)`.
- **Notifications (BE §95A):** categories × delivery_state; preferences per `(user, group, category)`
  → `in_app_enabled/email_enabled`; desktop channel is client-derived (FE §171).
- **Presence:** ONLINE/IDLE/AWAY/OFFLINE ephemeral (BE §96); typing started/stopped events (BE §18).
- **Limits that shape UI (BE §178):** body ≤ 8,000 chars (near-limit counter in composer);
  attachments ≤ 10/message; upload ≤ 25 MB (pre-flight rejection); signed URL lifetime 15 min
  (refetch on preview expiry); invite token lifetime 7 days.
- **Version metadata (BE §165):** checked at every WS connect, not just cold start (FE §309A).
- **Artifact streaming events (BE §75):** created/node.created/node.updated/edge.created/
  render_state.updated/completed → drive FE §97/§98 construction animation.
- **Meeting candidates:** `meeting_candidates(candidate_type ∈ DECISION/TASK/OPEN_QUESTION/
  CONTRADICTION/RESEARCH_NEED/MILESTONE_CHANGE; status ∈ PENDING/ACCEPTED/REJECTED/MERGED/EXPIRED;
  promoted_to_type/promoted_to_id)` (BE §50A / FE §124A).
- **File sync/index states:** nine sync values + INDEXING/READY/FAILED/STALE/DELETED index axis
  (BE §4.3/§127/§128 / FE §189/§212).

---

## 6. Parallel-Development Protocol (backend AI is building concurrently)

1. **Contract-first.** Implement against the BE spec sections above, never guessed behavior.
2. **Demo mode is a first-class env.** MSW handlers + fake WS hub reproduce the documented contract
   deterministically — including failure paths: quota error (+BYOK branch), 409 conflicts, sequence gaps,
   `CLIENT_UPDATE_REQUIRED`, upload failures, EXPIRED approvals. Enabled via `VITE_DEMO_MODE=1`;
   tree-shaken otherwise. Existing mock seeds move here; prod bundle contains none.
3. **Runtime validation at the boundary.** Zod parses every response/event. Unknown fields tolerated;
   unknown enum values render a generalized Unsupported-state UI, never crash (FE §200 pattern).
4. **Discrepancy ledger.** Any real-backend divergence from spec → record in `INTEGRATION_NOTES.md`
   with repro. The fix belongs on whichever side violates its own spec.
5. **Integration smoke checklist** (run once backend reachable): login → create group → invite →
   send/receive realtime message across two clients → @AI run streams with tool timeline → cancel
   mid-stream → regenerate → quota error path → approval propose/approve incl. stale-hash EXPIRED path
   → task edit conflict 409 → go offline → queue 3 ops → reconnect → replay → conflict card on forced
   conflict → notification deep link lands on message.
6. **No blocking.** Phases are sequenced so UI-correctness work proceeds on demo mode even if a
   backend dependency slips.

---

## 7. Refactor Mandates (do early — they compound)

- **R1 — Kill the monolith (P0→P1).** `AppShell.tsx` shrinks to layout composition only.
  Chat send logic → `features/chat/useChatController.ts`; AI orchestration → `features/ai/useAiRuns.ts`
  + `realtime/dispatch.ts`; approvals → `features/approvals/useApprovals.ts`; meetings → `features/meetings/*`;
  deep links → router. Components receive typed props and own no unrelated domain logic (FE §311).
- **R2 — Responsive shell (FE §13).** Breakpoint controller:
  ≥1440 three-pane · 1200–1439 compressed three-pane · 900–1199 two-pane collapsible right · <900 single pane + sheets.
  Right surface becomes overlay sheet <1200; left rail collapses <900; composer always bottom-anchored.
  Panel resize keeps keyboard alternative (FE §220), persists widths (FE §249).
- **R3 — Router adoption (P0).** Routes per FE §193: `/auth`, `/onboarding`, `/group/:groupId`,
  `/group/:groupId/project/:projectId`, plus detail routes `/message/:id`, `/artifact/:id`, `/task/:id`,
  `/decision/:id`, `/meeting/:id` that resolve into Group context (switch group → project → load → scroll
  → highlight briefly, FE §177/§247).
- **R4 — Account-scoped persistence (P0, FE §283/§284).** idb DB name `cm_<userId>`; zustand persist keys
  re-keyed per account or cleared on account switch; test proves private drafts cannot cross accounts.
- **R5 — Demo purge (P0).** All seed/demo constants out of runtime stores into `src/mocks`.
  Fallback IDs like `'user_arun_1'` deleted; missing-auth renders auth screen, never a ghost user.

---

## 8. Phase Plan

> Each phase exits with: typecheck ✓ lint ✓ unit tests ✓ affected E2E (demo mode) ✓ manual keyboard/offline spot-checks ✓. Commit-sized increments; no phase blends concerns.

### P0 — Foundations & honesty pass
Build order: R5 → R4 → R3 → api/client → realtime/connection → sync skeleton → start R1.
- Env config module (`VITE_API_BASE_URL`, `VITE_WS_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_DEMO_MODE`, `APP_VERSION`) with fail-fast validation.
- `api/client.ts`: fetch wrapper — Bearer token, `Idempotency-Key`, `request_id`; maps BE §102 errors to typed `ApiError{code,message,requestId,status}`; timeout+abort; retry only for TRANSIENT class (BE §121).
- `api/schemas.ts`: zod contracts (start: me, groups, members, projects, messages page, error envelope).
- `realtime/connection.ts`: connect with token, `connection.hello`/`room.subscribe`, heartbeat, exponential backoff + jitter, online/offline awareness, `connection.ready` incl. version metadata feeding FE §309A store; sequence tracker detecting gaps → emits sync request.
- `sync/connectivity.ts` driving the existing SyncBanner for real (FE §185: connected invisible / reconnecting / offline / syncing n / synced).
- React Router tree + auth-gate loaders (unauthed → `/auth`; no groups → `/onboarding`); deep-link resolver replacing the AppShell switch (R3).
- MSW + demo WS hub scaffold; move seeded Robotics data into handlers; purge G11/G5 fakes from runtime paths (R5).
- Begin R1: extract chat-send into a controller hook (no behavior change).
- **Exit:** app boots unauth→auth→shell purely via router in demo and live-error modes; WS connects or fails gracefully into the banner in both; `pnpm build` output greps clean of mock seeds; all existing tests green.

### P1 — Real auth & session (FE §67/68/197; BE §6)
- Supabase client (auth only). Wire login / signup (name/email/password/confirm) / password recovery without account-existence disclosure (FE §68).
- Session lifecycle: refresh handling; 401/auth failure → "Your session expired. Local work is safe." + Sign in again (FE §197). Queued ops preserved across same-account re-login.
- Logout/account switch clears or re-keys account-scoped local state (R4); isolation test.
- `GET /api/v1/me` → profile into TopBar.
- **Exit:** E2E demo — login→logout→login restores drafts; wrong-password shows inline field error; expired-session path unit-tested.

### P2 — Shell IA, navigation & responsive (FE §12–20; R2)
- Breakpoint-driven layouts; narrow-mode sheets for thread/artifact/approvals (Esc closes, focus restored — FE §30/§66).
- LeftNav sections per FE §17; TopBar breadcrumb `ClanMind / Group / Project` (FE §14).
- GroupSwitcher (current/recent/unread/search/create/join — FE §15) and ProjectSwitcher (FE §16) fed by real queries; switching restores last Project + drafts + correct room subscription (FE §191/§192/§305/§306).
- Extend window-state persistence to sidebar/panel widths + last group/project (FE §195).
- Guest/Member/Admin affordance matrix from membership role (FE §20/§303): guests get restricted nav, never seas of disabled controls.
- **Exit:** Playwright at 1440/1280/1024/800 widths asserts layout mode; every section reachable by keyboard alone (FE §313 subset).

### P3 — Chat realtime core (FE §21–46; BE §105/§114)
- Query-backed message pages (cursor), virtualized list preserving anchors + unread divider position (G7; FE §39/§202/§289).
- Send path: optimistic insert with `client_message_id` → WS `message.send` (POST when queued offline) → reconcile server id/sequence → dedupe by client id (FE §241/§242; BE §21.1 cloud ordering wins).
- Realtime dispatch of message.created/updated/deleted + reaction.updated into cache; typing.start/stop ephemeral windows (FE §37); presence.updated → header counts (FE §19/§38).
- Reactions quick-set + picker, optimistic toggle w/ rollback (FE §28/§29/§243); hover action row Reply/React/Copy/More, role-filtered menu (FE §25); copy icon→check microinteraction (FE §26); code-block toolbar copy exact bytes (FE §27).
- Inline edit (Enter/Shift+Enter/Esc; subtle `edited`; FE §31), soft-delete tombstone (FE §32), pin indicator (FE §33), reply preview header (FE §59).
- Mentions: caret-tracked, viewport-clamped picker (fixes G9, FE §34/§60); stable-token rendering (FE §35); mention → Activity item (FE §36).
- Threads in right surface; single primary right surface with tabs when thread+artifact compete (FE §30/§250); unread jump button (FE §40); auto-follow rules (FE §41/§136).
- Private scope end-to-end: `/private` recipient chooser incl. Odin (fixes G9b, FE §55); PRIVATE_PAIR/PRIVATE_AI scoped views, unmistakable headers, cache scoping, zero shared-surface leakage + automated leakage test (FE §56/§57/§58).
- Drafts via idb restored on scope switch (FE §190). Ctrl/Cmd+Enter preference (FE §44 optional).
- **Exit:** two simulated clients exchange messages/typing/reactions/threads; 10k-message fixture scrolls smoothly with anchored divider; private leakage test passes.

### P4 — Files & attachments (FE §47–53; BE §43/§81–84/§127–128)
- Upload service: pick/drag/paste → chips with selected/uploading(%,cancel)/uploaded/failed(retry/remove) (FE §48/§50/§51); pre-flight size/count limits with friendly rejection (BE §178).
- Signed-URL flow: request upload target → PUT with progress → attach to message; refetch URL on expiry (BE §84/§178).
- Image thumbnails + lightbox viewer fit/zoom/pan/copy/open-locally (FE §93); PDF viewer real pdfjs: page nav, zoom, search, fit-width, lazy pages (FE §92).
- Index-state chip (`Preparing for Odin…`; STALE distinct) driven by attachment index_state (FE §212).
- **Exit:** demo handlers simulate progress/failure/expiry; cancel aborts in-flight PUT; large-PDF fixture lazy-renders.

### P5 — AI runs & streaming (FE §129–158; BE §106/§114/§115)
- Run creation on mention/command (`ai.run`) + REST POST; shell appears instantly as QUEUED (FE §134).
- WS consumption mapping exactly FE §134A (incl. recurring WAITING_TOOL with per-tool cards: PENDING / APPROVED-gated card / EXECUTING / SUCCEEDED / FAILED / DENIED — FE §133/§134A.1).
- ai.delta batched incremental markdown into the ACTIVE component only (FE §135/§203); citations → source cards/popover/ResearchDrawer (FE §143–146).
- Metadata row: model used, `Odin · fallback model` (FE §142), `Odin · BYOK` handoff indicator (FE §141), web research count, skill-used tag (FE §153).
- Cancel → CANCELLED preserves partial content, offers retry (FE §137); Retry = new run (FE §138); Regenerate = new run + new artifact version (FE §139).
- Error card Retry/Try-fallback (FE §140); quota branch wired to REAL error code (FE §141).
- Deep-research staged progress (FE §148; BE §119).
- Streaming perf: render-counter test proves no list/nav re-render per delta.
- **Exit (demo):** full lifecycle incl. multi-tool run, mid-stream HIGH-risk tool surfacing ApprovalCard, DENIED continuation, silent BYOK handoff; a11y announces start/complete/fail only (FE §218).

### P6 — Artifacts & Garage (FE §87–114; BE §109/§75)
- Structured-content renderers by artifact_type (FE §101): Document/Markdown (safe md), Diagram/Flowchart/Architecture/Graph/Mindmap via @xyflow from `{nodes,edges}`, Chart via recharts, Table, Code (highlighted), GIT_DIFF viewer, RESEARCH layout. HTML/INTERACTIVE only when flag on, sandboxed iframe with zero privileged bridge (FE §293); unknown types → UnsupportedArtifactCard (FE §200/§291).
- Live construction from BE §75 events: node fade+scale arrival, one-time edge draw then static (FE §97–§100); completion glow once, no confetti; reduced-motion swaps animation for textual status (FE §219).
- Panel behaviors: open preserves chat scroll, width animates, close restores focus (FE §95/§248); auto-open only for substantial requested outputs (FE §252); focus policy (FE §253).
- Versions: selector with creator/timestamp/source-run, View/Compare/Restore (FE §102); compare per type (doc diff, diagram structural diff, table row diff) without raw JSON by default (FE §103); fullscreen (FE §104); zoom controls (FE §105).
- Selection → details panel + Ask Odin with object id attached (FE §106/§107); comments where supported (FE §108); presence viewers/editing via realtime only (FE §109).
- Context actions: Use-as-context flow + `✓ Used by Odin` indicator (FE §113/§114); export formats actually generated (FE §254); share stays Group-scoped (FE §255); trash = soft delete + undo + admin recovery (FE §256).
- Garage: grid/list persistence, pinned-first, cards/list columns, filters All/Artifacts/Files/Research/Pinned/Recent (FE §87–90); FileSyncIcon nine states already built — wire to real data (FE §189).
- **Exit:** live-built diagram animates from event stream and settles; version compare works on doc+diagram fixtures; every artifact type renders or degrades gracefully.

### P7 — Approvals & GitHub (FE §159–165; BE §78/§78A/§113)
- Generic approvals wired to real `ai_actions`: list pending for group, ApprovalCard already spec-exact — bind Approve to POST submitting displayed hash+version; on EXPIRED response → re-fetch → fresh card (FE §164A.2–.4).
- GitHub panel: connection status states (FE §165), owner/repo/branch, last synced, public-read vs write distinction (never imply a URL grants write — FE §160).
- GitHubDiffViewer driven by real action payload (file tree, hunks, additions/deletions, syntax highlight, collapse, copy, PR preview — FE §162); approval dialog enumerates exact effects (FE §163); merge confirm dialog (FE §164) gated by `github_merge` flag (FE §165A).
- Approval requests surface as chat cards mid-stream AND in the approvals surface + notification category AI_ACTION_APPROVAL (P10 link).
- **Exit:** demo flow propose→approve→executing→succeeded with result link; stale-hash path shows expiry card and recovers; reject renders collapsed attribution.

### P8 — Tasks, Decisions, Memory, Pulse (FE §83–86, §112–122, §116–118)
- Tasks: card anatomy title/owner/status/priority/due/related-decision (FE §119); create-from-message prefilled form keeping source link (FE §121); optimistic status updates with 409-conflict reconcile (BE §21.2); project-scoped defaults (FE §270).
- Decisions: numbered cards w/ status/reason/sources/approved-by (FE §120); propose-from-message default PROPOSED (FE §122); approve/reject actions per permissions.
- Memory: Group/Project/Private sections, typed cards DECISION/CONSTRAINT/CONVENTION/PREFERENCE/FINDING/LESSON with source/scope/timestamps (FE §116); candidate accept/dismiss via endpoints (FE §117); "Remember this" scope chooser defaulting to Project (FE §118).
- Project Overview/Pulse: goal, progress marker animating once on change (FE §84/§85), current focus, blocked, next, open decisions, active tasks, recent artifacts/activity, GitHub status (FE §83). Never a cluttered dashboard (FE §325.20).
- **Exit:** all views run against demo API incl. error/empty/offline states; conflict-on-edit path surfaces §186 card.

### P9 — Meetings (FE §123–128; BE §50/§50A/§112)
- Start dialog → POST meeting → header timer/pause/end (FE §126, §123); MeetingPanel fed by meeting_candidates stream with full §124A lifecycle (already built UI — wire to events; accept waits for promotion confirmation before collapsing).
- Facilitation messages arrive as normal AI conversation (FE §125/§151); proactivity cooldowns respected (FE §263).
- End → summary review listing counts; unresolved PENDING candidates included in review; only explicitly skipped become EXPIRED (FE §124A.3/§127); save creates Garage artifact from summary (FE §128).
- Flag-gated entry point hidden entirely when meeting_mode off (FE §165A.2).
- **Exit:** demo meeting produces candidates of all six types incl. contradiction inline treatment; end-review promotes/skips correctly; summary artifact appears in Garage.

### P10 — Notifications & Activity (FE §36, §171A, §172–174; BE §95A)
- Activity view = mentions/replies/reactions/approvals/task assignments/key AI events only (FE §172), backed by notifications + activity queries; unread badge counts (FE §277).
- Preferences matrix per exact category ids × In-app/Desktop(client-derived)/Email (FE §171; BE §95A prefs table).
- OS notifications via bridge for important categories only (mention/private/approval/task/critical system — FE §174); permission requested at a clear moment (FE §194); content-hidden preview option (FE §278); batching when away (FE §173).
- Deep links from notification → route resolution → load → scroll → brief highlight (FE §177/§247).
- delivery_state exposed verbatim in Sync Diagnostics (FE §171A/§285).
- **Exit:** mention triggers badge+OS notif per prefs; suppressed vs failed distinguishable in diagnostics; deep-link lands scrolled+highlighted.

### P11 — Offline & sync engine (FE §182–186A, §190, §198; BE §20/§20A/§21)
- Real connectivity detection (navigator.onLine + WS heartbeat) driving status store (G4 fix).
- Durable queue in idb mirroring sync_operations semantics; replay on reconnect in order; identical client_operation_id reused across retries (BE §19/§186A.2); REJECTED ops show dismissible errors, never silent drops (FE §186A.2).
- Checkpoint persistence per device+group; reconnect sends checkpoint, applies missing events, then pushes ops (BE §20.2); sequence-gap healing mid-session.
- Conflicts: server conflict rows → §186A.3 type-specific copy (already built) with correct narrow deleted_upstream actions; resolutions write back through the same row (§186A.4).
- Crash recovery: restart restores drafts, pending ops, last group/project, unresolved conflicts surfaced (FE §198).
- Offline affordances: cached projects/conversations/artifacts readable; cloud-AI/web/GitHub clearly unavailable without looking broken (FE §182/§238/§239); offline composer queue chip already present (FE §183/§184).
- **Exit:** scripted offline scenario passes E2E: queue edits/messages → reconnect → applied or conflict-carded; kill-and-restart preserves everything (FE §315).

### P12 — Settings completeness (FE §166–170, §156–158, §279–284; BE §107)
- Two-column settings architecture with the FE §166 section list; section-level save for AI/GitHub/permissions, auto-save where safe, dirty indicator (FE §279/§280).
- Members admin: invite (email + link, revoke), role changes, removal dialog copy (FE §230), ownership transfer dialog (FE §229) — Owner-only controls hidden otherwise (FE rule 25).
- AI settings: identity rename/avatar (FE §129/§73), personality presets + custom instructions (FE §168), provider BYOK flow with Test connection states and never-revealed keys (FE §156/§157), model routes PRIMARY+FALLBACK1-3 (BE §32), search provider test (FE §158), permissions toggles (FE §169), proactivity Off/Low/Balanced/High default Balanced (FE §150), quota/usage view (BE §131).
- Danger zone separated visually/structurally: group deletion explains recovery window (FE §228/§282); GitHub disconnect + BYOK removal explain consequences (FE §231/§232).
- Appearance: group avatar upload/generated initials (FE §274); theme light/dark/system.
- **Exit:** admin vs member vs guest see exactly their permitted sections; every mutation has saving/error/success feedback.

### P13 — Accessibility & motion polish (FE §7, §217–222, §314)
- Audit pass: focus-visible everywhere via token ring; accessible names on all icon-only controls; dialogs/popovers trap + restore focus; live regions for streaming/meeting/new-message aggregates only.
- Targets ≥24×24 floor (FE §221); contrast checks incl. spectral never sole signifier (FE §222); no essential drag-only op (panel resize keyboard done; verify all others).
- Reduced-motion QA sweep per FE §314 checklist; motion budget compliance (durations from tokens only).
- **Exit:** axe-clean critical flows; keyboard-only task completion script passes end-to-end.

### P14 — Performance hardening (FE §201–206, §288–291, §318)
- Budgets: composer typing zero jank (animations never block input — FE §288), scroll 60fps virtualized, view switch <150ms perceived, message arrival <100ms apply, streaming isolated per component, artifact updates incremental.
- Lazy chunks: pdfjs, xyflow, recharts, settings sub-pages, Garage viewers. Route-level code splitting.
- Load fixtures: 10k+ messages, long AI responses, large diagrams, many presence events, rapid reactions, concurrent uploads (FE §318 suite as automated perf smoke where feasible).
- **Exit:** perf smoke green in CI; no full-screen universal spinner anywhere (FE §325.15).

### P15 — Security review, packaging & final acceptance
- Security sweep vs FE §292–298: no URL-param trust, sanitized rendering audit, sandboxed interactive artifacts, no BYOK storage, external links validated, local Git never destructive silently (FE §298).
- Tauri: capabilities least-privilege review; local-folder scoping solution for FE §187 (scoped fs permissions or dedicated Rust command returning picked-folder contents only); updater flow verified incl. no interrupt during meetings (FE §309); window-state restore.
- Protocol version handling verified against real connect handshake (FE §309A).
- Run ALL acceptance checklists: main chat (FE §320), artifact (§321), onboarding (§322 — polish onboarding/demo animation per FE §69–76 within reduced-motion rules), settings (§323), backend contract comprehension (§324).
- UX review questions FE §319 answered for every screen; "Do Not Ship" list FE §325 audited item by item.
- Production build + signed-update pipeline notes; README runbook (envs, demo mode, integration checklist).

---

## 9. Component Definition of Done (applies to every component, FE §311)

- [ ] Typed props; no domain logic outside its feature controller; no direct api/ws/tauri calls
- [ ] Supports the relevant states of the FE §207 matrix (+ specific matrices §208–216 where applicable)
- [ ] Empty/loading/error/offline/permission-denied states present where meaningful
- [ ] Keyboard operable; visible focus; accessible name; tooltips on icon-only controls (FE §64)
- [ ] Reduced-motion behavior defined (FE §6)
- [ ] Copy follows FE §224–227 tone rules ("what happened → what is safe → next action")
- [ ] Unit test for its critical interaction; visual snapshot for FE §312 screens

## 10. State Rules Recap

| State kind | Home | Examples |
|---|---|---|
| Server cache | TanStack Query | messages page, members, artifacts, ai_runs, notifications |
| Realtime ephemeral | dispatch → query patches / small zustand | typing, presence, streaming deltas |
| UI preference | zustand persist (account-scoped key) | theme, panel widths, garage view mode |
| Draft | idb scoped user:group:scope | composer text, reply target |
| Sync queue | idb mirror + zustand | pending ops, conflicts, checkpoints |
| Session | Supabase SDK + auth store | tokens, profile |

## 11. Verification Commands (run every phase exit)

```bash
pnpm --dir clanmind-frontend lint          # oxlint
pnpm --dir clanmind-frontend exec tsc -b   # typecheck (via build script too)
pnpm --dir clanmind-frontend test          # vitest run
pnpm --dir clanmind-frontend build         # tsc -b && vite build
pnpm --dir clanmind-frontend exec playwright test   # once P2 lands
grep -r "mockAiService\\|user_arun_1\\|grp_robotics_1" clanmind-frontend/dist/assets  # must be empty after P0
```

## 12. Risk Register (honest)

| Risk | Mitigation |
|---|---|
| Backend contract drift while building in parallel | Zod boundary + INTEGRATION_NOTES ledger + demo-mode determinism; smoke checklist on first live contact |
| AppShell decomposition regressions | Pure mechanical extractions first (no behavior change), tests before/after each extraction |
| Virtualization vs unread-divider/anchor complexity | Prototype anchor math early in P3 behind fixture tests before migrating whole list |
| Tauri SPA-fallback routing | Verify in P0 on built binary; HashRouter single-point fallback documented |
| Local-folder fs capability gap (G14) | Isolate behind bridge function; Rust command approach if scopes can't be granted dynamically |
| Streaming perf regressions | Render-counter tests from P5 onward; deltas isolated by design |
| Scope creep into "everything at once" | Phase gates are hard; each phase exits green before next begins |

**Execution starts at P0. This file is updated only if a spec changes — never to rationalize drift from it.**
