You are Midas completing ClanMind frontend P15 (security hardening + desktop packaging prep) - the FINAL phase. Authority files - BOTH are binding: "ClanMind_Frontend_Master_Implementation_Specification.md" AND "ClanMind Backend — Master Implementation Specification.md" at repo root.

STATE HANDOFF: P0-P14 committed green (453 tests). App is feature-complete per FE spec. INTEGRATION_NOTES.md ledger D1-D28; append D29 (final).

P15 SCOPE - grep FE spec for security sections (CSP, secrets, XSS, sanitize, token storage) and Tauri/desktop packaging sections; read fully:
1. SECURITY AUDIT of the frontend:
   - No secrets/keys/tokens in code or dist (verify BYOK keys only ever in memory/transient, never localStorage)
   - All rendered markdown/html sanitized (check the markdown stack config for raw HTML allowance)
   - CSP compliance: no inline scripts/styles violating index.html policy, no eval
   - Dependency sanity: no known-vulnerable imports pattern (manual check of unusual packages)
2. TAURI PACKAGING PREP (per spec): verify src-tauri config matches spec (app id, window min sizes s195, CSP for tauri context), capabilities file least-privilege check, updater config stub if spec requires.
3. FINAL ACCEPTANCE: run through FE s320-325 acceptance checklists - mark each item PASS/FAIL/N-A with evidence. This is the phase-close deliverable.
4. Tests: keep 453 green; add security regression tests where cheap (e.g. sanitize-on-render).
RULES (hard): no skipped/weakened tests; fix real issues only. VERIFY LOOP until green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep clean. Report: security findings+fixes, packaging-prep status, FULL s320-325 checklist with evidence, verification verbatim. Do NOT touch clanmind-backend/.