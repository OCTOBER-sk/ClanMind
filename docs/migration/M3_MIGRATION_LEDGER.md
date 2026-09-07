# M3 Migration Ledger

**Source of truth:** `clanmind-frontend/docs/M3_MIGRATION_SPEC.md` (v2.0 Final)
**Baseline:** `clanmind-frontend/docs/m3-baseline.txt` (30 fail / 458 pass / 488 tests / 13 files)
**Phase 8-A verified state (2026-09-03):** 28 fail / 516 pass / 544 tests / 12 files, 92 a11y tokens pass, dark base #000000.

This ledger records every change shipped against the M3 spec — phase, scope, files, gate result, and any regression delta. Each row is independently verifiable via the corresponding phase run log under `clanmind-frontend/docs/m3-briefs/PHASE*-run.log`.

| Phase | Date (UTC) | Title | Files | Build | Lint | Tests (vs baseline) | New fails | a11y tokens | Status |
|-------|------------|-------|-------|-------|------|---------------------|-----------|-------------|--------|
| M3-B1 | 2026-09-07 | Phase B-1 — remove three §10 spectral violations (auth strip, meeting pulse, progress indefinite sweep) | 3 source + 1 log + this ledger | PASS (tsc 0 err, vite 1.95s) | PASS (0 errors) | 28 fail / 516 pass (= 8-A) | 0 | 92 PASS | VERIFIED |

## M3-B1 details

**Scope:** 3 source files only (presentation-layer, no api/state/realtime/sync/local/hooks/config/tauri/controllers touched).
**Changes:**
- `clanmind-frontend/src/features/auth/AuthScreen.tsx:64-65` — permanent `spectral-active` strip → static `bg-outline-variant` divider (token-only).
- `clanmind-frontend/src/features/meetings/MeetingActiveHeader.tsx:41-42` — `spectral-active animate-pulse` meeting dot → `bg-error` (per §14.12), `animate-pulse` removed.
- `clanmind-frontend/src/design-system/components/Progress.tsx:47` — `after:animate-[spectral-sweep_800ms_linear_infinite]` → `after:animate-[spectral-sweep_800ms_ease-out_1] motion-reduce:after:animate-none` (one-time, a11y-gated).

**Hard guardrails met:** model = minimax/minimax-m3:free; every value from M3 tokens; no new hex/px; dark base #000000 preserved; WCAG 2.2 AA (92/92 tokens.a11y pass); 0 new test failures vs baseline; §10 audit shows only the 6 allowed contexts.

**Run log:** `clanmind-frontend/docs/m3-briefs/PHASEB1-run.log`
**Brief:** `clanmind-frontend/docs/m3-briefs/PHASEB1-spectral-violations.md`
