# PHASE 2-B — M3 restyle: AppShell surfaces, PanelResizer, KeyboardShortcutsDialog

Repo: clanmind-frontend (React + Tailwind v4 + Radix, tokens in src/index.css / src/design-system/tokens). Prereq commit: 9ca8868 (Phase 2-A done — TopBar/LeftNav restyled). Read TopBar.tsx + LeftNav.tsx FIRST and mirror their M3 idiom exactly.

## Scope — ONLY these 3 files
1. `src/features/shell/AppShell.tsx`
2. `src/features/shell/PanelResizer.tsx`
3. `src/features/shell/KeyboardShortcutsDialog.tsx`

NO structural/behavioural changes: keep every prop, ref, handler, aria attribute, id (`cm-main-content`), data-testid, and className-adjacent test hook intact. Style-only diffs.

## M3 rules (from spec docs/M3_MIGRATION_SPEC.md §4–§11)
- Surfaces: main panes use token roles only — `bg-surface`, `bg-surface-container-low` etc. via the existing token classes used in TopBar/LeftNav (copy their exact class names, e.g. `bg-(--color-...)` or utility names already in use). NO raw hex, NO arbitrary `bg-[#...]`, `text-[#...]`.
- AppShell: right-surface docked pane + sheet get M3 `surface-container-low` background, hairline separators via `border-(--color-outline-variant)` equivalent already used in 2-A files; sheet/scrim uses token overlay; keep `color-mix` state-layer idiom from 2-A for hoverable shell regions.
- PanelResizer: separator becomes M3 — 1px hairline at rest using outline-variant token, on hover/focus widens to a `primary` 3px indicator with `rounded-full`, visible focus ring matching TopBar's `focus-visible` ring classes from 2-A. Keep role="separator" + all aria-value* exactly. Add `motion-reduce` guard to any transition.
- KeyboardShortcutsDialog: restyle via M3 Dialog idiom from Phase 1-B (`src/components/ui/dialog.tsx` is already M3 — just align surface/typography classes: dialog bg `surface-high`-equivalent token already used by Dialog, shortcut keys rendered as M3 outline Badge-style chips with `rounded` + outline-variant border, section labels `label-medium` type token classes). Keep DOM structure/tests intact.
- Focus: every interactive element touched gets the same `focus-visible:ring` treatment as 2-A.
- Motion: any transition durations from existing token classes only; wrap in `motion-reduce:transition-none`.

## Hard constraints
- Do NOT touch any other file. Do NOT change src/features/sync/SyncBanner or routing.
- Tests that must stay green unchanged: `src/features/shell/AppShell.a11y.test.tsx`, `LeftNav.test.tsx`, `TopBar.meeting.test.tsx`, plus anything importing AppShell (`src/app/router.tsx` untouched).
- Baseline already has 28 pre-existing failures (docs/m3-baseline.txt) — do NOT fix unrelated failing tests.

## Procedure (budget: <=8 tool calls)
1. Read the 3 files + TopBar.tsx (reference idiom).
2. Edit all 3 files (parallel if possible).
3. Run: `pnpm build && pnpm test 2>&1 | tail -5`
4. Report in <=5 lines: files changed, build status, test counts vs 28-failed baseline, any classname assertions touched (should be none). STOP.

First output = the first tool call. Zero commentary lines.
