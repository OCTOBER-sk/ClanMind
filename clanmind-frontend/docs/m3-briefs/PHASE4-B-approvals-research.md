# M3 Phase 4-B — Research drawer + approvals surfaces restyle

Repo: clanmind-frontend. Prereq commit: a710e40 (Phase 4-A committed, tree clean).
Read first: docs/M3_MIGRATION_SPEC.md sections 14.14 (Approvals) and 14.15 (GitHub) — the ONLY design source; plus section 14.13 for the research drawer context. Follow the restyle idiom already in src/features/ai/AiErrorCard.tsx and src/features/chat/MessageRow.tsx (M3 tonal tokens, state-layer hovers via `before:` overlay + opacity, `focus-visible:shadow-[var(--md-focus-ring)]`, `motion-reduce:transition-none`, no raw hex).

## Scope — style ONLY these 4 files (no other file edits):
1. src/features/ai/ResearchDrawer.tsx (156 lines)
2. src/features/approvals/ApprovalCard.tsx (428 lines)
3. src/features/approvals/GitHubActionCard.tsx (188 lines)
4. src/features/approvals/GitHubDiffViewer.tsx (558 lines)

## Required visual outcomes (spec 14.14–14.15):
- ApprovalCard: calm high-attention card — surface-container tone, subtle outline accent (NOT alarm fill); approve/reject buttons keep their existing variants (primary vs danger) and labels; busy state uses the existing indicator, restyled only.
- GitHubActionCard: same tonal shell as ApprovalCard; hash/version display uses mono token styling; entry-point buttons unchanged in behaviour.
- GitHubDiffViewer: diff rows use surface-container-lowest background, additions tinted success state-layer, deletions error state-layer (subtle, not full fills); sticky header tonal; collapse/expand rows keep aria-expanded values exactly.
- ResearchDrawer: source/citation rows = tonal container with state-layer hover; spectral treatment ONLY where spec section 10 allows it; otherwise neutral M3 surfaces.

## HARD compatibility requirements (violations fail the gate):
- variant= usage counts must be preserved per file: ApprovalCard.tsx has 6, GitHubActionCard.tsx 2, GitHubDiffViewer.tsx 8, ResearchDrawer.tsx 0. Do not add, remove, or rename any variant prop usage.
- Preserve all 4 aria-expanded attributes and every aria-label string exactly (same element, same value).
- Zero prop/API/state-machine/handler changes. Style-only diffs (className + token usage). Do not touch approve/reject submit logic, hash/version binding, diff parsing, or drawer open/close code.
- No new imports beyond existing design-system tokens/helpers already used in these files or AiErrorCard.tsx.

## Constraints
- First output = the tool call. Zero commentary lines.
- Use the exact paths/line counts above; do NOT grep/search/explore to rediscover.
- Write all edits in ONE parallel tool-call block, then run the single verification command, report in <=5 lines, STOP.
- Budget: max 12 tool calls total.

## Verification (run yourself, report results)
Run: pnpm build 2>&1 | tail -3 && pnpm test --run src/features/approvals 2>&1 | grep -E 'Test Files|Tests ' 
Baseline for approvals suite: ApprovalCard 2 failing, GitHubActionCard 3 failing, GitHubDiffViewer 1 failing (docs/m3-baseline.txt). Gate = build green + NO NEW failures vs that baseline. Then git diff --stat must show only the 4 files. STOP.
