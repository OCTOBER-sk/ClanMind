# M3 Phase 3-A — Chat message surfaces restyle

Repo: clanmind-frontend. Prereq commit: 4fba1cd (Phase 2-B committed, tree clean).
Read first: docs/M3_MIGRATION_SPEC.md sections 14.2 (Main chat) and 13 (humanization) — that is the ONLY source of design truth. Follow the TopBar/LeftNav restyle idiom already in src/features/shell/ (state-layer hovers via `before:` overlay + opacity, `focus-visible:shadow-[var(--md-focus-ring)]`, `motion-reduce:transition-none`, M3 tonal tokens from src/design-system tokens — no raw hex).

## Scope — style ONLY these 4 files (no other file edits):
1. src/features/chat/MessageList.tsx (515 lines)
2. src/features/chat/MessageRow.tsx (609 lines)
3. src/features/chat/MessageActions.tsx (182 lines)
4. src/features/chat/ThreadPanel.tsx (199 lines)

## Required visual outcomes (spec 14.2):
- MessageRow: body = body-large typography token; row bg `surface`; hover = state layer (not a new card); avatars corner-full; consecutive same-author grouping keeps single avatar/name header styling per spec; max reading width ~720px for prose, full width only for AI research/tables/code/artifacts; mention highlight subtle; deleted/pending/failed states read as human text, no loud color.
- MessageActions: Reply/React/Copy/More = icon buttons with state layers, keyboard-reachable (not hover-only).
- ThreadPanel: header + close per M3; container `surface-container-low`, corner tokens.
- MessageList: dividers ("New messages") subtle outline-token; keep virtualization logic 100% untouched.

## HARD compatibility requirements (violations fail the gate):
- Preserve ALL 8 data-testids exactly: upload-send-hint, thread-panel, private-recipient-chooser, privacy-recipient, privacy-header, failed-upload-hint, attachment-tray, attachment-chip (where they currently live in these files: thread-panel, attachment-tray/chip if in ThreadPanel etc.).
- Preserve roles: role="log" (1x, MessageList), role="separator" (1x), role="status" (5x across these files).
- Preserve the 2 className test assertions: 'group-focus-within:flex' and 'h-7' (MessageActions/MessageRow hover-action container — keep both literal classes).
- Zero prop/API/ref/logic changes. Style-only diffs. No changes to virtualization, scroll anchoring, or state management code.

## Constraints
- First output = the tool call. Zero commentary lines.
- Use the exact paths above; do NOT grep/search/explore to rediscover.
- Write all edits in ONE parallel tool-call block, then run the single verification command, report in <=5 lines, STOP.
- Budget: max 12 tool calls total.

## Verification (run yourself, fix until green):
pnpm test --run src/features/chat 2>&1 | tail -5 — compare vs docs/m3-baseline.txt (expect the same pre-existing failures, NO new ones; chat message tests were passing at baseline).
Then: git diff --stat — must show only the 4 files.
Report: EXIT=0 last line.
