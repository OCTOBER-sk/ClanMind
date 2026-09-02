# M3 Phase 5-B — Artifact viewer restyle (Chart, Diagram, Document, Table)

Repo: clanmind-frontend. Prereq commit: 222d20b (Phase 5-A committed, tree clean).
Read first: docs/M3_MIGRATION_SPEC.md section 14.8 (Artifact work surface — the ONLY design source) and section 13 (humanization map). Follow the restyle idiom already in src/features/artifacts/ArtifactPanel.tsx and UnsupportedArtifactCard.tsx (M3 tonal tokens, state-layer hovers via `before:` overlay + opacity, `focus-visible:shadow-[var(--md-focus-ring)]`, `motion-reduce:transition-none`, no raw hex).

## Scope — style ONLY these 4 files (no other file edits):
1. src/features/artifacts/ChartViewer.tsx (148 lines)
2. src/features/artifacts/DiagramViewer.tsx (440 lines)
3. src/features/artifacts/DocumentViewer.tsx (158 lines)
4. src/features/artifacts/TableArtifactViewer.tsx (227 lines)

## Required visual outcomes (spec 14.8):
- All four viewers render on the artifact work surface (`surface-container-low` context); theme charts/diagrams from M3 tokens — no hardcoded colours; diagrams must stay legible (tokens for nodes/edges/text).
- ChartViewer + DiagramViewer: hide xyflow/watermark attribution if present; fit-to-width default; controls = tonal icon buttons with state-layer hover.
- DocumentViewer: prose container on `surface-container-lowest`, typographic scale from token classes, no raw hex.
- TableArtifactViewer: header row tonal container, zebra/row hover via state-layer tint, sticky header styling unchanged in behaviour.
- Zero structural changes: rendering, export, selection, zoom/pan, and virtualisation logic stay byte-identical outside className/style tokens.

## HARD compatibility requirements (violations fail the gate):
- variant= usage counts preserved per file: ChartViewer.tsx 0, DiagramViewer.tsx 0, DocumentViewer.tsx 0, TableArtifactViewer.tsx 0 — do not introduce any variant prop usage.
- Preserve every aria-* attribute and aria-label string exactly (same element, same value): ChartViewer 2, DiagramViewer 7, DocumentViewer 5, TableArtifactViewer 8 (22 total).
- Zero prop/API/state-machine/handler/export changes. Style-only diffs (className + token usage).
- No new imports beyond existing design-system tokens/helpers already used in these files or ArtifactPanel.tsx.

## Constraints
- First output = the tool call. Zero commentary lines.
- Use the exact paths/line counts above; do NOT grep/search/explore to rediscover.
- Write all edits in ONE parallel tool-call block, then run the single verification command, report in <=5 lines, STOP.
- Budget: max 12 tool calls total.

## Verification (run yourself, report results)
Run: pnpm build 2>&1 | tail -3 && pnpm test --run src/features/artifacts 2>&1 | grep -E 'Test Files|Tests '
Baseline (docs/m3-baseline.txt): the artifacts suite has exactly 1 known failure — ArtifactPanel.test.tsx "unknown artifact types show the update-to-view card, no crash". Gate = build green + NO NEW failures vs that baseline. Then git diff --stat must show only the 4 files. STOP.
