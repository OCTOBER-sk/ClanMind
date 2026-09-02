# M3 Phase 5-A — Artifact panel, compare, context, unsupported-card restyle

Repo: clanmind-frontend. Prereq commit: 52913f9 (Phase 4-B committed, tree clean).
Read first: docs/M3_MIGRATION_SPEC.md section 14.8 (Artifact work surface — the ONLY design source) and section 13 (humanization map). Follow the restyle idiom already in src/features/ai/AiErrorCard.tsx and src/features/approvals/ApprovalCard.tsx (M3 tonal tokens, state-layer hovers via `before:` overlay + opacity, `focus-visible:shadow-[var(--md-focus-ring)]`, `motion-reduce:transition-none`, no raw hex).

## Scope — style ONLY these 4 files (no other file edits):
1. src/features/artifacts/ArtifactPanel.tsx (448 lines)
2. src/features/artifacts/ArtifactCompare.tsx (323 lines)
3. src/features/artifacts/ContextInspector.tsx (67 lines)
4. src/features/artifacts/UnsupportedArtifactCard.tsx (52 lines)

## Required visual outcomes (spec 14.8):
- ArtifactPanel: right-side work surface on `surface-container-low`, `corner-large` leading edge; header = artifact name title-large, `Type · vN` meta, tonal icon buttons for Pin/Version/More; state badges (loading/generating/updating/ready/failed) use state-layer tones, NOT full alarm fills; the §200 failure copy stays verbatim.
- ArtifactCompare: side-by-side/inline diff rows on surface-container-lowest, additions success state-layer tint, deletions error state-layer tint (subtle, not full fills); version headers tonal; NO raw JSON default (labels unchanged).
- ContextInspector: selected-object details = tonal container, state-layer hover on action rows; "Ask Odin about this" button keeps its existing variant and label.
- UnsupportedArtifactCard: calm surface-container card, primary/outline buttons unchanged; no crash-y styling.

## HARD compatibility requirements (violations fail the gate):
- variant= usage counts preserved per file: ArtifactPanel.tsx has 2, ArtifactCompare.tsx 1, UnsupportedArtifactCard.tsx 3, ContextInspector.tsx 0. Do not add, remove, or rename any variant prop usage.
- Preserve every aria-* attribute and aria-label string exactly (same element, same value) — the 4 files carry 19 aria attributes between them.
- Zero prop/API/state-machine/handler/export changes. Style-only diffs (className + token usage). Do not touch version-restore, export, selection, or controller logic.
- No new imports beyond existing design-system tokens/helpers already used in these files or AiErrorCard.tsx.

## Constraints
- First output = the tool call. Zero commentary lines.
- Use the exact paths/line counts above; do NOT grep/search/explore to rediscover.
- Write all edits in ONE parallel tool-call block, then run the single verification command, report in <=5 lines, STOP.
- Budget: max 12 tool calls total.

## Verification (run yourself, report results)
Run: pnpm build 2>&1 | tail -3 && pnpm test --run src/features/artifacts 2>&1 | grep -E 'Test Files|Tests '
Baseline for artifacts suite (docs/m3-baseline.txt): ArtifactPanel.test.tsx has 1 known failure ("unknown artifact types show the update-to-view card, no crash"). Gate = build green + NO NEW failures vs that baseline. Then git diff --stat must show only the 4 files. STOP.
