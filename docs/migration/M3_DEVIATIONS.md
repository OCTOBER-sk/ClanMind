# ClanMind — M3 Migration Deviations

**Purpose:** Every rule deviation, contract gap, environmental issue, and pre-existing failure is recorded here so the migration never silently widens scope or hides a known issue.
**Authority:** Per PAKKA plan §1.4 + §37, deviations are visible to the human reviewer; nothing gets buried.

---

## Status legend

```text
PRE_EXISTING_FAILURE        — present before this migration; must be fixed during the relevant phase
PRE_EXISTING_ENVIRONMENTAL  — flaky/environment-dependent; not migration-blocking
PRE_EXISTING_BUILD_DEBT     — non-fatal build warnings; clean up opportunistically
GAP                          — feature/surface the spec calls for that the current code does not provide
CONTRACT                     — UI code currently relies on mock/static data where the real backend exists
DEFERRED                     — explicitly chosen not to do now; needs a human note explaining why
PHASE_BLOCKER                — must be resolved before the named phase can advance
```

---

## D-01 · PRE_EXISTING_FAILURE · `tokens.a11y.test.ts` — text-tertiary contrast

**Surface:** design-system tokens
**Where:** `src/index.css` light/dark variable blocks (was lines 104-107 and 155-158)
**Detail:** `--color-text-tertiary: #888888` (light) measures 3.54:1 on `--color-background: #ffffff` — below WCAG 2.2 AA 4.5:1. Dark variant `#666666` on `--color-background: #000000` is 5.74:1 — passes; but on `--color-surface: #080808` it measures 3.66:1 — fails.
**Spec:** FE §222 — "Normal text must retain appropriate contrast. WCAG 2.2 AA uses 4.5:1 for normal text and 3:1 for large text."
**Disposition:** ✅ **FIXED.** 2026-09-05, in the PHASE 0 acceptance follow-up. Light tertiary → `#6e6e6e` (5.17:1 on `#ffffff`); dark tertiary → `#8a8a8a` (6.74:1 on `#000000`, ~6.5:1 on `#080808`). Dark disabled → `#5a5a5a` (3.99:1, exempt per §222). `tokens.a11y.test.ts` now passes 36/36. Comments in `src/index.css` updated to document the change.
**Risk if not fixed:** Real accessibility regression for non-metadata use.

## D-02 · PRE_EXISTING_FAILURE · ApprovalCard / GitHubActionCard / GitHubDiffViewer (6 tests)

**Surface:** `src/features/approvals/`
**Detail:** The §164A / §163 contract for generic + GitHub-specialized approval cards is partially implemented; tests describe intended behavior not yet wired (reject busy-state reset, hash+version binding for non-GitHub kinds, narrow Reject without confirm, "Review Changes" → diff viewer route, merge dialog gating).
**Spec:** FE §164A (entire section), BE §78A, §78A.1, §164A.4.
**Disposition:** Fix during PHASE 4 (AI + Research + Approvals).
**Risk if not fixed:** Approval integrity — the central security guarantee — remains in test red. Do not block PHASE 0.

## D-03 · PRE_EXISTING_FAILURE · ArtifactPanel unknown-type card (1 test)

**Surface:** `src/features/artifacts/ArtifactPanel.tsx`
**Detail:** FE §200 requires the unsupported-artifact card to render without crashing.
**Spec:** FE §200, §291.
**Disposition:** Fix during PHASE 5 (Artifacts + Garage + Files).

## D-04 · PRE_EXISTING_FAILURE · AI streaming error card §140 (1 test)

**Surface:** `src/features/ai/AiErrorCard.tsx`, `aiStreamingUi.test.tsx`
**Detail:** FAILED-run → §140 error card with Retry / Try fallback actions.
**Spec:** FE §140, BE §121, §52/§57A.
**Disposition:** Fix during PHASE 4.

## D-05 · PRE_EXISTING_FAILURE · MemoryView "Remember this" + empty state (3 tests)

**Surface:** `src/features/memory/MemoryView.tsx`
**Detail:** FE §118 "Remember in: Project / Group / Private", with default Project inside a project; FE §179 empty-state pattern (what/why/next).
**Spec:** FE §118, §179, BE §35.
**Disposition:** Fix during PHASE 6 (Memory).

## D-06 · PRE_EXISTING_FAILURE · NotificationCenterPanel mark-all-read state machine (2 tests)

**Surface:** `src/features/notifications/NotificationCenterPanel.tsx`
**Detail:** FE §215 state coverage — enabled with unread items, disabled while mutating and when nothing is unread.
**Spec:** FE §207, §215, §171A.
**Disposition:** Fix during PHASE 7.

## D-07 · PRE_EXISTING_FAILURE · MeetingDialogs + MeetingPanel candidate lifecycle (9 tests)

**Surface:** `src/features/meetings/MeetingDialogs.tsx`, `MeetingPanel.tsx`
**Detail:** FE §126 start, §127 end, §124A candidate lifecycle (PENDING/ACCEPTED/REJECTED/MERGED/EXPIRED), RESEARCH_NEED → /research shortcut, Edit refines candidate, empty edit drafts blocked.
**Spec:** FE §124A, §126, §127, §128; BE §50, §50A.
**Disposition:** Fix during PHASE 6 (Meetings).

## D-08 · PRE_EXISTING_FAILURE · SyncConflictCard copy + resolution mapping (3 tests)

**Surface:** `src/features/sync/SyncConflictCard.tsx`
**Detail:** FE §186A.3 — `deleted_upstream` narrower action set, merged strategy after Compare, resolution strategies `server_wins / client_wins / merged / manual`.
**Spec:** FE §186A.3, §186A.4; BE §20A.
**Disposition:** Fix during PHASE 7 (Sync).

## D-09 · PRE_EXISTING_FAILURE · BYOK provider test (1 test)

**Surface:** `src/features/settings/SettingsView.tsx` BYOK flow
**Detail:** FE §157 states: Testing… → Connected · N models found; raw key wiped after validation.
**Spec:** FE §157, §156; BE §63, §64.
**Disposition:** Fix during PHASE 7 (Settings / BYOK).

## D-10 · PRE_EXISTING_FAILURE · TasksView interactions (1 test)

**Surface:** `src/features/tasks/TasksView.tsx`
**Detail:** status select, owner select and Done button each invoke their handler.
**Spec:** FE §119; BE §48.
**Disposition:** Fix during PHASE 6 (Tasks).

## D-11 · PRE_EXISTING_ENVIRONMENTAL · vitest worker timeouts (11 occurrences)

**Surface:** test runner
**Detail:** `Error: [vitest-pool-runner]: Timeout waiting for worker to respond` while fork pool tried to start isolated workers for several test files (`aiStreamingUi.test.tsx`, `p7Routes.test.ts`, `GitHubDiffViewer.test.tsx`, `p10Routes.test.ts`, `liveRuntime.test.ts`, `p9Routes.test.ts`, etc.) on Windows 11 + Node 20 + Vitest 4.1.
**Spec:** N/A — environmental.
**Disposition:** Not migration-blocking. Track separately; consider switching vitest pool to `threads` with higher `singleThread` timeout, or warm up the test DB fixture once. Not in scope for M3 migration.

## D-12 · PRE_EXISTING_BUILD_DEBT · chunking (2 advisories)

**Surface:** build output
**Detail:** `App.js` is 980 KB pre-gzip; `liveRuntime.ts` is both dynamically and statically imported, defeating the dynamic chunking intent.
**Spec:** N/A — build hygiene.
**Disposition:** Address during PHASE 1 (M3 Primitives) by code-splitting routes and removing the static import of `liveRuntime` from non-essential paths.

## D-13 · GAP · `github` and `context` sections missing from `NAV_SECTION_PATHS`

**Surface:** `src/app/nav.ts` + `MainNavSection` type in `src/state/useUiStore.ts`
**Detail:** `MainNavSection` includes `'github'` and `'context'`, but `NAV_SECTION_PATHS` (the array the router enumerates) does NOT include them. They are reachable only via `ProjectOverview` → "GitHub" or `GitHubActionCard` → "View Diff" deep links, not as first-class shell sections.
**Spec:** FE §82 Project navigation (Overview, Conversation, Artifacts, Tasks, Decisions, Context, GitHub); §159 (GitHub panel).
**Disposition:** Decide during PHASE 2 whether github/context are first-class shell sections (nav) or stay project-context deep links. Prefer the latter (already works via `ProjectOverview`); add `'context'` to nav only if the §115 Context Inspector is meant to be a first-class workspace.

## D-14 · GAP · baseline screenshot infrastructure

**Surface:** `docs/`
**Detail:** No Playwright / Chromatic / scripted visual capture. Hand-captured PNGs exist in `docs/screenshots/` and `docs/prekey-screenshots/` from prior sessions.
**Spec:** PAKKA §0.7 + §25.
**Disposition:** Set up Playwright (or similar) as the first step of PHASE 8 (Global Certification). Record the chosen tool and script in `M3_BASELINE.md` (revised).

## D-15 · CONTRACT · `ResearchDrawer` renders hard-coded mock data

**Surface:** `src/features/shell/AppShell.tsx` lines 1037–1065
**Detail:** When `rightPanelMode === 'research'`, `AppShell` constructs a `ResearchDrawer` with hard-coded `topic`, `summary`, `findings`, `sources` (an STM32H743 DMA SPI vs I2C example). The real backend BE §66 + BE §69 already provide research results and citations; the spec wants the drawer to render the **current** research from `aiRunsByMessage` for the active conversation.
**Spec:** FE §144, §146, §147; BE §66, §69.
**Disposition:** Fix during PHASE 4 (AI + Research + Approvals). Per Rule 0.4 this is a UI-side wiring fix (the data path exists); do NOT alter backend semantics.

## D-16 · CONTRACT · `Button variant="spectral"` referenced without an implementation

**Surface:** `src/features/shell/AppShell.tsx` line 1173 (the `CLIENT_UPDATE_REQUIRED` blocking-state "Update now" button)
**Detail:** `Button size="lg" variant="spectral"` is called.
**Spec:** PAKKA §11 BUTTON ("Never use rainbow as permanent button fill"), FE §3.3.
**Disposition:** ✅ **RESOLVED BY INSPECTION.** 2026-09-05. `Button.tsx` lines 6, 59-60 define the `spectral` variant as `spectral-active text-white font-medium shadow-[var(--shadow-sm)] hover:opacity-95 active:opacity-90`. The only call site is the §309A.2 full-screen `CLIENT_UPDATE_REQUIRED` blocking state — a one-time critical action surface, not a permanent button fill. This is consistent with FE §3.3 (spectral allowed for: AI active, AI generation, artifact construction, progress, selected, **onboarding moments**; full-screen protocol update is a brand-moment equivalent). No code change required.

## D-17 · DEFERRED · mocks/ runtime (5,500+ LOC) stays in the bundle

**Surface:** `src/mocks/`
**Detail:** `liveRuntime.ts` is statically imported by `groups.ts`, `projects.ts`, and `AppShell.tsx`. Production bundles therefore include the demo hub. This was deliberate (it lets the demo run synchronously) but is the reason `App.js` is 980 KB.
**Disposition:** Defer code-splitting to PHASE 1. Migration is not blocked.

## D-18 · DEFERRED · shape scale uses existing names (sm/md/lg/xl/2xl) instead of PAKKA §TASK 0.14 (none/xs/sm/md/lg/xl/full)

**Surface:** `src/index.css` lines 51-55, all components consuming `var(--radius-*)`
**Detail:** PAKKA §TASK 0.14 prescribes `none 0 / xs 4 / sm 8 / md 12 / lg 16 / xl 28 / full 9999`. The current scale is `sm 4 / md 8 / lg 12 / xl 16 / 2xl 24`. The values match the M3 intent (sm=4=xs, md=8=sm, lg=12=md, xl=16=lg, 2xl=24=xl) but the names do not.
**Spec:** PAKKA §TASK 0.14.
**Disposition:** Defer the rename to PHASE 0 Task 0.14 (shape tokens) — that is the formal home for the rename. PHASE 1 Unit 1 (Button) uses the existing scale values directly so `tokens.a11y.test.ts` strict-guard stays green and the 30 call sites compile unchanged.
**Risk if not fixed:** Cosmetic — no functional impact. The Button's M3 shape contract is satisfied (sm=4 / md=8 / lg=12).
**Trigger to fix:** Land PAKKA §TASK 0.14 (shape tokens) as a separate migration row. Once that lands, the Button (and every other primitive consuming `var(--radius-*)`) needs a follow-up rename pass.
