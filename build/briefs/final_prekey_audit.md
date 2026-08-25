You are performing the FINAL PRE-KEY VERIFICATION for ClanMind - a full end-to-end code + quality audit covering BOTH sides. This is the last gate before live infrastructure keys arrive. One agent, one session, no subagents.

AUTHORITY FILES (read BOTH fully first - they are the only standard of truth):
1. "ClanMind Backend — Master Implementation Specification.md" (repo root, 6,171 lines)
2. "ClanMind_Frontend_Master_Implementation_Specification.md" (repo root, 4,329 lines)

You may reference docs/BACKEND_TODO.md and docs/FRONTEND_TODO.md as maps of what to check, but verify every claim yourself in the CURRENT code (recent fix commits landed after those TODOs were written).

WHAT TO AUDIT (in order):

PART A - E2E LOGIC CONTINUITY (the most important part):
Trace these complete flows from UI click to DB row to broadcast back to UI, across frontend AND backend code, proving every handoff matches (field names, shapes, status enums):
1. Send message -> validation -> membership -> transactional insert -> outbox -> message.created broadcast -> dispatch -> cache -> render
2. /private @Odin -> private conversation resolution -> PRIVATE_AI ai_run -> context assembly w/ privacy filter -> provider call -> stream deltas -> artifact/action refs -> completion event -> UI settle
3. AI proposes HIGH-risk action -> approval requested -> ApprovalCard shows hash+version -> approve submits exact hash -> backend verifies -> tool executes -> events chain -> notification to initiator
4. Upload attachment -> link to message -> message render with chips -> offline queue path if send fails
5. Offline: mutation fails -> outbox persist -> reconnect -> replay with same client_operation_id -> conflict handling

PART B - CODE QUALITY:
- Error paths: no swallowed errors on user-facing flows; failures surface honest states
- Transaction boundaries per s122 (no async work inside transactions)
- Type safety: no unjustified `any` in domain logic
- Test honesty: spot-check 10 random tests across both sides - would they actually fail if the code broke?

PART C - UI/UX QUALITY (verify in code AND running app):
- Start the dev server (pnpm dev in clanmind-frontend), screenshot key surfaces at 1440/900 and 600 widths using headless chromium (binary at ~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell with LD_LIBRARY_PATH=/tmp/chrome-libs/usr/lib/x86_64-linux-gnu:/tmp/nspr-x/usr/lib/x86_64-linux-gnu)
- Verify: state matrices (loading/empty/error) present per surface, spectral restraint (calm at rest), focus states visible, reduced-motion respected, contrast tokens used
- Check the design law compliance on real screens, not just in code

PART D - RUN EVERYTHING YOURSELF:
cd clanmind-backend && pnpm -r typecheck && pnpm -r test
cd clanmind-frontend && pnpm exec tsc -b && pnpm test && pnpm run build
Report actual output.

DELIVERABLE: docs/FINAL_PREKEY_VERIFICATION.md containing:
- Per-flow trace verdicts (A1-A5): CONNECTED / BROKEN AT <point> with file:line evidence
- Quality findings (B): severity-ranked
- UI/UX findings (C): with screenshot references
- Full verification output (D)
- FINAL VERDICT: READY-FOR-LIVE-KEYS or list of remaining blockers

RULES: absolute honesty - a wrong PASS is worse than an honest FAIL. No code modifications. If something is broken, prove it.