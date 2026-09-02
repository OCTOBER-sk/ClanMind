# M3 Phase 3-B — Composer + picker surfaces restyle

Repo: clanmind-frontend. Prereq commit: 4aa1dd3 (Phase 3-A committed, tree clean).
Read first: docs/M3_MIGRATION_SPEC.md section 14.3 (Composer) — the ONLY design source. Follow the restyle idiom already in src/features/chat/MessageRow.tsx and src/features/shell/ (state-layer hovers via `before:` overlay + opacity, `focus-visible:shadow-[var(--md-focus-ring)]`, `motion-reduce:transition-none`, M3 tonal tokens — no raw hex).

## Scope — style ONLY these 5 files (no other file edits):
1. src/features/chat/Composer.tsx (760 lines)
2. src/features/chat/AttachmentTray.tsx (215 lines)
3. src/features/chat/MentionPicker.tsx (144 lines)
4. src/features/chat/SlashCommandPicker.tsx (174 lines)
5. src/features/chat/PrivateRecipientChooser.tsx (115 lines)

## Required visual outcomes (spec 14.3):
- Composer: outlined container corner-medium, surface-container-low tone; send button = filled icon-button treatment (subdued when empty, state layers when active); reply/private chips styled as input chips; queued/offline chip at normal visual weight. Privacy header (data-testid="privacy-header") unmistakable.
- AttachmentTray: chips icon/name/size/remove, subtle container; uploading/failed text reads as human text, no loud color.
- MentionPicker + SlashCommandPicker: popover container surface-container-low, corner tokens, option rows with state-layer hover + keyboard focus ring; selected option = subtle tonal, not accent-heavy.
- PrivateRecipientChooser: row list with state layers, avatar corner-full.

## HARD compatibility requirements (violations fail the gate):
- Preserve ALL data-testids exactly and in place: upload-send-hint, privacy-header, privacy-recipient, failed-upload-hint (Composer.tsx); attachment-tray, attachment-chip (AttachmentTray.tsx); private-recipient-chooser (PrivateRecipientChooser.tsx).
- Preserve roles exactly: list (1x), listbox (3x), listitem (1x), option (3x), status (2x) across these 5 files.
- Zero prop/API/ref/logic changes. Style-only diffs (className + token usage). Do not touch caret tracking, upload state machine, keyboard handlers, or send/queue logic.

## Constraints
- First output = the tool call. Zero commentary lines.
- Use the exact paths above; do NOT grep/search/explore to rediscover.
- Write all edits in ONE parallel tool-call block, then run the single verification command, report in <=5 lines, STOP.
- Budget: max 12 tool calls total.

## Verification (run yourself, fix until green):
pnpm test --run src/features/chat 2>&1 | tail -5 — compare vs docs/m3-baseline.txt (expect only the same pre-existing failures, NO new ones).
Then: git diff --stat — must show only the 5 files.
Report: EXIT=0 last line.
