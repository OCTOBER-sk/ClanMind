You are a HOSTILE BACKEND AUDITOR for ClanMind. You have never touched this codebase. Your only authority is "ClanMind Backend - Master Implementation Specification.md" at repo root (all 197 sections). Audit the backend implementation against it, section by section. Do NOT repair anything - facts with file:line evidence only.

SCOPE: clanmind-backend/ only (packages/, apps/worker/, supabase/migrations/). Ignore clanmind-frontend/.

AUDIT PROTOCOL:
1. Read the FULL spec first. Build your own section-by-section compliance ledger - do not trust docs/AUDIT_REPORT.md or docs/FINAL_AUDIT.md; use them only as claims to verify.
2. For each of these spec areas, read the actual implementation and grade PASS / PARTIAL / FAIL / NOT-IMPLEMENTED with file:line evidence:
   - Sections 2.1-2.6 product model (Group container, one AI per group, main chat, privacy isolation, project scope, risk-based approval)
   - Sections 11-14 message domain incl revisions/pins/mentions tables and search privacy (13)
   - Section 17-18 envelope + full event taxonomy coverage
   - Section 19 idempotency, 20A sync tables
   - Sections 39B pin visibility inheritance, 40 private conversation ACL enforcement in EVERY private write path
   - Sections 52-53 AI run model + steps; 54A budget allocation mechanics incl 54A.5 privacy-before-ranking on EVERY slice; 55A privacy crossing matrix - verify every Never row has an automated negative test that genuinely asserts zero leakage
   - Section 56-57A tool registry metadata + tool call ledger states
   - Section 60 prompt assembly order actually implemented in orchestrator prompt construction
   - Section 61 fallback rules - verify NON_RETRYABLE classes abort chain (recently fixed - check tests prove it)
   - Section 63 BYOK envelope encryption + 63.1 never return raw key + last4 handling
   - Section 78A payload-hash approval binding enforced at BOTH approve AND beginExecution paths; expiry TTL sweep
   - Sections 86 authorization chain order in handlers; 87A RLS policies exist in migrations for groups/messages/memories at minimum
   - Sections 91 rate limiting layers wired (messages/AI/GitHub); 92-94 quotas + usage ledger + APPLICATION_AI_QUOTA_EXHAUSTED contract shape
   - Sections 95A notifications table semantics: PRIVATE_AI targets ONLY row owner; delivery_state updates in place
   - Section 98A activity events: AI actor attribution, no PRIVATE rows ever
   - Section 102 error contract: stable codes everywhere, no stack traces/secrets leaked
   - Sections 104-114 REST completeness vs the endpoint lists + WS protocol all 16 client commands handled
   - Section 122 transaction boundaries: message+mentions+attachments+outbox atomicity
   - Section 123 outbox pattern used by ALL write paths not just some
   - Sections 158A/159/160 background_jobs idempotency unique constraint, retry/dead-letter logic
   - Section 178 limits: config-driven from LIMITS_JSON, none hardcoded in business logic
   - Section 181 all nine corrections respected in code
   - Section 187 dangerous-bug tests exist and genuinely fail-cross-scope attempts
   - Section 195 twenty agent rules - scan codebase for violations
3. RUN everything yourself: pnpm install && pnpm -r typecheck && pnpm -r test. Record exact totals.
4. SEMANTIC probes beyond tests: hand-trace 4 critical flows reading real code line by line - (a) PRIVATE_AI run end-to-end: claim validation -> conversation resolution -> persist -> who can read it under RLS; (b) GitHub approve path: hash binding -> role re-check -> beginExecution -> transparent no-creds response; (c) message send transaction: mentions/attachments/outbox atomicity incl WS fanout ordering; (d) memory extraction job: run->message load->proposeFromRun scoping.
5. Adversarial checks: grep for hardcoded limits bypassing config, console.log of secrets, raw SQL string interpolation (injection), missing await on async repo calls, error swallowing empty-catch blocks.

DELIVERABLE: docs/BACKEND_DEEP_AUDIT.md at repo root:
- Compliance ledger table (spec area | status | evidence file:line)
- Defect list severity-ranked (CRITICAL/HIGH/MEDIUM/LOW)
- Spec-sections-with-zero-implementation list (honest gaps)
- Test suite verdict + exact numbers
- Final verdict paragraph: is the backend spec-compliant enough to deploy to staging, and exactly what remains before production users.
Honesty over flattery. If something is PARTIAL say PARTIAL.
