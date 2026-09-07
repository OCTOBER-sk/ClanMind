# Phase B-2 — Baseline-failure audit (no new regression detection)

The 28 remaining `pnpm test` failures are ALL pre-existing (vs `docs/m3-baseline.txt`). Verify each one is genuinely orthogonal to the M3 token/component refactor — i.e. confirm that NONE of them are caused by the token-replacement / component-restyle work. If any IS hiding a real M3 regression, fix that ONE with the smallest token-safe patch. Otherwise: leave them alone.

Process:
1. Read `docs/m3-baseline.txt` (28-fail list).
2. For each failing test: check whether the test references a token name (var(--md-*)), a CSS class (spectral-active, btn-primary, etc.), a component path under `src/design-system/` or `src/features/`, or any of the M3 §10-violation fixes we just landed (AuthScreen gradient strip / MeetingActiveHeader dot / Progress wavy).
3. Bucket each into:
   - A — Genuinely orthogonal to M3 work (test fixture drift, snapshot drift, BE contract drift). DO NOT TOUCH.
   - B — Touches M3 surface but no real regression (test asserts outdated token name that still resolves). FIX the assertion text to match current token name. NO functional change.
   - C — Real M3 regression hidden inside a failing test. FIX with smallest token-safe patch.
4. Report counts: A / B / C.
5. Re-run `pnpm test`. New failure total should be ≤ 28. If B and C fixes worked, count goes DOWN.
6. Hard guardrails:
   - DO NOT modify any production file in `src/api/`, `src/state/`, `src/realtime/`, `src/sync/`, `src/local/`, `src/hooks/`, `src/config/`, `src/tauri/`, `use*Controller.ts`. Exception: only if Bucket C demands it AND change is token-only (no logic).
   - Token-only: use `var(--md-*)` or the `M3_VAR.*` / `M3_TOKENS.*` accessors in `src/design-system/tokens/index.ts`. No hex, no px font-size, no ad-hoc durations.
   - If you find a test that's expecting a token name we renamed, update the TEST STRING only, not the token (unless rename was wrong, in which case revert the rename).

Deliverable:
- Files changed list (absolute paths + line numbers)
- Bucket A/B/C count
- Final pnpm test count vs `docs/m3-baseline.txt` 28 fail
- One-paragraph honest summary: "X real M3 regressions hidden by baseline; Y test-text updates needed; Z true unrelated drift."

Run, then STOP.
