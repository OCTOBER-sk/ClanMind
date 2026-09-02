# M3 Phase 4-A — AI status/error/quota surfaces restyle

Repo: clanmind-frontend. Prereq commit: a7d60d8 (Phase 3-B committed, tree clean).
Read first: docs/M3_MIGRATION_SPEC.md section 14.13 (AI surfaces) — the ONLY design source. Follow the restyle idiom already in src/features/chat/MessageRow.tsx and src/features/chat/Composer.tsx (M3 tonal tokens, state-layer hovers via `before:` overlay + opacity, `focus-visible:shadow-[var(--md-focus-ring)]`, `motion-reduce:transition-none`, no raw hex).

## Scope — style ONLY these 5 files (no other file edits):
1. src/features/ai/AiStatusIndicator.tsx (242 lines)
2. src/features/ai/AiToolTimeline.tsx (136 lines)
3. src/features/ai/AiStreamAnnouncer.tsx (78 lines)
4. src/features/ai/AiErrorCard.tsx (134 lines)
5. src/features/ai/AiQuotaCard.tsx (74 lines)

## Required visual outcomes (spec 14.13):
- AiStatusIndicator: run-state driven (QUEUED subdued pulse / RUNNING / WAITING_TOOL / STREAMING / COMPLETED / FAILED / CANCELLED). Active state uses spectral pulse or M3 loading shape-morph, subdued tonal when idle/terminal. No "thinking" wording changes — text is out of scope, style only.
- AiToolTimeline: collapsed-on-completion row = tonal container, check/pending glyphs via success/tertiary tokens; expanded rows with state-layer hover.
- AiStreamAnnouncer: visually hidden/live-region surface — keep it non-visual; only ensure no loud color leaks.
- AiErrorCard: calm card — surface-container tone + error-tonal accent edge (NOT scary full-red fill); Retry/Try-fallback buttons keep their existing variants.
- AiQuotaCard: two branches — BYOK-true near-invisible subtle indicator; BYOK-false calm informational card, admin CTA styled as tonal button. Never alarm-red.

## HARD compatibility requirements (violations fail the gate):
- Preserve roles exactly across these files: role="alert" (2x), role="status" (4x) — same file, same element.
- Zero prop/API/state-machine changes. Style-only diffs (className + token usage). Do not touch run-state mapping logic, retry/fallback handlers, quota branch conditionals, or announce cadence code.
- No new imports beyond existing design-system tokens/helpers used in MessageRow.tsx.

## Constraints
- First output = the tool call. Zero commentary lines.
- Use the exact paths/line counts above; do NOT grep/search/explore to rediscover.
- Write all edits in ONE parallel tool-call block, then run the single verification command, report in <=5 lines, STOP.
- Budget: max 10 tool calls total.

## Verification (run yourself, fix until green):
pnpm test --run src/features/ai 2>&1 | tail -5
Then: git diff --stat must show ONLY the 5 files above. Report: pass/fail counts + EXIT code. STOP.
