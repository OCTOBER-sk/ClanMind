You are Midas FIXING the blockers found by your own audit (docs/FRONTEND_AUDIT2_REPORT.md - read its blocking list first). Fix ONLY these, nothing else:

B1 (BLOCKER - private-AI leakage):
1. src/realtime/dispatch.ts:250 - the PRIVATE_AI gate accepts any event when recipientId==='ai'. Fix so a PRIVATE_AI row/event is only applied to the cache of the conversation's owning member; events addressed to 'ai' must never hydrate a human device's shared cache with another member's private thread. Trace how useRealtimeController sends private_to:'ai' and where demo hub broadcasts room-wide; fix at dispatch gate AND/OR hub fan-out per spec s56-58/s2.26.
2. src/features/chat/chatSelectors.ts:49 - render PRIVATE_AI rows only when local user participates in the conversation (structural check via store scoping, not visual).
3. Add a regression test replicating the audit's probe: teammate B's private AI message arrives on A's device -> must NOT appear in A's chat; A's own private AI messages still render. Extend the existing leakage test payload to include private_to:'ai'.
4. Fix the existing leakage test that missed this (its synthetic payload omitted private_to).

B2: replace "Loading workspace…" copy with spec-compliant text (no "workspace" anywhere, s0.1).
B3: draft scope keys must include privacy mode (group/project/conversation scope + PRIVATE_AI/HUMAN_PAIR/public) so drafts never cross privacy boundaries (s7.19).

RULES: no skipped/weakened tests. VERIFY LOOP green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep. Report exactly what changed per blocker + verification verbatim. Do NOT touch clanmind-backend/.
