You are Midas FINISHING ClanMind frontend P7 (approvals/GitHub). Authority: "ClanMind_Frontend_Master_Implementation_Specification.md" at repo root.

STATE: A previous P7 session completed ALL P7 wiring (BYOK UI s156-158, GitHub panel+status+flags s159-165A, GitHubActionCard, diff viewer s162, approval/merge dialogs s163-164, ApprovalCard reuse + EXPIRED re-review s164A, real endpoints per INTEGRATION_REPORT D-notes, demo transportRoutes parity) then was killed by host instability BEFORE: (1) writing P7 tests, (2) appending INTEGRATION_NOTES.md P7 D-notes, (3) running the final verify loop. Its last status said: "Wiring is complete. Remaining gaps: tests for new P7 surfaces and INTEGRATION_NOTES documentation."

YOUR JOB (finish-only, do NOT redo wiring):
1. Run `pnpm exec tsc -b` first - fix any type errors in the partial work.
2. Write P7 tests covering: ApprovalCard approve submits displayed payload_hash+payload_version exactly (s164A.2); reject path; EXPIRED re-review flow (s164A.4); GitHubActionCard dialog flows; diff viewer render; GitHub panel connected/disconnected/flag-hidden states (s165/165A hidden-not-disabled); BYOK never reveals saved key (last4 only).
3. Append P7 D-notes to docs/INTEGRATION_NOTES.md (endpoint parity table, demo-only surfaces, open gaps).
4. Self-review vs cited sections + s325 checklist; fix findings.
5. Final verify loop until green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep clean.
Report sections covered, files changed, verification verbatim, SPEC-SILENT / NOT VERIFIED honestly. Do NOT start P8. Do NOT touch clanmind-backend/.
