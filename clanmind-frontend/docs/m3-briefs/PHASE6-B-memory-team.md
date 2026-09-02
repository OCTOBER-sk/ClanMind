# M3 Phase 6-B — Memory & Team restyle

Repo: clanmind-frontend. Prereq commit: c8bfc90 (Phase 6-A committed, tree clean).
Read first: docs/M3_MIGRATION_SPEC.md section 13 (humanization map) and the memory/team parts of section 14. Follow the restyle idiom already in src/features/projects/ProjectOverview.tsx and src/features/tasks/TaskCard.tsx (M3 tonal tokens, state-layer hovers via `before:` overlay + opacity, `focus-visible:shadow-[var(--md-focus-ring)]`, `motion-reduce:transition-none`, no raw hex).

## Scope — style ONLY these 2 files (no other file edits):
1. src/features/memory/MemoryView.tsx (526 lines)
2. src/features/team/TeamView.tsx (262 lines)

## Required visual outcomes:
- MemoryView: sections on `surface-container-low`/`surface-container` (distinct tones = visible depth); contradiction items get DISTINCT treatment (spec 13 — e.g. `error-container`/`warning-container` tonal container, visually different from plain memory rows); status/kind pills = tonal containers, never raw ALL-CAPS enum text styling (copy strings themselves must NOT change).
- TeamView: member rows/cards on tonal containers; presence/status as tonal pills; `variant="spectral"` and `variant="circular"` elements keep their variant props — restyle surrounding containers only.
- Zero structural changes: rendering, handlers, store calls, exports stay byte-identical outside className/style tokens.

## HARD compatibility requirements (violations fail the gate):
- variant= usage counts preserved per file: MemoryView 15, TeamView 9 — keep every existing variant prop exactly as-is; introduce none.
- Preserve every aria-* attribute and aria-label string exactly (same element, same value): MemoryView 24, TeamView 7 (31 total).
- Zero prop/API/state-machine/handler/export/copy-string changes. Style-only diffs (className + token usage).
- No new imports beyond existing design-system tokens/helpers already used in these files or the Phase 6-A files.

## Constraints
- First output = the tool call. Zero commentary lines.
- Use the exact paths/line counts above; do NOT grep/search/explore to rediscover.
- Write all edits in ONE parallel tool-call block, then run the single verification command, report in <=5 lines, STOP.
- Budget: max 14 tool calls total.

## Verification (run yourself, report results)
Run: pnpm build 2>&1 | tail -3 && pnpm test --run src/features/memory src/features/team 2>&1 | grep -E 'Test Files|Tests '
Baseline (docs/m3-baseline.txt): known failures in this scope — MemoryView.test.tsx has 2 FAIL entries; TeamView has 0. Gate = build green + NO NEW failures vs baseline. Then git diff --stat must show only the 2 files. STOP.
