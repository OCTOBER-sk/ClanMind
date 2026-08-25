Fix the 3 blockers from docs/FINAL_PREKEY_VERIFICATION.md (read its blocker section first). Fix ONLY these:

BLOCKER 1 (critical - private-AI live path): src/features/chat/useChatController.ts:122-127 - spawnAiRun never sends visibility/private_conversation_id, so /private @Odin runs default to GROUP and Odin's answer is broadcast Group-visible (backend orchestrator.ts:463-483 persists/broadcasts per what client sends). Pass the current composer privacy scope (PRIVATE_AI + private_conversation_id) into every AI run start. Add regression test mirroring the audit's trace.

BLOCKER 2 - attachment_ids silently stripped: frontend sends attachment_ids on message POST but the Worker's zod schema drops it -> no message_attachments rows live. Fix the worker's message-create zod schema to accept attachment_ids and persist message_attachments rows inside the same s122 transaction/RPC. Regression test both sides.

BLOCKER 3 - invisible UI text (9 missed call sites of f4ca09c): --color-primary-fg not applied at 9 sites. Verified broken: send button icon (white-on-white), focused skip link (invisible), AI Teammate badge label, active nav/section labels - BOTH themes. Find all call sites via computed-style audit/grep, fix tokens, verify visually with headless chromium screenshots (same env as audit brief) that all are visible in dark AND light.

RULES: no skipped/weakened tests; no scope creep; spec mds are authority. VERIFY LOOP green: BE pnpm -r typecheck && pnpm -r test; FE pnpm exec tsc -b && pnpm lint && pnpm test && pnpm build. Report per-blocker fix + verification verbatim.
