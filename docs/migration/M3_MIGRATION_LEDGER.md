# ClanMind — M3 / M3 Expressive Migration Ledger

**Status:** PHASE 0 — populated from real repository discovery
**Authority:** This file is the migration's source of truth for unit-level progress. The two master specifications remain the product authority.
**Owner:** Frontend migration agent (this session)

---

## Status values

```text
NOT_STARTED       — discovered but no work begun
INVENTORIED       — current implementation documented; allowed/forbidden files recorded
IN_PROGRESS       — actively being migrated
BLOCKED_BY_SPEC   — waiting on a master spec clarification
BLOCKED_BY_TEST   — waiting on a baseline test to be green first
READY_FOR_REVIEW  — gate criteria met, awaiting human acceptance
ACCEPTED          — human-accepted completion
```

`DONE` is never used. `ACCEPTED` requires an explicit gate pass.

---

## Surface index

| ID | Phase | Surface | Current implementation | Target | Status | Notes |
|---|---|---|---|---|---|---|
| M3-0001 | 0 | Design tokens (color, typography, shape, motion, elevation) | `src/design-system/tokens/index.ts`, `src/index.css` (Tailwind v4 `@theme`) | M3 token architecture (Section 10) | INVENTORIED | Tokens already exist; PHASE 0 design-foundation tasks will rewrite against M3 contract |
| M3-0002 | 0 | Dark theme base color | `src/index.css` | `#000000` pure black base with tonal depth `#000000 / #0D0E12 / #131316 / #1F1F22 / #292A2D` | INVENTORIED | Verify current `dark` base; replace if not pure black |
| M3-0003 | 0 | Light theme | `src/index.css` | Approved M3 light semantic role mapping | INVENTORIED | One component visual language, no parallel system |
| M3-0004 | 0 | Theme controller | `src/state/useUiStore.ts` (assumed) | `light / dark / system` with `prefers-color-scheme` and existing persistence preserved | INVENTORIED | Do not reset selected Group/Project/draft/panel on theme change |
| M3-0005 | 0 | Icon system | `lucide-react` throughout | Single Material Symbols wrapper; full migration inventory required | INVENTORIED | Do not globally delete before every call site is migrated |
| M3-0006 | 0 | Humanization registry | not present (per file enumeration) | Centralized mapper for AI run states / tool states / sync states / index states / notification categories / artifact types / permission errors / GitHub states / approval states / meeting candidate states | INVENTORIED | New registry; safe human fallback for unknown values |
| M3-0007 | 0 | Reduced-motion infrastructure | `src/hooks/useLayoutMode.ts` (and likely `MessageList.reducedMotion.test.tsx`) | Global `prefers-reduced-motion: reduce` handling | INVENTORIED | Verify coverage in onboarding, artifact construction, panel transitions, reactions, progress, AI streaming, Pulse, dialogs |
| M3-0008 | 0 | State-layer utility | not present (per file enumeration) | Centralized `hover 8% / focus 10% + ring / pressed 10% / dragged 16% / selected 10–12% / disabled 38% content / 12% container` | INVENTORIED | New utility; no per-component hand-coded state layers |
| M3-0009 | 0 | Tailwind v4 `@theme` | `src/index.css` | M3 token publication via `@theme` | INVENTORIED | Confirmed in `index.css` head |
| M3-0010 | 0 | Baseline functional tests | `pnpm build / pnpm lint / pnpm test` | Capture exact outputs into `M3_BASELINE.md` | ACCEPTED | Captured; 30 pre-existing failures recorded in `M3_DEVIATIONS.md` D-01..D-10. D-01 fixed in PHASE 0 follow-up; D-16 resolved by inspection. |
| M3-0011 | 0 | Baseline screenshots | none | Conditional — only if infra exists; otherwise record MISSING | INVENTORIED | Per Task 0.7. Recorded as D-14; PHASE 8 will set up Playwright. |
| M3-0012 | 0 | App shell inventory | `src/features/shell/AppShell.tsx`, `TopBar.tsx`, `LeftNav.tsx`, `PanelResizer.tsx`, `KeyboardShortcutsDialog.tsx` | PHASE 2 migration target | INVENTORIED | Phase 2 will decompose into AppShell / TopBar / GroupSwitcher / ProjectSwitcher / LeftNav / NavigationDrawer / RightSurfaceHost / PanelResizer / SyncBanner / NotificationCenter / GlobalCommandSurface |
| M3-0013 | 0 | Routes inventory | `src/app/router.tsx` | PHASE 0.2 enumeration; no route UNKNOWN | INVENTORIED | 9 sections + 5 object deep links; 2 GAP findings (D-13) — `github` + `context` in nav type but not in `NAV_SECTION_PATHS`. |
| M3-0014 | 0 | Components inventory | `src/design-system/components/*`, `src/features/**` | PHASE 0.3 enumeration | INVENTORIED | 22 design-system primitives + ≈60 feature composites; 5 duplicate candidates identified. |
| M3-0015 | 0 | State stores inventory | `src/state/useAuthStore.ts`, `useChatStore.ts`, `useGroupStore.ts`, `useProjectDataStore.ts`, `useSyncStore.ts`, `useUiStore.ts`, `useMeetingStore.ts`, `useArtifactStore.ts`, plus `aiStreamStore.ts` in features/ai | PHASE 0.4 enumeration | INVENTORIED | 9 stores total; six-state-class coverage recorded; `useChatStore` + `useProjectDataStore` flagged as architecturally dense (do not redesign during migration). |
| M3-0016 | 0 | Integrations inventory | `src/api/`, `src/realtime/`, `src/sync/`, `src/tauri/`, `src/local/`, `src/mocks/` | PHASE 0.5 enumeration | INVENTORIED | 11 integration seams inventoried. |
| M3-0017 | 0 | Existing tests | `src/**/*.test.{ts,tsx}` (many) | Confirm current test surface is green at baseline; record pre-existing failures | INVENTORIED | Vitest only; no Cypress/Playwright config observed. 458/488 baseline pass. |
| M3-0018 | 1 | Button primitive | `src/design-system/components/Button.tsx` (108 → 184 lines), `tokens/index.ts` (+`stateLayers`, +`hitArea`), `index.css` (+M3 state-layer overlay block, appended only — no modification to existing reduced-motion block) | M3 filled/tonal/outlined/text/elevated/FAB contract; 48dp hit area; M3 state layers; focus ring without radius snap; reduced-motion-safe loading | READY_FOR_REVIEW | PHASE 1 Unit 1. Universal task protocol A–O applied. **30 new tests** (Button.test.tsx + Button.a11y.test.tsx) all pass. Design-system suite 73/73 green. `tokens.a11y.test.ts` strict-guard caught one bug (--radius-xs) and was fixed. Build PASS, lint 0 errors (25 pre-existing warnings, none in Button). API preserved exactly — all 30 call-site files compile unchanged. **Needs human sign-off** (PAKKA: never `DONE` without explicit acceptance). |
| M3-0019 | 1 | State-layer utility (foundation carry) | `src/index.css` lines 575-660 (new `.cm-state-*` overlay classes), `src/design-system/tokens/index.ts` (`tokens.stateLayers`, `tokens.hitArea`) | PAKKA §TASK 0.16: hover 8% / focus 10%+ring / pressed 10% / dragged 16% / selected 10-12% / disabled 12% container + 38% content. Centralized helper, not per-component hand-rolled opacity. | READY_FOR_REVIEW | Built minimally for Button; reusable by Unit 2 (IconButton) and onward. Disabled content opacity is set via `disabled:opacity-[0.38]` on the button itself; container overlay is painted by `.cm-state-disabled::before`. Reduced-motion collapses the overlay transition to instant. |

---

## Open ledger rows (to be appended in PHASE 0)

The remaining M3-* rows will be created from the per-feature inventory work below. This ledger is a living document: each new task 0.x appends new M3-* rows and updates existing ones to the next status.

PHASE 0 will not close until:
- Every discovered surface has a row with status `INVENTORIED` (or `MISSING` for genuinely absent surfaces)
- The four required documents (`M3_MIGRATION_LEDGER.md`, `M3_BASELINE.md`, `M3_PHASE_REPORT.md`, `M3_DEVIATIONS.md`) exist
- Baseline build/lint/test outputs are recorded
- A PHASE 0 gate report has been written

No PHASE 1+ work begins until the PHASE 0 gate is signed.
| M3-0020 | IconButton | (1) 48dp hit area on EVERY size — pre-M3 `xs` was 24dp (D-19). (2) M3 shape: xs/sm 4px / md 8px / lg 12px via `--radius-sm/md/lg` (no `--radius-xs` in the new scale). (3) State layers via the centralized `.cm-state-*` helpers (PAKKA §TASK 0.16) — replaced hand-rolled `hover:opacity-*` / `hover:bg-*` / `active:bg-*` per variant. (4) Focus ring uses `--focus-ring`; resting radius preserved. (5) Explicit motion contract (no `transition-all`) with `--duration-small` / `--ease-standard` tokens. (6) Loading spinner `motion-reduce:animate-none`. (7) Children wrapped in `aria-hidden` span — accessible name from mandatory `aria-label`. (8) `forwardRef<HTMLButtonElement>` preserved. (9) Default `type="button"`. (10) `aria-busy`/`aria-disabled`/`data-disabled` per state. (11) Disabled content opacity 38% per PAKKA §TASK 0.16. | `clanmind-frontend/src/design-system/components/IconButton.tsx` | `IconButton.test.tsx` (25 functional), `IconButton.a11y.test.tsx` (7 a11y) | READY_FOR_REVIEW |
