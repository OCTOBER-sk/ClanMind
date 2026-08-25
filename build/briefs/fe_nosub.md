Your previous audit attempts failed because parallel subagents kept dying on provider errors. RETRY RULES for this run:

1. DO NOT use subagents/parallel agents at all. You do 100% of the audit work yourself, sequentially, in this single session.
2. Work through docs/FRONTEND_TODO.md section by section (they are numbered). After each section, immediately append its grades to docs/FRONTEND_AUDIT2_REPORT.md so progress survives any interruption.
3. If a single tool call fails with a provider/network error, wait briefly (retry once) and continue - do not restart the whole audit.
4. High-stakes traces you must do yourself: private-content store scoping (0.12), permission-gated affordances (0.11), streaming state machine mapping, approvals payload_hash submission, sync outbox replay, WCAG token usage.
5. Run pnpm exec tsc -b && pnpm test && pnpm run build yourself; dist purity grep.
6. Final verdict: staging-ready / production-ready / not-ready + blocking list.

Begin now from wherever the last attempt left off; sections already graded in the report file can be skipped.
