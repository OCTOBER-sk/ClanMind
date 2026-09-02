# M3 Phase 6-A — Projects, Tasks, Decisions restyle

Repo: clanmind-frontend. Prereq commit: a044adb (Phase 5-B committed, tree clean).
Read first: docs/M3_MIGRATION_SPEC.md sections 14.4 (Project overview + Pulse), 14.11 (Tasks & decisions), and 13 (humanization map). Follow the restyle idiom already in src/features/artifacts/ArtifactPanel.tsx (M3 tonal tokens, state-layer hovers via `before:` overlay + opacity, `focus-visible:shadow-[var(--md-focus-ring)]`, `motion-reduce:transition-none`, no raw hex).

## Scope — style ONLY these 6 files (no other file edits):
1. src/features/projects/ProjectOverview.tsx (379 lines)
2. src/features/projects/ProjectPulse.tsx (230 lines)
3. src/features/tasks/TaskCard.tsx (250 lines)
4. src/features/tasks/TasksView.tsx (242 lines)
5. src/features/decisions/DecisionCard.tsx (168 lines)
6. src/features/decisions/DecisionsView.tsx (142 lines)

## Required visual outcomes:
- ProjectOverview: cards on `surface-container-low`/`surface-container` (distinct tones = visible depth); tabs are M3 tabs; no deep hierarchy styling hacks.
- ProjectPulse (spec 14.4): tonal container; spectral sweep on the progress bar animates ONCE on change, never continuously (respect `motion-reduce:`). Keep existing animation trigger logic byte-identical — style/token changes only.
- TaskCard / DecisionCard: status/risk pills = tonal containers (e.g. `warning-container`/`on-warning-container`), never raw ALL-CAPS enum text styling (spec 13 humanization — copy strings themselves must NOT change).
- Zero structural changes: rendering, handlers, store calls, exports stay byte-identical outside className/style tokens.

## HARD compatibility requirements (violations fail the gate):
- variant= usage counts preserved per file: ProjectOverview 5, ProjectPulse 1, TaskCard 2, TasksView 7, DecisionCard 1, DecisionsView 6 — keep every existing variant prop exactly as-is; introduce none.
- Preserve every aria-* attribute and aria-label string exactly (same element, same value): ProjectOverview 14, ProjectPulse 13, TaskCard 14, TasksView 8, DecisionCard 5, DecisionsView 2 (56 total).
- Zero prop/API/state-machine/handler/export/copy-string changes. Style-only diffs (className + token usage).
- No new imports beyond existing design-system tokens/helpers already used in these files or ArtifactPanel.tsx.

## Constraints
- First output = the tool call. Zero commentary lines.
- Use the exact paths/line counts above; do NOT grep/search/explore to rediscover.
- Write all edits in ONE parallel tool-call block, then run the single verification command, report in <=5 lines, STOP.
- Budget: max 16 tool calls total.

## Verification (run yourself, report results)
Run: pnpm build 2>&1 | tail -3 && pnpm test --run src/features/projects src/features/tasks src/features/decisions 2>&1 | grep -E 'Test Files|Tests '
Baseline (docs/m3-baseline.txt): exactly 1 known failure in this scope — TasksView.test.tsx "status select, owner select and Done button each invoke their handler". Gate = build green + NO NEW failures vs that baseline. Then git diff --stat must show only the 6 files. STOP.
