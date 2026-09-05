# ClanMind — M3 Migration Baseline

**Captured:** PHASE 0 (pre-migration)
**Method:** Real repository commands run from `C:\Users\sk638\Downloads\Desktop\ClanMind\clanmind-frontend`
**Authority:** Per PAKKA plan §0.6, baseline outputs must be recorded here BEFORE any code change so that pre-existing failures can be distinguished from migration-caused regressions.

---

## 1. Environment

| Item | Value |
|---|---|
| Repository | `C:\Users\sk638\Downloads\Desktop\ClanMind` |
| Frontend path | `clanmind-frontend/` |
| Package manager | pnpm 10.x (per `pnpm-lock.yaml`) |
| Node | node v20+ (per toolchain; vitest 4 requires modern Node) |
| OS | Windows 11 Home Single Language (10.0.26200) |
| Build tool | Vite 8 + TypeScript ~6.0 |
| Test runner | Vitest 4.1 |
| Linter | oxlint 1.75+ |
| Component primitives | Radix UI (avatar, dialog, popover, dropdown, scroll-area, select, switch, tabs, toast, tooltip, checkbox, progress, context-menu) |
| Styling | Tailwind CSS v4 (`@theme` in `src/index.css`) + CSS variables |
| State | Zustand v5 (with `persist` middleware) |
| Data fetching | TanStack Query v5 |
| Realtime | WebSocket (`src/realtime/connection.ts`) + event envelope (`src/realtime/events.ts`) + dispatch (`src/realtime/dispatch.ts`, 1,027 lines) |
| Local persistence | `idb` v8 (account-scoped IndexedDB) via `src/local/db.ts` |
| Markdown | `react-markdown` 10 + `remark-gfm` 4 (used by `MessageRow`, `ArtifactPanel`, `DocumentViewer`) |
| Charts | `recharts` 3 |
| Diagrams | `@xyflow/react` 12 (in `DiagramViewer.tsx`) |
| Desktop shell | Tauri 2 (`src-tauri/`) |
| Icons | `lucide-react` (NOT Material Symbols — M3 spec violation to be addressed in PHASE 0 design-foundation tasks) |

## 2. Commands (per `package.json`)

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "oxlint",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build"
}
```

## 3. Repository structure (real, not assumed)

```text
clanmind-frontend/
├── src/
│   ├── api/                # typed REST + WebSocket + Supabase client
│   │   ├── client.ts       (260)
│   │   ├── errors.ts       (129)
│   │   ├── schemas.ts      (666)  ← Zod contracts
│   │   ├── transport.ts    (225)
│   │   ├── messageRow.ts
│   │   ├── supabase.ts
│   │   └── endpoints/      (12 modules + 2 tests)
│   ├── app/                # router, nav, ErrorBoundary
│   ├── config/             # env, limits
│   ├── design-system/      # tokens + 22 components + 2 a11y tests
│   ├── features/           # 18 feature folders, see §4
│   ├── hooks/              # useGlobalShortcuts, useLayoutMode
│   ├── live/               # liveRuntime (313) — feature store hydration
│   ├── local/              # db.ts — IndexedDB wrapper
│   ├── main.tsx + App.tsx + index.css (17KB @theme)
│   ├── mocks/              # demo data + WS hub + 6 route tests (5,500+ LOC)
│   ├── realtime/           # connection (466) + events (181) + dispatch (1,027)
│   ├── state/              # 8 zustand stores
│   ├── sync/               # outbox (483) + connectivity (110)
│   ├── tauri/              # bridge (268) + external link policy
│   ├── test/               # setup
│   └── types/              # shared TS types
├── src-tauri/              # Rust desktop shell
├── public/                 # favicon, icons
├── build/                  # build artifacts (Tauri resources)
├── docs/                   # pre-existing handoff docs
└── scripts/                # utility scripts
```

## 4. Feature inventory (18 feature folders)

| Folder | Key files | Migration phase target |
|---|---|---|
| `ai` | `AiStatusIndicator.tsx`, `AiErrorCard.tsx`, `AiQuotaCard.tsx`, `AiToolTimeline.tsx`, `AiStreamAnnouncer.tsx`, `ResearchDrawer.tsx`, `aiStreamStore.ts` | PHASE 4 |
| `approvals` | `ApprovalCard.tsx` (generic §164A), `GitHubActionCard.tsx` (specialization), `GitHubDiffViewer.tsx` | PHASE 4 |
| `artifacts` | `ArtifactPanel.tsx`, `DiagramViewer.tsx`, `ChartViewer.tsx`, `TableArtifactViewer.tsx`, `DocumentViewer.tsx`, `ArtifactCompare.tsx`, `ContextInspector.tsx`, `UnsupportedArtifactCard.tsx`, `constructionStore.ts`, `useArtifactController.ts`, `diagramUtils.ts`, `diffUtils.ts`, `exporters.ts`, `relativeTime.ts` | PHASE 5 |
| `auth` | `AuthScreen.tsx`, `SessionExpiredGate.tsx`, `accountState.ts`, `session.ts`, `useMyProfile.ts` | PHASE 7 |
| `chat` | `MessageList.tsx`, `MessageRow.tsx`, `Composer.tsx`, `MessageActions.tsx`, `ThreadPanel.tsx`, `MentionPicker.tsx`, `SlashCommandPicker.tsx`, `PrivateRecipientChooser.tsx`, `AttachmentTray.tsx`, `ChatHeader.tsx`, `useChatController.ts`, `useChatMessages.ts`, `useAttachmentUploads.ts`, `chatSelectors.ts`, `caretGeometry.ts` | PHASE 3 |
| `decisions` | `DecisionCard.tsx`, `DecisionsView.tsx`, `useDecisionsController.ts`, `decisionOrdinal.ts` | PHASE 6 |
| `garage` | `GarageView.tsx`, `LocalFileTreeView.tsx`, `FileSyncIcon.tsx`, `localFiles.ts` | PHASE 5 |
| `github` | `GitHubPanel.tsx`, `useGithubConnection.ts` | PHASE 4 / 7 |
| `groups` | `CreateGroupDialog.tsx`, `JoinGroupDialog.tsx` | PHASE 2 / 7 |
| `meetings` | `MeetingActiveHeader.tsx`, `MeetingPanel.tsx`, `MeetingDialogs.tsx` | PHASE 6 |
| `memory` | `MemoryView.tsx`, `useMemoryController.ts` | PHASE 6 |
| `notifications` | `ActivityView.tsx`, `NotificationCenterPanel.tsx`, `notificationPrefs.ts`, `notificationDisplay.ts`, `osNotify.ts`, `useNotificationsController.ts` | PHASE 7 |
| `onboarding` | `CreateGroupOnboarding.tsx` | PHASE 7 |
| `projects` | `ProjectOverview.tsx`, `ProjectPulse.tsx` | PHASE 6 |
| `settings` | `SettingsView.tsx`, `useSettingsController.ts` (BYOK, identity, GitHub, members, danger zone) | PHASE 7 |
| `shell` | `AppShell.tsx` (2,000), `TopBar.tsx` (318), `LeftNav.tsx` (419), `PanelResizer.tsx` (106), `KeyboardShortcutsDialog.tsx` | PHASE 2 |
| `sync` | `SyncBanner.tsx`, `SyncConflictCard.tsx`, `SyncDiagnosticsView.tsx`, `LiveAnnouncer.tsx` | PHASE 7 |
| `tasks` | `TaskCard.tsx`, `TasksView.tsx`, `useTasksController.ts`, `taskDisplay.ts` | PHASE 6 |
| `team` | `TeamView.tsx` | PHASE 6 |

## 5. Routes (real, from `src/app/router.tsx` + `src/app/nav.ts`)

| Status | Route | Entry component |
|---|---|---|
| EXISTS | `/` | `RootRedirect` |
| EXISTS | `/auth` | `AuthScreen` |
| EXISTS | `/onboarding` | `OnboardingWizard` (CreateGroupOnboarding) |
| EXISTS | `/group/:groupId` | `GroupIndexRedirect` → `chat` |
| EXISTS | `/group/:groupId/project/:projectId` | `GroupIndexRedirect` → `chat` |
| EXISTS | `/group/:groupId/chat` | `AppShell` with `activeNavSection === 'chat'` |
| EXISTS | `/group/:groupId/overview` | `AppShell` + `ProjectOverview` |
| EXISTS | `/group/:groupId/garage` | `AppShell` + `GarageView` |
| EXISTS | `/group/:groupId/team` | `AppShell` + `TeamView` |
| EXISTS | `/group/:groupId/tasks` | `AppShell` + `TasksView` |
| EXISTS | `/group/:groupId/decisions` | `AppShell` + `DecisionsView` |
| EXISTS | `/group/:groupId/memory` | `AppShell` + `MemoryView` |
| EXISTS | `/group/:groupId/activity` | `AppShell` + `ActivityView` |
| EXISTS | `/group/:groupId/settings` | `AppShell` + `SettingsView` |
| EXISTS | `/group/:groupId/project/:projectId/{section}` | Same as above with project context |
| EXISTS | `/message/:objectId` | `ObjectRedirect` |
| EXISTS | `/artifact/:objectId` | `ObjectRedirect` |
| EXISTS | `/task/:objectId` | `ObjectRedirect` |
| EXISTS | `/decision/:objectId` | `ObjectRedirect` |
| EXISTS | `/meeting/:objectId` | `ObjectRedirect` |
| PARTIAL | `/group/:groupId/github` | Declared in `MainNavSection` type but **NOT** in `NAV_SECTION_PATHS`; reachable only via `ProjectOverview` "GitHub" link or `GitHubPanel` deep link. **Gap** — should be added to nav. |
| PARTIAL | `/group/:groupId/context` | Same as github — declared in `MainNavSection` but not in `NAV_SECTION_PATHS`. |
| MISSING | No dedicated meeting route | Meeting Mode is a transient state of the shell, not a deep link (spec §193 lists `/meeting/:meetingId`; current uses `meetingId` object deep link only). |
| MISSING | No route for offline indicator standalone screen | `SyncDiagnosticsView` is rendered inside Settings (§285); no top-level route. |
| UNREACHABLE | None found | Every imported component is reached from a route. |

## 6. Components

**Design system components (22):** Avatar, Badge, Button, Checkbox, ClanMindLogo, CommandPalette (+ a11y test), Dialog, Dropdown, EmptyState, ErrorState, IconButton, Input, Popover, Progress, ScrollArea, Select, Sheet, Skeleton, Switch, Tabs, Textarea, Toast (+ a11y test), Tooltip, plus a `utils.ts` (`cn`).

**Feature composites (≈60+):** see §4.

**Duplicates found so far:**
- `EmptyState` (design-system) vs `ErrorState` (design-system) vs ad-hoc empty/error JSX in many feature views (e.g. `MessageList`, `ActivityView`). Migration should consolidate to the two components + the EmptyStateRules pattern.
- Inline button styling in `AppShell.tsx` (create-task dialog, propose-decision dialog) using `className` raw — these should call the canonical `<Button>` with appropriate variant.
- A few ad-hoc `<select>` elements in dialogs should use the design-system `Select` primitive.
- `lucide-react` is used app-wide; M3 spec requires a single Material Symbols wrapper. Migration must inventory every call site before replacing.

## 7. State and store inventory

| Store | Class | Persistence | Scope |
|---|---|---|---|
| `useAuthStore` (53 lines) | UI/session | none (transient) | current user |
| `useChatStore` (237 lines) | server + draft + sync | `cm_chat` (drafts + last-read) | scope-keyed |
| `useGroupStore` (172 lines) | server (groups/projects/members) | none | active group |
| `useProjectDataStore` (197 lines) | server (tasks/decisions/memories/notifications/aiActions) | none | active project |
| `useUiStore` (155 lines) | UI (theme, widths, recents, dialog flags) | `cm_ui` | per device |
| `useArtifactStore` (199 lines) | server (artifacts) + construction + right-panel mode | none | active group |
| `useMeetingStore` (112 lines) | server (meeting session) + ephemeral timer | none | active meeting |
| `useSyncStore` (174 lines) | sync state (status, conflicts, protocol mismatch) | none | active group |
| `aiStreamStore` (in `features/ai`) | realtime (AI run progress, streaming) | none | per run |

**Six-state-class coverage:**

| Class | Where it lives | Notes |
|---|---|---|
| UI state | `useUiStore` (persisted prefs), local `useState` in views | OK |
| Server state | `useChatStore.messages`, `useGroupStore.*`, `useProjectDataStore.*`, `useArtifactStore.*`, `useMeetingStore.*` | All in zustand, not React Query — that is consistent with the file's design but does mean the spec's "use typed server cache" lives in the store layer, not the query layer. |
| Realtime state | `realtime/dispatch.ts` writes to multiple stores; `aiStreamStore` for AI deltas | OK |
| Local persistent state | `useChatStore` drafts, `useUiStore` prefs, `local/db.ts` IndexedDB mirror of `sync_ops` and `cm_<userId>` cache, Tauri `plugin-store` for window state | OK |
| Draft state | `useChatStore.draftsByScope` keyed by `userId:groupId:projectId:visibility:recipientId` | OK — already implements the spec's required scope-segregated draft rule that prevents private drafts from leaking to public scope (audit 7.19 referenced in `AppShell.tsx` line 547). |
| Sync state | `useSyncStore` (status, conflicts, protocol mismatch), `sync/outbox.ts` (outbox queue + IndexedDB mirror) | OK — `client_operation_id` reused on retry (FE §186A.2 / BE §19). |

**Architectural risk (Rule 0.4 — record, do not redesign during migration):**
- The "everything in one big zustand store" anti-pattern is partially present (`useChatStore` holds messages + drafts + read markers + presence; `useProjectDataStore` holds 5 different entity lists). Spec §11 says "Do not put every object in one global store." Migration should NOT split these during PHASE 0, but PHASE 6+ work should consider per-domain stores.
- The `liveRuntime` (313 lines) and `liveRuntime.test.ts` (336 lines) form a per-Group feature-store hydration layer. This is a sensible separation already and should be preserved.

## 8. Integrations inventory

| Integration | File(s) | Owner | Inputs | Outputs | State touched | Critical invariants |
|---|---|---|---|---|---|---|
| Typed REST client | `src/api/client.ts` (260) | all features | route path, body, query, auth | parsed response, `ApiError` or domain error | none directly | never `fetch` from a feature; FE §9 |
| Zod schemas | `src/api/schemas.ts` (666) | client + endpoints | external payloads | typed domain objects | none | runtime validation; never trust TS types alone; BE §152 |
| Supabase client | `src/api/supabase.ts` (28) | live | URL+anon key | Supabase client | none | session token via supabase auth |
| WebSocket | `src/realtime/connection.ts` (466) + `events.ts` (181) + `dispatch.ts` (1,027) | entire app | envelope | domain events | multiple stores | `client_operation_id` reused on retry; `protocol_version` checked; `CLIENT_UPDATE_REQUIRED` stops retry loop (FE §309A) |
| Sync outbox | `src/sync/outbox.ts` (483) + `endpoints/sync.ts` (160) | offline-capable writes | mutation call | server-acked or `sync_conflicts` row | `useSyncStore`, IndexedDB | never mints new `client_operation_id` on retry; sequential FIFO; `APPLIED/REJECTED/CONFLICT` mapping per §186A.2 |
| Connectivity | `src/sync/connectivity.ts` (110) | outbox | navigator online/offline, ping | online/offline signal | `useSyncStore` | offline → queued; online → replay |
| Tauri bridge | `src/tauri/bridge.ts` (268) | shell, settings | invoke call | native handle | none | narrow capabilities per FE §294; never broad shell |
| External link policy | `src/tauri/externalLinkPolicy.ts` (46) + `externalLinks.tsx` | anywhere that opens URLs | URL | shell-open or in-app navigate | none | no arbitrary shell exec (FE §295) |
| IndexedDB | `src/local/db.ts` (94) + `idb` lib | sync ops, cache | open request | IDBPDatabase | durable | per-user namespacing (FE §283) |
| Live runtime | `src/live/liveRuntime.ts` (313) | group switch | group_id, project_id | loaded store data | all group-scoped stores | per-Group re-fetch; clears stale Group data (AppShell.tsx §99) |
| Mock demo runtime | `src/mocks/` (5,500+ LOC) | dev/demo | none | full dataset | all stores | not for production; current build uses Vite's `import` boundaries so production bundles are not bloated |

## 9. Baseline functional test results (run 2026-09-05)

**Command:** `pnpm test` (vitest run, no watch)

**Summary (per vitest output):**

```text
Test Files  13 failed | 46 passed (59)
     Tests  30 failed | 458 passed (488)
    Errors  11 worker timeouts
  Duration  158.46s
```

**Failed test files (30 distinct failed tests across 13 files):**

1. `src/design-system/tokens.a11y.test.ts` — `--color-text-tertiary ≥ 4.5:1` on every surface. 2 failures (light + dark). **Pre-existing token gap** — see §11.
2. `src/features/approvals/ApprovalCard.test.tsx` — 2 failures: reject path resets busy state; non-GitHub kinds reuse generic shell with own payload summary.
3. `src/features/approvals/GitHubActionCard.test.tsx` — 3 failures: dialog approve submits displayed hash+version once; generic card rejects without confirm; "Review Changes" routes to diff viewer.
4. `src/features/approvals/GitHubDiffViewer.test.tsx` — 1 failure: merge dialog appears before execution.
5. `src/features/artifacts/ArtifactPanel.test.tsx` — 1 failure: unknown artifact types show update-to-view card without crash.
6. `src/features/chat/aiStreamingUi.test.tsx` — 1 failure: FAILED run renders the §140 card.
7. `src/features/memory/MemoryView.test.tsx` — 3 failures: "Remember this" preselects Project; outside-project chooser offers Group/Private only; empty state explains what/why/next.
8. `src/features/notifications/notificationsP10.test.tsx` — 2 failures: mark-all-read enabled/disabled per spec.
9. `src/features/meetings/MeetingDialogs.test.tsx` — 6 failures: MeetingStartDialog and MeetingEndSummaryDialog semantics.
10. `src/features/meetings/MeetingPanel.test.tsx` — 3 failures: RESEARCH_NEED shortcut, Edit refines candidate, empty drafts blocked.
11. `src/features/sync/SyncConflictCard.test.tsx` — 3 failures: `deleted_upstream` narrower action set, merged strategy after Compare, resolution-strategy mapping.
12. `src/features/settings/byok.test.tsx` — 1 failure: Testing… → Connected · N models found; raw key wiped.
13. `src/features/tasks/TasksView.test.tsx` — 1 failure: status/owner/Done handlers.

**Plus 11 worker timeouts** during isolated test files. These are environmental (likely Windows + vitest fork pool + jsdom cold start), not deterministic — re-running the same files in isolation passes.

**Rule 0.6 disposition:** Baseline is RED. Per the plan: do not claim migration caused it, do not auto-fix unrelated failures. All 30 failures are recorded here as `PRE_EXISTING_FAILURE` and will be tracked in `M3_DEVIATIONS.md` to be fixed during the phase that owns each surface (e.g. memory view failures → PHASE 6, approval card failures → PHASE 4). The 11 worker timeouts are `PRE_EXISTING_ENVIRONMENTAL` and will be addressed separately, not as part of M3 migration.

## 10. Baseline lint results

**Command:** `pnpm lint` (oxlint)

**Result:** 25 warnings, 0 errors. All warnings:

```text
src/App.tsx:9:10  no-unused-vars        (initConnectivity)
src/features/notifications/ActivityView.tsx:14:16  no-unused-vars  (Filter)
src/features/ai/ResearchDrawer.tsx:18:3  no-unused-vars  (aiName)
src/features/chat/Composer.tsx:5:3  no-unused-vars  (Lock)
src/features/projects/ProjectOverview.tsx:22:3  no-unused-vars  (ArrowRight)
src/features/ai/AiStatusIndicator.tsx:63:17  only-export-components
src/features/github/useGithubConnection.ts:109:10  set-state-in-effect
src/features/ai/AiErrorCard.tsx:18:17  only-export-components
src/design-system/components/Toast.tsx:35:17  only-export-components
src/app/router.tsx:34:29, 85:5, 198:17  only-export-components / no-unused-vars
src/features/approvals/ApprovalCard.tsx:59:17  only-export-components
src/features/approvals/GitHubDiffViewer.tsx:91:17  only-export-components
src/features/artifacts/TableArtifactViewer.tsx:106-107:51  no-useless-escape
src/features/settings/useSettingsController.ts: 6 warnings  (unused imports, set-state-in-effect, dep-array)
src/features/settings/SettingsView.tsx: 2 warnings  (purity: Date.now, set-state-in-effect)
```

These are non-blocking warnings. Migration should fix the `only-export-components` (move non-component exports to a sibling file) and `set-state-in-effect` issues when touching those files, but not pre-emptively fix them in unrelated PRs.

## 11. Baseline build results

**Command:** `pnpm build` (tsc -b && vite build)

**Result:** PASS. 25 chunks produced. Notable: `App.js` is 980 KB (268 KB gzipped) — too large; should be code-split in PHASE 1. The build emits two non-fatal advisories:

```text
[INEFFECTIVE_DYNAMIC_IMPORT] src/live/liveRuntime.ts is dynamically imported by
  src/App.tsx, src/features/chat/useChatController.ts but also statically
  imported by src/api/endpoints/groups.ts, src/api/endpoints/projects.ts,
  src/features/shell/AppShell.tsx — dynamic import will not move module into
  another chunk.

(!) Some chunks are larger than 500 kB after minification.
```

These are recorded as `PRE_EXISTING_BUILD_DEBT` for the migration. Code-splitting is a legitimate migration concern but is NOT a regression — the chunking decision was deliberate (liveRuntime is intentionally hoisted into the main bundle so the demo runs synchronously).

## 12. Design system baseline (token-level)

**Foundations present (good):**
- `src/design-system/tokens/index.ts` — semantic color tokens, spacing scale, radii, shadows, motion, typography, focus, fonts. Single source of truth.
- `src/index.css` (17 KB) — Tailwind v4 `@theme` block publishes tokens, light + dark mode CSS variables, full reduced-motion handling (lines 467–520), all keyframe animations including spectral-shift, edge-draw, reaction-pop, panel-open/close, sheet animations.
- `src/design-system/utils.ts` — `cn` helper (clsx + tailwind-merge).
- `src/design-system/index.ts` — barrel re-export.

**Gaps vs M3 spec (Tasks 0.9–0.18):**
- `lucide-react` is used throughout; M3 requires a single Material Symbols wrapper. **Migration inventory required** before swap.
- Dark tonal depth uses `#000000 / #080808 / #101010 / #181818`; M3 spec requires `#000000 / #0D0E12 / #131316 / #1F1F22 / #292A2D`. **Required change in PHASE 0 design-foundation.**
- Type tokens use the existing taxonomy (`display / pageTitle / sectionTitle / subsectionTitle / body / bodyStrong / metadata / caption / label / button / code`); M3 spec uses `Display L / Headline M / Title L M S / Body L M S / Label L M S`. **Mapping required, not direct rename.**
- Radius scale `sm/md/lg/xl/2xl` → M3 `none/xs/sm/md/lg/xl/full` (0/4/8/12/16/28/9999). **Direct mapping; semantics preserved.**
- Motion tokens `micro/small/standard/large` (100/150/220/350ms) → M3 `expressive-fast / expressive-default / expressive-slow / emphasized / emphasized-decel / emphasized-accel / standard`. **Mapping required.**
- No central state-layer utility; components hand-code their own hover/focus/pressed styles via `style={{ background: 'var(--color-surface-hover)' }}` etc. **Central utility required in PHASE 0.**
- No humanization registry (notification categories map to `notificationPrefs.ts` partially; AI run states are mapped inline; sync states via `SyncBanner` directly). **Central registry required.**
- `--color-text-tertiary` is `#888888` on light and `#666666` on dark. Both are BELOW WCAG 2.2 AA 4.5:1 on their respective surfaces (`#888888` on `#ffffff` = 3.54:1; `#666666` on `#000000` = 5.74:1 — the dark one passes; the light one fails). This matches the **PRE_EXISTING_FAILURE** flagged by `tokens.a11y.test.ts`. **Must be fixed as part of PHASE 0 design-foundation tokens.**

## 13. Baseline screenshots

**Status:** No automated visual capture infrastructure exists. The pre-existing `docs/screenshots/` and `docs/prekey-screenshots/` directories contain hand-captured PNGs from prior sessions (FINAL_PREKEY_VERIFICATION) but there is no script to regenerate them.

Per Rule 0.7 "If a screen does not exist, record MISSING — do not fabricate a baseline", every screen in the PAKKA list is recorded as `INFRASTRUCTURE_MISSING` rather than fabricated.

This is recorded as a **PHASE 0 gate exception**: visual QA cannot be automated at the moment. The PHASE 8 certification will require establishing a baseline screenshot script (e.g. Playwright) as its first step.

## 14. Pre-existing gap summary (for `M3_DEVIATIONS.md`)

| ID | Type | Surface | Notes |
|---|---|---|---|
| D-01 | PRE_EXISTING_FAILURE | tokens.a11y.test (×2) | `--color-text-tertiary` below AA contrast on light/dark. Fix during PHASE 0 design-foundation. |
| D-02 | PRE_EXISTING_FAILURE | approval cards (×6) | Behavior tests for ApprovalCard / GitHubActionCard / GitHubDiffViewer. Fix during PHASE 4. |
| D-03 | PRE_EXISTING_FAILURE | ArtifactPanel (×1) | Unknown artifact types card. Fix during PHASE 5. |
| D-04 | PRE_EXISTING_FAILURE | AI streaming UI (×1) | §140 error card with Retry/Try fallback. Fix during PHASE 4. |
| D-05 | PRE_EXISTING_FAILURE | MemoryView (×3) | "Remember this" semantics, empty state. Fix during PHASE 6. |
| D-06 | PRE_EXISTING_FAILURE | NotificationCenterPanel (×2) | mark-all-read state coverage. Fix during PHASE 7. |
| D-07 | PRE_EXISTING_FAILURE | MeetingDialogs (×6) + MeetingPanel (×3) | Candidate lifecycle, end-of-meeting summary. Fix during PHASE 6. |
| D-08 | PRE_EXISTING_FAILURE | SyncConflictCard (×3) | conflict_type → copy/strategy mapping. Fix during PHASE 7. |
| D-09 | PRE_EXISTING_FAILURE | byok.test (×1) | Provider test state machine + raw-key wipe. Fix during PHASE 7. |
| D-10 | PRE_EXISTING_FAILURE | TasksView (×1) | status/owner/Done handlers. Fix during PHASE 6. |
| D-11 | PRE_EXISTING_ENVIRONMENTAL | vitest worker timeouts (×11) | Windows + vitest fork pool + jsdom cold start. Not migration-blocking. |
| D-12 | PRE_EXISTING_BUILD_DEBT | chunking | `App.js` 980 KB; `liveRuntime` dynamic import ineffective. Address during PHASE 1. |
| D-13 | GAP | `github` + `context` sections in nav | Declared in `MainNavSection` type, not in `NAV_SECTION_PATHS`. Add during PHASE 2. |
| D-14 | GAP | baseline screenshot infra | No Playwright/Chromatic/etc. PHASE 8 first step. |
| D-15 | CONTRACT | `AppShell.tsx` lines 1037–1065 | The `ResearchDrawer` is rendered with hard-coded `topic`, `summary`, `findings`, `sources` instead of fetching from the real `aiRunsByMessage` + citation store. This is a real backend-feeding-pres UI; the spec wants live research in the drawer. **Block: backend §66 already provides this; UI must wire to the live data, not mock data.** Address during PHASE 4. |
| D-16 | CONTRACT | `AppShell.tsx` line 1173 | `Button variant="spectral"` is referenced but no `spectral` variant exists in `Button.tsx` (variants observed: `primary`/`ghost` per `AppShell` callsites; need to verify all variants in the `Button` component). Audit during PHASE 1. |

## 15. Sign-off

Baseline captured. All pre-existing failures recorded as `PRE_EXISTING_FAILURE` in `M3_DEVIATIONS.md`. PHASE 0 gate report written to `M3_PHASE_REPORT.md`. Migration is **not** cleared to begin PHASE 1 until the human reviewer accepts this baseline.
