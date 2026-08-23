# HANDOFF — ClanMind Frontend Build (P0 in progress, ~90% complete)

> **Read this first, then `clanmind-frontend/FRONTEND_BUILD_BIBLE.md`, then the two specs.**
> This document transfers an in-progress build from one agent to another.
> Workspace root: this folder (`ClanMind/`). Frontend app: `clanmind-frontend/`.

---

## 0. Authority chain (never violate)

1. `ClanMind_Frontend_Master_Implementation_Specification.md` — UX/frontend authority ("FE §n"), 4,329 lines
2. `ClanMind Backend — Master Implementation Specification.md` — API/data/realtime contract authority ("BE §n"), 6,171 lines
3. `clanmind-frontend/FRONTEND_BUILD_BIBLE.md` — my execution plan: 12 engineering rules, architecture, locked tech stack, backend contract sheet (§5), parallel-dev protocol (§6), refactor mandates R1–R5 (§7), phases P0–P15 with exit criteria (§8)
4. `clanmind-frontend/INTEGRATION_NOTES.md` — append-only ledger of contract decisions (D1–D4) + open questions Q1–Q3 for the backend stream

**A separate AI is building the backend concurrently** (Cloudflare Workers + Supabase; migrations already exist under `clanmind-backend/supabase/migrations/`). The frontend runs fully without it via demo mode.

---

## 1. Environment facts

| Fact | Value |
|---|---|
| Package manager | pnpm (v10.x). App has its own lockfile inside `clanmind-frontend/` |
| Install/run | `pnpm install` then any of: `pnpm dev` / `pnpm test` / `pnpm run lint` / `pnpm exec tsc -b` / `pnpm run build` — all inside `clanmind-frontend/` |
| Stack | React 19 + TS 6 strict + Vite 8 (rolldown) + Tailwind v4 (@theme) + Radix + zustand 5 + TanStack Query 5 + **react-router v8** (`createBrowserRouter` API, same as v7) |
| New deps added this session | react-router@8, @supabase/supabase-js, idb, @tanstack/react-virtual, date-fns |
| Demo mode | `.env.development` sets `VITE_DEMO_MODE=1`. Compile-time gate via vite `define`: `__DEMO_MODE__` → production builds tree-shake ALL of `src/mocks` (verified: no mocks chunk, grep-clean) |
| Baseline when healthy | tsc ✅ · oxlint ✅ (only pre-existing fast-refresh warnings) · vitest 21/21 ✅ · build ✅ |

### ⚠️ Tooling gotchas learned the hard way
- **Do NOT edit files with PowerShell `-replace`/`Set-Content` for content containing `§`, `—`, emoji.** It corrupts encoding (mojibake like `?11 ?`). Use file-edit tools only. Two corrupted comments were repaired manually; if you see `?11 ?`-style text anywhere, fix with a proper edit tool.
- `rg` is not installed on this machine; use the Grep tool or `Select-String`.
- Vitest takes ~45s locally (slow jsdom setup) — normal.

---

## 2. What was DONE this session (all verified)

### Created — integration spine
| File | Purpose |
|---|---|
| `src/config/env.ts` | Fail-fast env validation; exports `env{apiBaseUrl, wsUrl, supabaseUrl, key, appVersion, demoMode}`, `assertLiveConfig()` |
| `src/api/errors.ts` | `ApiError{code,status,requestId,details}` (BE §102), `NetworkError`, `AbortedError`, `isTransientFailure()` per BE §121 |
| `src/api/schemas.ts` | Zod wire contracts (profile/group/member/project/message+page/ai-run/tool-call/ai-action/task/decision/memory/meeting-candidate/notification/version-meta/feature-flags/error-envelope). Tolerance policy: `.passthrough()`, enums as strings so unknown values hit Unsupported-state UI (FE §200 pattern), never crash |
| `src/api/transport.ts` | ONLY fetch site. `createFetchTransport` (bearer, Idempotency-Key + X-Client-Operation-Id per BE §19, X-Request-Id per BE §101, timeout via AbortController), `setTransportOverride()` for demo |
| `src/api/client.ts` | `request<T>(path,{schema,...})` + get/post/patch/delete. Retries transient only (mutations safe via idempotency key), backoff+jitter, schema validation errors → `CONTRACT_VIOLATION` ApiError |
| `src/realtime/events.ts` | BE §17 envelope zod schema; S→C event vocabulary (BE §114); C→S builders (`hello/roomSubscribe/messageSend/typing/presence/aiCancel/syncRequest/syncAck`); `CLIENT_PROTOCOL_VERSION=1`; `ConnectionReadyPayloadSchema` for BE §165 metadata |
| `src/realtime/connection.ts` | `RealtimeClient` class: hello→ready handshake, room subscribe, heartbeat 25s + watchdog (2.5×+5s force-reconnect), exponential backoff+jitter (300ms→15s cap), per-group sequence tracking w/ gap detection → `onSequenceGap`, `CLIENT_UPDATE_REQUIRED` = userClosed hard stop (FE §309A.2), online/offline listeners on window, `onStatusChange()` subscription. `initRealtime()/getRealtime()` singletons |
| `src/sync/connectivity.ts` | Maps realtime status + navigator.onLine → syncStore status (`offline/reconnecting/connected/syncing`) driving SyncBanner truth (FE §185) |
| `src/local/db.ts` | Account-scoped IndexedDB (`cm_<userId>`): stores kv/drafts/sync_ops/messages(index by group+sequence); open/close/wipe per FE §283/§284 |
| `src/app/nav.ts` | Shared nav vocabulary (`NAV_SECTION_PATHS`, `sectionFromPathname`, `shellBasePath`) — avoids router↔AppShell cycle |
| `src/app/router.tsx` | Full route tree (FE §193): `/auth`, `/onboarding`, flat section routes `/group/:groupId/:section` and `/group/:groupId/project/:projectId/:section` (all render AppShell; shell reads URL), bare group/project paths redirect to chat, object deep links `/message|artifact|task|decision|meeting/:objectId` resolve via store lookup → navigate into context, guards RequireAuth/GuestOnly, RootRedirect (auth/onboarding rules FE §69), OnboardingRoute creates group+project then navigates |
| `src/features/chat/useChatController.ts` | **R1 extraction**: send pipeline (client_message_id → optimistic insert → offline queue w/ identical op-id reuse §186A.2 / delivered path POSTs to real endpoint + reconciles + failure keeps message §245), AI trigger creates §134A shell instantly and hands off to runtime socket events, §141 quota easter-egg preserved (`quota`/`byok` keywords), retryMessage reuses ids verbatim |
| `src/mocks/dataset.ts` | ALL fixture data (users/groups/projects/members/messages/tasks/decisions/memories/candidates/notifications/aiActions/artifacts incl. versions/flags) as fresh-factory `createDemoDataset()` |
| `src/mocks/wsHub.ts` | Demo Durable-Object stand-in: speaks exact envelope protocol, monotonic sequences (base 1420 matching checkpoint fixture), version-metadata handshake, `startAiRun()` broadcasting full §134A timeline as REAL socket events (status/tool loop recurring WAITING_TOOL/delta chunks at §135 cadence/artifact.event §75/completed), `cancelAiRun`, typing/presence/reaction broadcast helpers |
| `src/mocks/demoDispatch.ts` | Consumes validated envelopes from RealtimeClient → projects into stores (message echo deduped by id/client_message_id, ai.status/tool/delta accumulate body, artifact.created → addArtifact, completed finalizes + artifact run status COMPLETED, reaction.server-truth replaces optimism, typing windows) |
| `src/mocks/transportRoutes.ts` | Demo REST over dataset: me/auth-login(+signup)/groups/projects/messages(GET page cursor + POST persist-first-then-socket-echo + PATCH/DELETE)/ai-runs(POST schedules hub stream, cancel)/group flags/github status. Unknown routes → BE §102 404 envelope. 90–350ms latency jitter |
| `src/mocks/hydrate.ts` | Fills all zustand stores from dataset (demo only) |
| `src/mocks/runtime.ts` | `DemoRuntime` interface + registry — the ONLY seam runtime code uses for demo behavior |
| `src/mocks/index.ts` | `installDemoMode()`: transport override + hub + runtime + realtime init through same dispatch path + hydration |
| `.env.development` | `VITE_API_BASE_URL=/api/v1`, `VITE_DEMO_MODE=1` |

### Modified
- `vite.config.ts` — function-form config; `loadEnv`; defines `__APP_VERSION__` (from package.json) + `__DEMO_MODE__` (compile-time)
- `src/types/globals.d.ts` — declares both define-globals + typed ImportMetaEnv
- `src/main.tsx` — async boot: assertLiveConfig → `if (__DEMO_MODE__) dynamic-import installDemoMode()` → configureApiClient → render `<App/>`; fatal screen preserves "local drafts are safe" copy
- `src/App.tsx` — QueryClientProvider + ToastProvider + global ErrorBoundary around `RouterProvider` (router memoized); theme effect; connectivity init on auth (dynamic import getRealtime, try/catch for pre-P1 live)
- `src/features/shell/AppShell.tsx` — URL-authoritative context (useParams/useLocation; syncs groupStore selection FROM route), `navigateToSection()` replaces store setter everywhere (22 sites), chat send/retry delegated to controller, deep-link switch replaced by plain `navigate(route)` (router resolves), guard renders Loading-workspace state when route group missing, PanelResizer unchanged (keyboard resize intact)
- `src/state/*` — **stores emptied of fixtures** (group/chat/projectData/artifact/meeting all start empty; DEFAULT_FLAGS now all-false per FE §165A.1 "never assume enabled"; syncStore.checkpoint=null). uiStore: removed `activeNavSection` entirely (URL owns it)
- `src/features/auth/AuthScreen.tsx` — login/signup POST through api client (`/auth/login`, `/auth/signup`), typed ApiError handling (AUTH_INVALID_CREDENTIALS shows field error), no more mock-user creation
- Deleted `src/features/ai/mockAiService.ts` (superseded by hub+dispatch)

---

## 3. REMAINING WORK — finish P0 (small, do these FIRST)

### T1 — Purge last three hardcoded IDs (grep targets: `grp_robotics_1|user_arun_1|proj_flight_ctrl` outside `src/mocks/`)
1. `src/features/meetings/MeetingDialogs.tsx:26` — `startMeeting('grp_robotics_1','proj_flight_ctrl')`. Fix properly: give `MeetingStartDialog` optional props `{groupId?, projectId?}` OR read active context from useGroupStore inside it; AppShell passes nothing today — prefer reading store inside the dialog component (it already imports stores? verify).
2. `src/features/settings/SettingsView.tsx:~609` — `resolveConflict(id, strategy, 'user_arun_1')` → use `useAuthStore.getState().user?.id ?? ''`.
3. `src/mocks/index.ts:92` fallback `?? 'grp_robotics_1'` — harmless (demo-only) but simplify to `[ds.groups[0]?.id].filter(Boolean)`.

### T2 — Restore demo meeting richness
`INITIAL_CANDIDATES` was purged from useMeetingStore (now `[]`). Demo meetings would look empty. Fix in demo layer only:
- Add to `DemoRuntime`: `seedMeeting(sessionId: string): void`
- Implement in `src/mocks/index.ts`: push the six §124A candidate types (DECISION/TASK/CONTRADICTION/OPEN_QUESTION/RESEARCH_NEED/MILESTONE_CHANGE — original content strings are recoverable from git-less history? NO — recreate similar ones; they existed in useMeetingStore before purge: SPI DMA decision task, Priya 500Hz contradiction, flash-logging question, DMA-vs-I2C benchmark research need, milestone slip) + two live_notes into currentSession via useMeetingStore setState.
- Call site: where UI calls `startMeeting(...)` (find in MeetingDialogs/AppShell) → after startMeeting, `getDemoRuntime()?.seedMeeting(id)`.

### T3 — Verification loop until green (exact commands, run inside `clanmind-frontend/`)
```bash
pnpm exec tsc -b        # must be silent
pnpm run lint           # only pre-existing fast-refresh warnings allowed
pnpm test               # 21 passing baseline (may grow if you add tests)
pnpm run build          # succeeds; dist/assets must contain NO mocks chunk
# purity grep (bash):
grep -rlE "grp_robotics_1|user_arun_1|Robotics Core Team|mockAiService" dist/assets && echo FAIL || echo CLEAN
```

### T4 — Manual smoke (pnpm dev, browser at :1420)
login(any email / password ≠ 'wrongpass') → lands in Robotics chat → send normal msg (echoes once, no dup) → `@Odin …` streams via REAL socket events (tool timeline → deltas → artifact panel opens) → type `quota` msg → §141 card → wrongpass login shows inline error → navigate sections by URL, reload deep-link `/group/grp_robotics_1/settings` works → SyncBanner shows Reconnecting briefly then disappears.

### P0 EXIT CRITERIA (bible §8): all of T1–T4 done.

---

## 4. Then continue phases P1→P15 exactly as written in FRONTEND_BUILD_BIBLE §8

Order + highlights (full detail in bible):
- **P1 auth/session**: Supabase client (auth ONLY — domain data stays on `/api/v1`), session-expiry §197, account-switch wipe (local/db.wipeAccountDb), GET /me hydration
- **P2 responsive shell (FE §13)** — currently MISSING ENTIRELY; breakpoint controller ≥1440/1200–1439/900–1199/<900 sheets; Playwright setup lands here
- **P3 chat realtime core**: TanStack Query pages + @tanstack/react-virtual (10k target), WS dispatch module (promote demoDispatch pattern to production `src/realtime/dispatch.ts`), mentions caret-tracking fix (FE §60), `/private` recipient chooser (FE §55), threads, private-leakage automated test
- **P4 uploads/pdfjs · P5 AI streaming polish · P6 artifacts (@xyflow from `{nodes,edges}` BE §74, recharts, pdfjs-dist)**
- **P7 approvals/GitHub wiring · P8 tasks/memory/pulse · P9 meetings · P10 notifications · P11 sync engine (queue replay, checkpoints, conflicts)** · P12 settings · P13 a11y · P14 perf · P15 security/packaging

Backend-coordination rules: bible §6 (contract-first, INTEGRATION_NOTES ledger, smoke checklist). When real endpoints exist: set VITE_DEMO_MODE=0 + fill VITE_WS_URL/VITE_SUPABASE_* in `.env.production.local`.

---

## 5. Repository layout note (added at first push)

- `clanmind-backend/` was originally its own git repo. To publish it inside this
  monorepo, its inner `.git` was parked (NOT deleted) at
  `clanmind-backend/.git_disabled_for_monorepo_push/` (branch main @ `51dfe91`).
  Restore standalone-repo mode with:
  `Rename-Item clanmind-backend\.git_disabled_for_monorepo_push .git`
  (bash: `mv clanmind-backend/.git_disabled_for_monorepo_push clanmind-backend/.git`).
  That folder is gitignored; backend history is fully preserved on disk.
- Root `.gitignore` excludes node_modules/dist/Tauri target/gen-schemas/parked-git.

## 6. Known non-issues (don't "fix" these)

- oxlint fast-refresh warnings (Toast/router/AiStatusIndicator export style) — pre-existing, harmless
- `App-*.js` chunk ~700KB warning — P14 splits routes/lazy-viewers; ignore until then
- MeetingPanel/ApprovalCard/etc. tests construct their own data — they don't depend on purged seeds
- `react-router` v8 installed — createBrowserRouter/useParams/useNavigate APIs identical to v7 docs
- Windows machine currently; VPS likely Linux — all commands above are cross-platform pnpm scripts except the grep (use bash grep on VPS)
